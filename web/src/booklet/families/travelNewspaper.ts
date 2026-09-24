import type { EditorialBooklet } from "../editorialModel";
import { PaginationError } from "../paginationError";

/** The fixed geometry of a travel-newspaper A5 page (21.4). */
export const TRAVEL_NEWSPAPER_ARTICLE_START_Y_MM = 68;
export const TRAVEL_NEWSPAPER_CONTINUATION_START_Y_MM = 30;
export const TRAVEL_NEWSPAPER_PAGE_BOTTOM_Y_MM = 200;
export const TRAVEL_NEWSPAPER_COLUMN_GAP_MM = 10;
export const TRAVEL_NEWSPAPER_ARTICLE_GAP_MM = 4;
export const TRAVEL_NEWSPAPER_ARTICLE_CAPACITY_MM =
	TRAVEL_NEWSPAPER_PAGE_BOTTOM_Y_MM - TRAVEL_NEWSPAPER_ARTICLE_START_Y_MM;
export const TRAVEL_NEWSPAPER_CONTINUATION_CAPACITY_MM =
	TRAVEL_NEWSPAPER_PAGE_BOTTOM_Y_MM - TRAVEL_NEWSPAPER_CONTINUATION_START_Y_MM;

export type TravelNewspaperMeasurements = {
	readonly unitHeightsMm: ReadonlyMap<string, number>;
	readonly dayHeaderHeightMm: number;
	readonly continuationHeaderHeightMm: number;
	readonly articleStartYmm: number;
	readonly continuationStartYmm: number;
	readonly pageBottomYmm: number;
	readonly columnGapMm: number;
	readonly articleGapMm: number;
};

export type TravelNewspaperCoverPagePlan = {
	readonly kind: "cover";
	readonly pageId: string;
};

export type TravelNewspaperArticlesPagePlan = {
	readonly dayIndex: number;
	readonly kind: "articles";
	readonly pageId: string;
	/** Unit indexes are in reading order: left column, then right column. */
	readonly unitIndexes: readonly number[];
};

export type TravelNewspaperContinuationPagePlan = {
	readonly dayIndex: number;
	readonly kind: "continuation";
	readonly pageId: string;
	/** Unit indexes are in reading order: left column, then right column. */
	readonly unitIndexes: readonly number[];
};

export type TravelNewspaperPagePlan =
	| TravelNewspaperCoverPagePlan
	| TravelNewspaperArticlesPagePlan
	| TravelNewspaperContinuationPagePlan;

function requireNonNegativeFinite(value: number, name: string): number {
	if (!Number.isFinite(value) || value < 0) {
		throw new PaginationError("invalid-measurement", `${name}が不正です。`);
	}
	return value;
}

function requireFixedMeasurement(
	value: number,
	expected: number,
	name: string,
): void {
	requireNonNegativeFinite(value, name);
	if (value !== expected) {
		throw new PaginationError(
			"invalid-measurement",
			`${name}は${expected}mmである必要があります。`,
		);
	}
}

/** Day geometry and unit heights of a program scene's days. */
function validateMeasurement(
	booklet: EditorialBooklet,
	measurement: TravelNewspaperMeasurements,
): void {
	requireNonNegativeFinite(measurement.dayHeaderHeightMm, "日付ヘッダーの高さ");
	requireNonNegativeFinite(
		measurement.continuationHeaderHeightMm,
		"継続ヘッダーの高さ",
	);
	if (measurement.dayHeaderHeightMm > TRAVEL_NEWSPAPER_ARTICLE_START_Y_MM) {
		throw new PaginationError(
			"invalid-measurement",
			"日付ヘッダーが予約領域を超えています。",
		);
	}
	if (
		measurement.continuationHeaderHeightMm >
		TRAVEL_NEWSPAPER_CONTINUATION_START_Y_MM
	) {
		throw new PaginationError(
			"invalid-measurement",
			"継続ヘッダーが予約領域を超えています。",
		);
	}
	requireFixedMeasurement(
		measurement.articleStartYmm,
		TRAVEL_NEWSPAPER_ARTICLE_START_Y_MM,
		"記事領域の開始位置",
	);
	requireFixedMeasurement(
		measurement.continuationStartYmm,
		TRAVEL_NEWSPAPER_CONTINUATION_START_Y_MM,
		"継続領域の開始位置",
	);
	requireFixedMeasurement(
		measurement.pageBottomYmm,
		TRAVEL_NEWSPAPER_PAGE_BOTTOM_Y_MM,
		"ページ下端",
	);
	requireFixedMeasurement(
		measurement.columnGapMm,
		TRAVEL_NEWSPAPER_COLUMN_GAP_MM,
		"段間隔",
	);
	requireFixedMeasurement(
		measurement.articleGapMm,
		TRAVEL_NEWSPAPER_ARTICLE_GAP_MM,
		"記事間隔",
	);

	const measuredUnitIds = new Set<string>();
	for (const day of booklet.days) {
		for (const unit of day.units) {
			if (measuredUnitIds.has(unit.id)) {
				throw new PaginationError(
					"invalid-measurement",
					`単位ID「${unit.id}」が重複しています。`,
				);
			}
			measuredUnitIds.add(unit.id);
			const height = measurement.unitHeightsMm.get(unit.id);
			if (height === undefined) {
				throw new PaginationError(
					"invalid-measurement",
					`単位「${unit.id}」の計測結果がありません。`,
				);
			}
			requireNonNegativeFinite(height, `単位「${unit.id}」の高さ`);
			if (
				height + TRAVEL_NEWSPAPER_ARTICLE_GAP_MM >
				TRAVEL_NEWSPAPER_CONTINUATION_CAPACITY_MM
			) {
				throw new PaginationError(
					"unit-overflow",
					`単位「${unit.id}」が継続ページに収まりません。`,
				);
			}
		}
	}
}

