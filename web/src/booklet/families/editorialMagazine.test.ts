import { describe, expect, it } from "vitest";
import { styleProfileFor } from "../../theme/families/styleProfiles";
import type {
	EditorialArrivalUnit,
	EditorialBooklet,
	EditorialDay,
} from "../editorialModel";
import { PaginationError } from "../paginate";
import {
	EDITORIAL_MAGAZINE_ARTICLE_START_Y_MM,
	EDITORIAL_MAGAZINE_CARD_GAP_MM,
	EDITORIAL_MAGAZINE_CONTINUATION_START_Y_MM,
	EDITORIAL_MAGAZINE_PAGE_BOTTOM_Y_MM,
	type EditorialMagazineMeasurements,
	paginateEditorialMagazine,
} from "./editorialMagazine";

const profile = styleProfileFor("editorial-magazine.quiet-photo");

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
		coverTitleHeightMm: 20,
		pageBottomYmm: EDITORIAL_MAGAZINE_PAGE_BOTTOM_Y_MM,
		styleProfileId: profile.id,
		unitHeightsMm: new Map(
			days
				.flatMap((item) => item.units)
				.map((item, index) => [item.id, heights[index] ?? 40]),
		),
	};
}

describe("paginateEditorialMagazine", () => {
	it("正常系: 日ごとの記事カードを順序どおり分割する", () => {
		const days = [day(1, 4), day(2, 1)];
		const pages = paginateEditorialMagazine(
			booklet(days),
			measurement(days),
			profile,
		);

		expect(pages).toEqual([
			{ kind: "cover", pageId: "editorial-magazine-cover-journey-1" },
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

	it("異常系: 作風不一致はinvalid-measurementになる", () => {
		const days = [day(1, 1)];
		expect(() =>
			paginateEditorialMagazine(
				booklet(days),
				{ ...measurement(days), styleProfileId: "other" },
				profile,
			),
		).toThrowError(expect.objectContaining({ code: "invalid-measurement" }));
	});

	it("異常系: 継続容量を超える単位を拒否する", () => {
		const days = [day(1, 1)];
		expect(() =>
			paginateEditorialMagazine(
				booklet(days),
				measurement(days, [171]),
				profile,
			),
		).toThrowError(expect.objectContaining({ code: "unit-overflow" }));
	});

	it("異常系: 固定の計測寸法が異なる場合は拒否する", () => {
		const days = [day(1, 1)];
		expect(() =>
			paginateEditorialMagazine(
				booklet(days),
				{ ...measurement(days), articleStartYmm: 79 },
				profile,
			),
		).toThrowError(expect.objectContaining({ code: "invalid-measurement" }));
	});

	it("異常系: 予約高さを超える表紙題名を拒否する", () => {
		const days = [day(1, 1)];
		expect(() =>
			paginateEditorialMagazine(
				booklet(days),
				{ ...measurement(days), coverTitleHeightMm: 24.1 },
				profile,
			),
		).toThrowError(expect.objectContaining({ code: "unit-overflow" }));
	});

	it("境界値: 予約高さ24mmに等しい表紙題名を許容する", () => {
		const days = [day(1, 1)];
		expect(
			paginateEditorialMagazine(
				booklet(days),
				{ ...measurement(days), coverTitleHeightMm: 24 },
				profile,
			),
		).toHaveLength(2);
	});

	it("境界値: 通常容量に等しいカードは記事ページに収める", () => {
		const days = [day(1, 1)];
		const pages = paginateEditorialMagazine(
			booklet(days),
			measurement(days, [120]),
			profile,
		);
		expect(pages[1]).toMatchObject({
			kind: "article",
			unitIndexes: [0],
		});
	});

	it("境界値: 通常容量を超えて継続容量に収まる先頭カードは記事ページを空けて継続する", () => {
		const days = [day(1, 1)];
		const pages = paginateEditorialMagazine(
			booklet(days),
			measurement(days, [121]),
			profile,
		);
		expect(pages.slice(1)).toEqual([
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

	it("境界値: 予定0件の日は記事ページを1枚作る", () => {
		const days = [day(1, 0)];
		expect(
			paginateEditorialMagazine(booklet(days), measurement(days), profile),
		).toEqual([
			{ kind: "cover", pageId: "editorial-magazine-cover-journey-1" },
			{
				dayIndex: 0,
				kind: "article",
				pageId: "editorial-magazine-article-day-1-1",
				unitIndexes: [],
			},
		]);
	});

	it("境界値: 日が0件なら表紙だけを返す", () => {
		expect(
			paginateEditorialMagazine(
				booklet([]),
				{
					articleHeaderHeightMm: 0,
					articleStartYmm: 0,
					cardGapMm: 0,
					continuationHeaderHeightMm: 0,
					continuationStartYmm: 0,
					coverTitleHeightMm: 0,
					pageBottomYmm: 0,
					styleProfileId: "invalid",
					unitHeightsMm: new Map(),
				},
				profile,
			),
		).toEqual([
			{ kind: "cover", pageId: "editorial-magazine-cover-journey-1" },
		]);
	});

	it("異常系: PaginationErrorを保持する", () => {
		const measured = measurement([day(1, 1)]);
		expect(() =>
			paginateEditorialMagazine(
				booklet([day(1, 1)]),
				{ ...measured, unitHeightsMm: new Map() },
				profile,
			),
		).toThrow(PaginationError);
	});
});
