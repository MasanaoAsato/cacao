import type { BookletModel, BookletPagePlan } from "./model";

export type DayPageMeasurement = {
	readonly continuationHeaderHeight: number;
	readonly headerHeight: number;
	readonly headerHeightWithoutIllustration: number;
	readonly unitHeights: readonly number[];
};

export type BookletPageMeasurement = {
	/** Unit columns per page. The day header spans the full width above them. */
	readonly columns?: 1 | 2;
	readonly contentHeight: number;
	readonly contentWidth: number;
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
	const columns = measurement.columns ?? 1;
	if (columns !== 1 && columns !== 2) {
		throw new PaginationError("invalid-measurement", "列数が不正です。");
	}
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
			dayMeasurement.headerHeightWithoutIllustration,
			`Day ${dayIndex + 1}の挿絵なしヘッダー高さ`,
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

/**
 * Greedy pagination. Units are stacked into the column below the day header;
 * when a column is full the next column of the same page is filled, and when
 * every column is full a continuation page starts. The visual order of units
 * therefore equals the data order, column by column, page by page.
 */
export function paginateBooklet(
	model: BookletModel,
	measurement: BookletPageMeasurement,
): readonly BookletPagePlan[] {
	validateMeasurement(model, measurement);
	const columns = measurement.columns ?? 1;

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
		let illustration = day.illustration !== null;
		let headerHeight = illustration
			? dayMeasurement.headerHeight
			: dayMeasurement.headerHeightWithoutIllustration;
		let columnIndex = 0;
		let usedHeight = 0;
		let unitIndexes: number[] = [];
		if (headerHeight > measurement.contentHeight && illustration) {
			illustration = false;
			headerHeight = dayMeasurement.headerHeightWithoutIllustration;
		}
		ensureFits(
			headerHeight,
			measurement.contentHeight,
			"day-header-overflow",
			`Day ${dayIndex + 1}のヘッダー`,
		);
		const columnCapacity = () => measurement.contentHeight - headerHeight;

		const appendPage = () => {
			pages.push({
				continuation,
				dayIndex,
				illustration: !continuation && illustration,
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
			if (
				unitIndexes.length === 0 &&
				!continuation &&
				illustration &&
				headerHeight + unitHeight > measurement.contentHeight &&
				dayMeasurement.headerHeightWithoutIllustration + unitHeight <=
					measurement.contentHeight
			) {
				illustration = false;
				headerHeight = dayMeasurement.headerHeightWithoutIllustration;
			}
			ensureFits(
				unitHeight,
				columnCapacity(),
				"unit-overflow",
				`Day ${dayIndex + 1}のSpot ${unitIndex + 1}`,
			);
			if (usedHeight + unitHeight > columnCapacity()) {
				if (usedHeight === 0) {
					throw new PaginationError(
						"unit-overflow",
						`Day ${dayIndex + 1}のSpot ${unitIndex + 1}が収まりません。`,
					);
				}
				if (columnIndex + 1 < columns) {
					columnIndex += 1;
				} else {
					appendPage();
					continuation = true;
					headerHeight = dayMeasurement.continuationHeaderHeight;
					ensureFits(
						unitHeight,
						columnCapacity(),
						"unit-overflow",
						`Day ${dayIndex + 1}の継続Spot ${unitIndex + 1}`,
					);
					columnIndex = 0;
					unitIndexes = [];
				}
				usedHeight = 0;
			}
			unitIndexes.push(unitIndex);
			usedHeight += unitHeight;
		}
		appendPage();
	});
	return Object.freeze(pages);
}
