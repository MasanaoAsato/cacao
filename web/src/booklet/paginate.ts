import type { BookletModel, BookletPagePlan } from "./model";

export type DayPageMeasurement = {
	readonly continuationHeaderHeight: number;
	readonly headerHeight: number;
	readonly unitHeights: readonly number[];
};

export type BookletPageMeasurement = {
	readonly contentHeight: number;
	readonly contentWidth: number;
	readonly coverHeight: number;
	readonly coverWidth: number;
	readonly days: readonly DayPageMeasurement[];
};

export type RecoverableBookletFailureCode =
	| "cover-inline-overflow"
	| "cover-block-overflow"
	| "day-header-overflow"
	| "unit-overflow"
	| "text-inline-overflow"
	| "text-block-overflow"
	| "page-inline-overflow"
	| "page-block-overflow";

export class PaginationError extends Error {
	readonly code: RecoverableBookletFailureCode | "invalid-measurement";

	constructor(
		code: RecoverableBookletFailureCode | "invalid-measurement",
		message: string,
	) {
		super(message);
		this.code = code;
		this.name = "PaginationError";
	}
}

export function isRecoverableBookletFailure(error: unknown): boolean {
	return (
		error instanceof PaginationError && error.code !== "invalid-measurement"
	);
}

function requireNonNegativeFinite(value: number, name: string): number {
	if (!Number.isFinite(value) || value < 0) {
		throw new PaginationError("invalid-measurement", `${name}が不正です。`);
	}
	return value;
}

function requirePositiveFinite(value: number, name: string): number {
	if (!Number.isFinite(value) || value <= 0) {
		throw new PaginationError("invalid-measurement", `${name}が不正です。`);
	}
	return value;
}

function validateMeasurement(
	model: BookletModel,
	measurement: BookletPageMeasurement,
): void {
	requirePositiveFinite(measurement.contentHeight, "ページ本文高さ");
	requirePositiveFinite(measurement.contentWidth, "ページ本文幅");
	requireNonNegativeFinite(measurement.coverHeight, "表紙高さ");
	requireNonNegativeFinite(measurement.coverWidth, "表紙幅");
	if (measurement.days.length !== model.days.length) {
		throw new PaginationError(
			"invalid-measurement",
			"日ごとの計測結果の件数が一致しません。",
		);
	}
	measurement.days.forEach((dayMeasurement, dayIndex) => {
		requireNonNegativeFinite(
			dayMeasurement.headerHeight,
			`Day ${dayIndex + 1}のヘッダー高さ`,
		);
		requireNonNegativeFinite(
			dayMeasurement.continuationHeaderHeight,
			`Day ${dayIndex + 1}の継続ヘッダー高さ`,
		);
		if (
			dayMeasurement.unitHeights.length !== model.days[dayIndex]?.units.length
		) {
			throw new PaginationError(
				"invalid-measurement",
				`Day ${dayIndex + 1}のSpot計測結果の件数が一致しません。`,
			);
		}
		dayMeasurement.unitHeights.forEach((height, unitIndex) => {
			requireNonNegativeFinite(
				height,
				`Day ${dayIndex + 1}のSpot ${unitIndex + 1}の高さ`,
			);
		});
	});
}

function ensureFits(
	value: number,
	available: number,
	code: RecoverableBookletFailureCode,
	name: string,
): void {
	if (value > available) {
		throw new PaginationError(code, `${name}が1ページに収まりません。`);
	}
}

export function paginateBooklet(
	model: BookletModel,
	measurement: BookletPageMeasurement,
): readonly BookletPagePlan[] {
	validateMeasurement(model, measurement);
	ensureFits(
		measurement.coverWidth,
		measurement.contentWidth,
		"cover-inline-overflow",
		"表紙の横幅",
	);
	ensureFits(
		measurement.coverHeight,
		measurement.contentHeight,
		"cover-block-overflow",
		"表紙の縦幅",
	);

	const pages: BookletPagePlan[] = [
		{ kind: "cover", pageId: `cover-${model.journeyId}` },
	];
	model.days.forEach((day, dayIndex) => {
		const dayMeasurement = measurement.days[dayIndex];
		if (!dayMeasurement) {
			throw new PaginationError(
				"invalid-measurement",
				`days[${dayIndex}]の計測結果がありません。`,
			);
		}

		let continuation = false;
		let headerHeight = dayMeasurement.headerHeight;
		let usedHeight = headerHeight;
		let unitIndexes: number[] = [];
		ensureFits(
			headerHeight,
			measurement.contentHeight,
			"day-header-overflow",
			`Day ${dayIndex + 1}のヘッダー`,
		);

		const appendPage = () => {
			pages.push({
				continuation,
				dayIndex,
				kind: "day",
				pageId: `day-${day.id}-${pages.length + 1}`,
				unitIndexes,
			});
		};

		for (const [unitIndex] of day.units.entries()) {
			const unitHeight = dayMeasurement.unitHeights[unitIndex];
			if (unitHeight === undefined) {
				throw new PaginationError(
					"invalid-measurement",
					`Day ${dayIndex + 1}のSpot計測結果がありません。`,
				);
			}
			ensureFits(
				headerHeight + unitHeight,
				measurement.contentHeight,
				"unit-overflow",
				`Day ${dayIndex + 1}のSpot ${unitIndex + 1}`,
			);
			if (usedHeight + unitHeight > measurement.contentHeight) {
				if (unitIndexes.length === 0) {
					throw new PaginationError(
						"unit-overflow",
						`Day ${dayIndex + 1}のSpot ${unitIndex + 1}が収まりません。`,
					);
				}
				appendPage();
				continuation = true;
				headerHeight = dayMeasurement.continuationHeaderHeight;
				ensureFits(
					headerHeight + unitHeight,
					measurement.contentHeight,
					"unit-overflow",
					`Day ${dayIndex + 1}の継続Spot ${unitIndex + 1}`,
				);
				usedHeight = headerHeight;
				unitIndexes = [];
			}
			unitIndexes.push(unitIndex);
			usedHeight += unitHeight;
		}
		appendPage();
	});
	return Object.freeze(pages);
}
