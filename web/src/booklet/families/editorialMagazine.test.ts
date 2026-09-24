import { describe, expect, it } from "vitest";
import type {
	EditorialArrivalUnit,
	EditorialBooklet,
	EditorialDay,
} from "../editorialModel";
import { PaginationError } from "../paginationError";
import {
	EDITORIAL_MAGAZINE_ARTICLE_START_Y_MM,
	EDITORIAL_MAGAZINE_CARD_GAP_MM,
	EDITORIAL_MAGAZINE_CONTINUATION_START_Y_MM,
	EDITORIAL_MAGAZINE_PAGE_BOTTOM_Y_MM,
	type EditorialMagazineMeasurements,
	paginateEditorialMagazineDays,
} from "./editorialMagazine";

function unit(id: string): EditorialArrivalUnit {
	return {
		description: id.endsWith("1") ? "説明。" : null,
		durationMinutes: null,
		id,
		legId: `leg-${id}`,
		route: null,
		spotId: `spot-${id}`,
		spotName: `訪問先 ${id}`,
		startAt: "2026-09-16T09:00:00+09:00",
		stayCost: null,
		timeLabel: "09:00",
		transportCost: null,
		transportMode: null,
	};
}

function day(dayNumber: number, unitCount: number): EditorialDay {
	return {
		date: `2026-09-${15 + dayNumber}`,
		dayNumber,
		id: `day-${dayNumber}`,
		illustration: null,
		units: Array.from({ length: unitCount }, (_value, index) =>
			unit(`${dayNumber}-${index + 1}`),
		),
	};
}

function booklet(days: readonly EditorialDay[]): EditorialBooklet {
	return {
		cover: {
			budget: null,
			image: {
				contentUrl: "/cover.png",
				height: 1200,
				mediaType: "image/png",
				visualStyle: null,
				width: 800,
			},
			period: {
				end_date: "2026-09-18T00:00:00+09:00",
				start_date: "2026-09-16T00:00:00+09:00",
			},
			route: null,
			title: "金沢",
		},
		days,
		journeyId: "journey-1",
		policyId: "captions",
	};
}

function measurement(
	days: readonly EditorialDay[],
	heights: readonly number[] = days.flatMap((item) => item.units.map(() => 40)),
): EditorialMagazineMeasurements {
	return {
		articleHeaderHeightMm: 16,
		articleStartYmm: EDITORIAL_MAGAZINE_ARTICLE_START_Y_MM,
		cardGapMm: EDITORIAL_MAGAZINE_CARD_GAP_MM,
		continuationHeaderHeightMm: 12,
		continuationStartYmm: EDITORIAL_MAGAZINE_CONTINUATION_START_Y_MM,
		pageBottomYmm: EDITORIAL_MAGAZINE_PAGE_BOTTOM_Y_MM,
		unitHeightsMm: new Map(
			days
				.flatMap((item) => item.units)
				.map((item, index) => [item.id, heights[index] ?? 40]),
		),
	};
}

