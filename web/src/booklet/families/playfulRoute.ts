import type { EditorialBooklet } from "../editorialModel";
import { PaginationError } from "../paginate";

export type PlayfulRouteDayMeasurement = {
	readonly selectedBlockHeights: readonly number[];
	readonly wideBlockHeights: readonly number[];
};

export type PlayfulRouteMeasurement = {
	readonly blockGap: number;
	readonly continuationBodyHeight: number;
	readonly days: readonly PlayfulRouteDayMeasurement[];
	readonly firstBodyHeight: number;
	readonly selectedBlockWidth: number;
	readonly wideBlockWidth: number;
};

export type PlayfulRouteLayoutVariant =
	| "selected"
	| "compact-header"
	| "wide-ribbon";

export type PlayfulRouteCoverPagePlan = {
	readonly kind: "cover";
	readonly pageId: string;
};

export type PlayfulRouteDayPagePlan = {
	readonly blockHeightsMm: readonly number[];
	readonly continuation: boolean;
	readonly dayIndex: number;
	readonly kind: "day";
	readonly layoutVariant: PlayfulRouteLayoutVariant;
	readonly pageId: string;
	readonly unitIndexes: readonly number[];
};

export type PlayfulRoutePagePlan =
	| PlayfulRouteCoverPagePlan
	| PlayfulRouteDayPagePlan;

function requirePositiveFinite(value: number, name: string): number {
	if (!Number.isFinite(value) || value <= 0) {
		throw new PaginationError("invalid-measurement", `${name}が不正です。`);
	}
	return value;
}

function validateMeasurement(
	booklet: EditorialBooklet,
	measurement: PlayfulRouteMeasurement,
): void {
	for (const [value, name] of [
		[measurement.blockGap, "ブロック間隔"],
		[measurement.firstBodyHeight, "先頭ページ本文高さ"],
		[measurement.continuationBodyHeight, "継続ページ本文高さ"],
		[measurement.selectedBlockWidth, "選択構図のブロック幅"],
		[measurement.wideBlockWidth, "広幅ブロック幅"],
	] as const) {
		requirePositiveFinite(value, name);
	}
	if (measurement.days.length !== booklet.days.length) {
		throw new PaginationError(
			"invalid-measurement",
			"日ごとの計測結果の件数が一致しません。",
		);
	}
	booklet.days.forEach((day, dayIndex) => {
		const measuredDay = measurement.days[dayIndex];
		if (
			!measuredDay ||
			measuredDay.selectedBlockHeights.length !== day.units.length ||
			measuredDay.wideBlockHeights.length !== day.units.length
		) {
			throw new PaginationError(
				"invalid-measurement",
				`Day ${dayIndex + 1}のブロック計測結果の件数が一致しません。`,
			);
		}
		measuredDay.selectedBlockHeights.forEach((height, unitIndex) => {
			requirePositiveFinite(
				height,
				`Day ${dayIndex + 1}の選択幅ブロック ${unitIndex + 1}の高さ`,
			);
		});
		measuredDay.wideBlockHeights.forEach((height, unitIndex) => {
			requirePositiveFinite(
				height,
				`Day ${dayIndex + 1}の広幅ブロック ${unitIndex + 1}の高さ`,
			);
		});
	});
}

function selectLayoutVariant(
	measurement: PlayfulRouteMeasurement,
): PlayfulRouteLayoutVariant {
	const selectedHeights = measurement.days.flatMap((day) =>
		day.selectedBlockHeights.map((height, unitIndex) => ({
			height,
			unitIndex,
		})),
	);
	if (
		selectedHeights.every(({ height, unitIndex }) =>
			unitIndex === 0
				? height <= measurement.firstBodyHeight
				: height <= measurement.continuationBodyHeight,
		)
	) {
		return "selected";
	}
	if (
		selectedHeights.every(
			({ height }) => height <= measurement.continuationBodyHeight,
		)
	) {
		return "compact-header";
	}
	const hasDistinctWideCandidate =
		Math.abs(measurement.selectedBlockWidth - measurement.wideBlockWidth) >
		Number.EPSILON;
	if (
		hasDistinctWideCandidate &&
		measurement.days
			.flatMap((day) => day.wideBlockHeights)
			.every((height) => height <= measurement.continuationBodyHeight)
	) {
		return "wide-ribbon";
	}
	throw new PaginationError(
		"unit-overflow",
		"図解の予定ブロックが1ページに収まりません。",
	);
}

export function paginatePlayfulRoute(
	booklet: EditorialBooklet,
	measurement: PlayfulRouteMeasurement,
): readonly PlayfulRoutePagePlan[] {
	if (booklet.days.length === 0) {
		return Object.freeze([
			{ kind: "cover", pageId: `playful-route-cover-${booklet.journeyId}` },
		]);
	}
	validateMeasurement(booklet, measurement);
	const layoutVariant = selectLayoutVariant(measurement);
	const pages: PlayfulRoutePagePlan[] = [
		{ kind: "cover", pageId: `playful-route-cover-${booklet.journeyId}` },
	];

	booklet.days.forEach((day, dayIndex) => {
		const measuredDay = measurement.days[dayIndex];
		if (!measuredDay) {
			throw new PaginationError(
				"invalid-measurement",
				`Day ${dayIndex + 1}のブロック計測結果がありません。`,
			);
		}
		const blockHeights =
			layoutVariant === "wide-ribbon"
				? measuredDay.wideBlockHeights
				: measuredDay.selectedBlockHeights;
		let continuation = false;
		let blockHeightsMm: number[] = [];
		let unitIndexes: number[] = [];
		let usedHeight = 0;
		const appendPage = () => {
			pages.push({
				blockHeightsMm: Object.freeze([...blockHeightsMm]),
				continuation,
				dayIndex,
				kind: "day",
				layoutVariant,
				pageId: `playful-route-day-${day.id}-${pages.length}`,
				unitIndexes: Object.freeze([...unitIndexes]),
			});
		};

		if (blockHeights.length === 0) {
			appendPage();
			return;
		}

		blockHeights.forEach((height, unitIndex) => {
			const capacity =
				layoutVariant === "selected" && !continuation
					? measurement.firstBodyHeight
					: measurement.continuationBodyHeight;
			const gap = unitIndexes.length === 0 ? 0 : measurement.blockGap;
			if (usedHeight + gap + height > capacity) {
				appendPage();
				continuation = true;
				unitIndexes = [];
				blockHeightsMm = [];
				usedHeight = 0;
			}
			const nextGap = unitIndexes.length === 0 ? 0 : measurement.blockGap;
			unitIndexes.push(unitIndex);
			blockHeightsMm.push(height);
			usedHeight += nextGap + height;
		});
		appendPage();
	});

	return Object.freeze(pages);
}