function pageId(
	kind: "articles" | "continuation",
	dayId: string,
	ordinal: number,
): string {
	return `travel-newspaper-${kind}-${dayId}-${ordinal}`;
}

function freezePage(
	page: TravelNewspaperArticlesPagePlan | TravelNewspaperContinuationPagePlan,
): TravelNewspaperPagePlan {
	return Object.freeze({
		...page,
		unitIndexes: Object.freeze([...page.unitIndexes]),
	});
}

/**
 * Splits complete article units into two newspaper columns and A5 pages.
 * Heights come from the candidate DOM; this function never reads layout.
 * A program scene calls it with its single day (25.4).
 */
export function paginateTravelNewspaperDays(
	booklet: EditorialBooklet,
	measurement: TravelNewspaperMeasurements,
): readonly TravelNewspaperPagePlan[] {
	validateMeasurement(booklet, measurement);
	const pages: TravelNewspaperPagePlan[] = [];
	let ordinal = 1;

	for (const [dayIndex, day] of booklet.days.entries()) {
		if (day.units.length === 0) {
			pages.push(
				freezePage({
					dayIndex,
					kind: "articles",
					pageId: pageId("articles", day.id, ordinal),
					unitIndexes: [],
				}),
			);
			ordinal += 1;
			continue;
		}

		let kind: "articles" | "continuation" = "articles";
		let unitIndexes: number[] = [];
		let usedHeight = 0;
		let columnIndex = 0;
		const appendPage = () => {
			pages.push(
				freezePage({
					dayIndex,
					kind,
					pageId: pageId(kind, day.id, ordinal),
					unitIndexes,
				}),
			);
			ordinal += 1;
			unitIndexes = [];
			usedHeight = 0;
			columnIndex = 0;
		};

		for (const [unitIndex, unit] of day.units.entries()) {
			const height = measurement.unitHeightsMm.get(unit.id);
			if (height === undefined) {
				throw new PaginationError(
					"invalid-measurement",
					`単位「${unit.id}」の計測結果がありません。`,
				);
			}
			const capacity =
				kind === "articles"
					? TRAVEL_NEWSPAPER_ARTICLE_CAPACITY_MM
					: TRAVEL_NEWSPAPER_CONTINUATION_CAPACITY_MM;
			const articleHeight = measurement.articleGapMm + height;
			if (usedHeight + articleHeight <= capacity) {
				unitIndexes.push(unitIndex);
				usedHeight += articleHeight;
				continue;
			}

			if (columnIndex === 0) {
				// The first column is full; the next unit starts at the top of the
				// right column on the same page.
				columnIndex = 1;
				usedHeight = 0;
				if (articleHeight <= capacity) {
					unitIndexes.push(unitIndex);
					usedHeight = articleHeight;
					continue;
				}
			}

			if (kind === "articles") {
				// Preserve the day header/illustration page even when the first
				// unit only fits in the taller continuation area.
				if (unitIndexes.length > 0) {
					appendPage();
				} else {
					pages.push(
						freezePage({
							dayIndex,
							kind: "articles",
							pageId: pageId("articles", day.id, ordinal),
							unitIndexes: [],
						}),
					);
					ordinal += 1;
				}
				kind = "continuation";
				unitIndexes = [];
				usedHeight = 0;
				columnIndex = 0;
			} else {
				appendPage();
			}

			const continuationHeight = measurement.articleGapMm + height;
			if (continuationHeight > TRAVEL_NEWSPAPER_CONTINUATION_CAPACITY_MM) {
				throw new PaginationError(
					"unit-overflow",
					`単位「${unit.id}」が継続ページに収まりません。`,
				);
			}
			unitIndexes.push(unitIndex);
			usedHeight = continuationHeight;
		}
		if (unitIndexes.length > 0) {
			appendPage();
		}
	}

	return Object.freeze(pages);
}