describe("paginateEditorialMagazineDays", () => {
	it("正常系: 日ごとの記事カードを順序どおり分割する", () => {
		const days = [day(1, 4), day(2, 1)];
		const pages = paginateEditorialMagazineDays(
			booklet(days),
			measurement(days),
		);

		expect(pages).toEqual([
			{
				dayIndex: 0,
				kind: "article",
				pageId: "editorial-magazine-article-day-1-1",
				unitIndexes: [0, 1],
			},
			{
				dayIndex: 0,
				kind: "continuation",
				pageId: "editorial-magazine-continuation-day-1-2",
				unitIndexes: [2, 3],
			},
			{
				dayIndex: 1,
				kind: "article",
				pageId: "editorial-magazine-article-day-2-3",
				unitIndexes: [0],
			},
		]);
	});

	it("正常系: 継続ページに収まらないカードは次の継続ページへ送る", () => {
		const days = [day(1, 3)];
		const pages = paginateEditorialMagazineDays(
			booklet(days),
			measurement(days, [100, 160, 160]),
		);

		expect(pages).toEqual([
			{
				dayIndex: 0,
				kind: "article",
				pageId: "editorial-magazine-article-day-1-1",
				unitIndexes: [0],
			},
			{
				dayIndex: 0,
				kind: "continuation",
				pageId: "editorial-magazine-continuation-day-1-2",
				unitIndexes: [1],
			},
			{
				dayIndex: 0,
				kind: "continuation",
				pageId: "editorial-magazine-continuation-day-1-3",
				unitIndexes: [2],
			},
		]);
	});

	it("正常系: 返すページ計画は変更できない", () => {
		const days = [day(1, 1)];
		const pages = paginateEditorialMagazineDays(
			booklet(days),
			measurement(days),
		);

		expect(Object.isFrozen(pages)).toBe(true);
		const page = pages[0];
		if (!page || page.kind === "cover")
			throw new Error("記事ページがありません。");
		expect(Object.isFrozen(page)).toBe(true);
		expect(Object.isFrozen(page.unitIndexes)).toBe(true);
	});

	it("異常系: 継続容量を超える単位を拒否する", () => {
		const days = [day(1, 1)];
		expect(() =>
			paginateEditorialMagazineDays(booklet(days), measurement(days, [171])),
		).toThrowError(expect.objectContaining({ code: "unit-overflow" }));
	});

	it("異常系: 固定の計測寸法が異なる場合は拒否する", () => {
		const days = [day(1, 1)];
		expect(() =>
			paginateEditorialMagazineDays(booklet(days), {
				...measurement(days),
				articleStartYmm: 79,
			}),
		).toThrowError(expect.objectContaining({ code: "invalid-measurement" }));
	});

	it("異常系: 予約領域を超える記事ヘッダーを拒否する", () => {
		const days = [day(1, 1)];
		expect(() =>
			paginateEditorialMagazineDays(booklet(days), {
				...measurement(days),
				articleHeaderHeightMm: 80.1,
			}),
		).toThrowError(expect.objectContaining({ code: "invalid-measurement" }));
	});

	it("異常系: 単位の計測がなければPaginationErrorになる", () => {
		const measured = measurement([day(1, 1)]);
		expect(() =>
			paginateEditorialMagazineDays(booklet([day(1, 1)]), {
				...measured,
				unitHeightsMm: new Map(),
			}),
		).toThrow(PaginationError);
	});

	it("境界値系: 通常容量に等しいカードは記事ページに収める", () => {
		const days = [day(1, 1)];
		const pages = paginateEditorialMagazineDays(
			booklet(days),
			measurement(days, [120]),
		);
		expect(pages).toHaveLength(1);
		expect(pages[0]).toMatchObject({
			kind: "article",
			unitIndexes: [0],
		});
	});

	it("境界値系: 通常容量を超えて継続容量に収まる先頭カードは記事ページを空けて継続する", () => {
		const days = [day(1, 1)];
		const pages = paginateEditorialMagazineDays(
			booklet(days),
			measurement(days, [121]),
		);
		expect(pages).toEqual([
			{
				dayIndex: 0,
				kind: "article",
				pageId: "editorial-magazine-article-day-1-1",
				unitIndexes: [],
			},
			{
				dayIndex: 0,
				kind: "continuation",
				pageId: "editorial-magazine-continuation-day-1-2",
				unitIndexes: [0],
			},
		]);
	});

	it("境界値系: 継続容量170mmに等しい単位は許容する", () => {
		const days = [day(1, 1)];
		expect(
			paginateEditorialMagazineDays(booklet(days), measurement(days, [170])),
		).toMatchObject([
			{ kind: "article", unitIndexes: [] },
			{ kind: "continuation", unitIndexes: [0] },
		]);
	});

	it("境界値系: 予定0件の日は記事ページを1枚作る", () => {
		const days = [day(1, 0)];
		expect(
			paginateEditorialMagazineDays(booklet(days), measurement(days)),
		).toEqual([
			{
				dayIndex: 0,
				kind: "article",
				pageId: "editorial-magazine-article-day-1-1",
				unitIndexes: [],
			},
		]);
	});
});
