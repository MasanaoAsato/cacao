import type { EditorialBooklet } from "../editorialModel";
import { PaginationError } from "../paginationError";

export const EDITORIAL_MAGAZINE_ARTICLE_START_Y_MM = 80;
export const EDITORIAL_MAGAZINE_CONTINUATION_START_Y_MM = 30;
export const EDITORIAL_MAGAZINE_PAGE_BOTTOM_Y_MM = 200;
export const EDITORIAL_MAGAZINE_CARD_GAP_MM = 3;
export const EDITORIAL_MAGAZINE_ARTICLE_CAPACITY_MM =
	EDITORIAL_MAGAZINE_PAGE_BOTTOM_Y_MM - EDITORIAL_MAGAZINE_ARTICLE_START_Y_MM;
export const EDITORIAL_MAGAZINE_CONTINUATION_CAPACITY_MM =
	EDITORIAL_MAGAZINE_PAGE_BOTTOM_Y_MM -
	EDITORIAL_MAGAZINE_CONTINUATION_START_Y_MM;

export type EditorialMagazineMeasurements = {
	readonly unitHeightsMm: ReadonlyMap<string, number>;
	readonly articleHeaderHeightMm: number;
	readonly continuationHeaderHeightMm: number;
	readonly articleStartYmm: number;
	readonly continuationStartYmm: number;
	readonly pageBottomYmm: number;
	readonly cardGapMm: number;
};

export type EditorialMagazineCoverPagePlan = {
	readonly kind: "cover";
	readonly pageId: string;
};

export type EditorialMagazineArticlePagePlan = {
	readonly dayIndex: number;
	readonly kind: "article";
	readonly pageId: string;
	readonly unitIndexes: readonly number[];
};

export type EditorialMagazineContinuationPagePlan = {
	readonly dayIndex: number;
	readonly kind: "continuation";
	readonly pageId: string;
	readonly unitIndexes: readonly number[];
};

export type EditorialMagazinePagePlan =
	| EditorialMagazineCoverPagePlan
	| EditorialMagazineArticlePagePlan
	| EditorialMagazineContinuationPagePlan;

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

/** Day geometry and unit heights of the scene's day. */
function validateMeasurement(
	booklet: EditorialBooklet,
	measurement: EditorialMagazineMeasurements,
): void {
	requireNonNegativeFinite(
		measurement.articleHeaderHeightMm,
		"記事ヘッダーの高さ",
	);
	requireNonNegativeFinite(
		measurement.continuationHeaderHeightMm,
		"継続ヘッダーの高さ",
	);
	if (
		measurement.articleHeaderHeightMm > EDITORIAL_MAGAZINE_ARTICLE_START_Y_MM
	) {
		throw new PaginationError(
			"invalid-measurement",
			"記事ヘッダーが予約領域を超えています。",
		);
	}
	if (
		measurement.continuationHeaderHeightMm >
		EDITORIAL_MAGAZINE_CONTINUATION_START_Y_MM
	) {
		throw new PaginationError(
			"invalid-measurement",
			"継続ヘッダーが予約領域を超えています。",
		);
	}
	requireFixedMeasurement(
		measurement.articleStartYmm,
		EDITORIAL_MAGAZINE_ARTICLE_START_Y_MM,
		"記事領域の開始位置",
	);
	requireFixedMeasurement(
		measurement.continuationStartYmm,
		EDITORIAL_MAGAZINE_CONTINUATION_START_Y_MM,
		"継続領域の開始位置",
	);
	requireFixedMeasurement(
		measurement.pageBottomYmm,
		EDITORIAL_MAGAZINE_PAGE_BOTTOM_Y_MM,
		"ページ下端",
	);
	requireFixedMeasurement(
		measurement.cardGapMm,
		EDITORIAL_MAGAZINE_CARD_GAP_MM,
		"カード間隔",
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
			if (height > EDITORIAL_MAGAZINE_CONTINUATION_CAPACITY_MM) {
				throw new PaginationError(
					"unit-overflow",
					`単位「${unit.id}」が継続ページに収まりません。`,
				);
			}
		}
	}
}

function pageId(
	kind: "article" | "continuation",
	dayId: string,
	ordinal: number,
): string {
	return `editorial-magazine-${kind}-${dayId}-${ordinal}`;
}

function freezePage(
	page:
		| EditorialMagazineArticlePagePlan
		| EditorialMagazineContinuationPagePlan,
): EditorialMagazinePagePlan {
	return Object.freeze({
		...page,
		unitIndexes: Object.freeze([...page.unitIndexes]),
	});
}

/**
 * Splits whole article cards into A5 pages using measured card heights.
 * The candidate DOM and this function intentionally share only the measurement
 * contract; this function never reads layout from the browser.
 * A program scene calls it with its single day (25.4).
 */
export function paginateEditorialMagazineDays(
	booklet: EditorialBooklet,
	measurement: EditorialMagazineMeasurements,
): readonly EditorialMagazinePagePlan[] {
	validateMeasurement(booklet, measurement);
	const pages: EditorialMagazinePagePlan[] = [];
	let ordinal = 1;

	for (const [dayIndex, day] of booklet.days.entries()) {
		if (day.units.length === 0) {
			pages.push(
				freezePage({
					dayIndex,
					kind: "article",
					pageId: pageId("article", day.id, ordinal),
					unitIndexes: [],
				}),
			);
			ordinal += 1;
			continue;
		}

		let kind: "article" | "continuation" = "article";
		let unitIndexes: number[] = [];
		let usedHeight = 0;
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
				kind === "article"
					? EDITORIAL_MAGAZINE_ARTICLE_CAPACITY_MM
					: EDITORIAL_MAGAZINE_CONTINUATION_CAPACITY_MM;
			const gap = unitIndexes.length === 0 ? 0 : measurement.cardGapMm;
			if (usedHeight + gap + height <= capacity) {
				unitIndexes.push(unitIndex);
				usedHeight += gap + height;
				continue;
			}

			if (kind === "article") {
				// A first card may be too tall for the article area but still fit
				// on a continuation page; retain the article header page.
				appendPage();
				kind = "continuation";
			} else {
				appendPage();
			}

			const continuationGap =
				unitIndexes.length === 0 ? 0 : measurement.cardGapMm;
			if (
				continuationGap + height >
				EDITORIAL_MAGAZINE_CONTINUATION_CAPACITY_MM
			) {
				throw new PaginationError(
					"unit-overflow",
					`単位「${unit.id}」が継続ページに収まりません。`,
				);
			}
			unitIndexes.push(unitIndex);
			usedHeight = continuationGap + height;
		}
		if (unitIndexes.length > 0) {
			appendPage();
		}
	}

	return Object.freeze(pages);
}
