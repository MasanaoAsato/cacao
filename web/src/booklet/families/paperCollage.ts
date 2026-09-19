import type { EditorialBooklet } from "../editorialModel";
import { PaginationError } from "../paginate";

export type PaperCollageDayMeasurement = {
	readonly narrowCardHeights: readonly number[];
	readonly wideCardHeights: readonly number[];
};

export type PaperCollageMeasurement = {
	readonly cardGap: number;
	readonly continuationBodyHeight: number;
	readonly days: readonly PaperCollageDayMeasurement[];
	readonly firstBodyHeight: number;
};

export type PaperCollageLayoutVariant =
	| "selected"
	| "compact-header"
	| "wide-cards";

export type PaperCollageCoverPagePlan = {
	readonly kind: "cover";
	readonly pageId: string;
};

export type PaperCollageDayPagePlan = {
	readonly columns: readonly (readonly number[])[];
	readonly continuation: boolean;
	readonly dayIndex: number;
	readonly kind: "day";
	readonly layoutVariant: PaperCollageLayoutVariant;
	readonly pageId: string;
};

export type PaperCollagePagePlan =
	| PaperCollageCoverPagePlan
	| PaperCollageDayPagePlan;

function requirePositiveFinite(value: number, name: string): number {
	if (!Number.isFinite(value) || value <= 0) {
		throw new PaginationError("invalid-measurement", `${name}が不正です。`);
	}
	return value;
}

function validateMeasurement(
	booklet: EditorialBooklet,
	measurement: PaperCollageMeasurement,
): void {
	requirePositiveFinite(measurement.cardGap, "カード間隔");
	requirePositiveFinite(measurement.firstBodyHeight, "先頭ページ本文高さ");
	requirePositiveFinite(
		measurement.continuationBodyHeight,
		"継続ページ本文高さ",
	);
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
			measuredDay.narrowCardHeights.length !== day.units.length ||
			measuredDay.wideCardHeights.length !== day.units.length
		) {
			throw new PaginationError(
				"invalid-measurement",
				`Day ${dayIndex + 1}のカード計測結果の件数が一致しません。`,
			);
		}
		measuredDay.narrowCardHeights.forEach((height, unitIndex) => {
			requirePositiveFinite(
				height,
				`Day ${dayIndex + 1}の狭幅カード ${unitIndex + 1}の高さ`,
			);
		});
		measuredDay.wideCardHeights.forEach((height, unitIndex) => {
			requirePositiveFinite(
				height,
				`Day ${dayIndex + 1}の広幅カード ${unitIndex + 1}の高さ`,
			);
		});
	});
}

function selectLayoutVariant(
	measurement: PaperCollageMeasurement,
): PaperCollageLayoutVariant {
	const narrowHeights = measurement.days.flatMap(
		(day) => day.narrowCardHeights,
	);
	if (narrowHeights.every((height) => height <= measurement.firstBodyHeight)) {
		return "selected";
	}
	if (
		narrowHeights.every(
			(height) => height <= measurement.continuationBodyHeight,
		)
	) {
		return "compact-header";
	}
	const wideHeights = measurement.days.flatMap((day) => day.wideCardHeights);
	if (
		wideHeights.every((height) => height <= measurement.continuationBodyHeight)
	) {
		return "wide-cards";
	}
	throw new PaginationError(
		"unit-overflow",
		"紙のカードが1ページに収まりません。",
	);
}

export function paginatePaperCollage(
	booklet: EditorialBooklet,
	measurement: PaperCollageMeasurement,
): readonly PaperCollagePagePlan[] {
	if (booklet.days.length === 0) {
		return Object.freeze([
			{ kind: "cover", pageId: `paper-collage-cover-${booklet.journeyId}` },
		]);
	}
	validateMeasurement(booklet, measurement);
	const layoutVariant = selectLayoutVariant(measurement);
	const columnCount = layoutVariant === "wide-cards" ? 1 : 2;
	const pages: PaperCollagePagePlan[] = [
		{ kind: "cover", pageId: `paper-collage-cover-${booklet.journeyId}` },
	];

	booklet.days.forEach((day, dayIndex) => {
		const measuredDay = measurement.days[dayIndex];
		if (!measuredDay) {
			throw new PaginationError(
				"invalid-measurement",
				`Day ${dayIndex + 1}のカード計測結果がありません。`,
			);
		}
		const cardHeights =
			layoutVariant === "wide-cards"
				? measuredDay.wideCardHeights
				: measuredDay.narrowCardHeights;
		let continuation = false;
		let columns: number[][] = Array.from({ length: columnCount }, () => []);
		let columnIndex = 0;
		let usedHeight = 0;
		const appendPage = () => {
			pages.push({
				columns: Object.freeze(
					columns.map((column) => Object.freeze([...column])),
				),
				continuation,
				dayIndex,
				kind: "day",
				layoutVariant,
				pageId: `paper-collage-day-${day.id}-${pages.length}`,
			});
		};

		if (cardHeights.length === 0) {
			appendPage();
			return;
		}

		cardHeights.forEach((height, unitIndex) => {
			const capacity =
				layoutVariant === "selected" && !continuation
					? measurement.firstBodyHeight
					: measurement.continuationBodyHeight;
			const gap = columns[columnIndex]?.length === 0 ? 0 : measurement.cardGap;
			if (usedHeight + gap + height > capacity) {
				if (columnIndex + 1 < columnCount) {
					columnIndex += 1;
					usedHeight = 0;
				} else {
					appendPage();
					continuation = true;
					columns = Array.from({ length: columnCount }, () => []);
					columnIndex = 0;
					usedHeight = 0;
				}
			}
			const nextGap =
				columns[columnIndex]?.length === 0 ? 0 : measurement.cardGap;
			columns[columnIndex]?.push(unitIndex);
			usedHeight += nextGap + height;
		});
		appendPage();
	});

	return Object.freeze(pages);
}
