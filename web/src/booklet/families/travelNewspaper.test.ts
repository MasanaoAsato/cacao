import { describe, expect, it } from "vitest";
import { styleProfileFor } from "../../theme/families/styleProfiles";
import type {
	EditorialArrivalUnit,
	EditorialBooklet,
	EditorialDay,
} from "../editorialModel";
import { PaginationError } from "../paginate";
import {
	paginateTravelNewspaper,
	TRAVEL_NEWSPAPER_ARTICLE_GAP_MM,
	TRAVEL_NEWSPAPER_ARTICLE_START_Y_MM,
	TRAVEL_NEWSPAPER_COLUMN_GAP_MM,
	TRAVEL_NEWSPAPER_CONTINUATION_START_Y_MM,
	TRAVEL_NEWSPAPER_PAGE_BOTTOM_Y_MM,
	type TravelNewspaperMeasurements,
} from "./travelNewspaper";

const profile = styleProfileFor("travel-newspaper.classic-travel");

function unit(id: string): EditorialArrivalUnit {
	return {
		description: null,
		durationMinutes: id.endsWith("1") ? 35 : null,
		id,
		legId: `leg-${id}`,
		route: null,
		spotId: `spot-${id}`,
		spotName: `訪問先 ${id}`,
		startAt: "2026-09-16T09:00:00+09:00",
		stayCost: null,
		timeLabel: "09:00",
		transportCost: null,
		transportMode: id.endsWith("1") ? "train" : null,
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
		policyId: "timetable",
	};
}

function measurement(
	days: readonly EditorialDay[],
	heights: readonly number[] = days.flatMap((item) => item.units.map(() => 40)),
): TravelNewspaperMeasurements {
	return {
		articleGapMm: TRAVEL_NEWSPAPER_ARTICLE_GAP_MM,
		articleStartYmm: TRAVEL_NEWSPAPER_ARTICLE_START_Y_MM,
		columnGapMm: TRAVEL_NEWSPAPER_COLUMN_GAP_MM,
		continuationHeaderHeightMm: 18,
		continuationStartYmm: TRAVEL_NEWSPAPER_CONTINUATION_START_Y_MM,
		coverTitleHeightMm: 20,
		dayHeaderHeightMm: 58,
		pageBottomYmm: TRAVEL_NEWSPAPER_PAGE_BOTTOM_Y_MM,
		styleProfileId: profile.id,
		unitHeightsMm: new Map(
			days
				.flatMap((item) => item.units)
				.map((item, index) => [item.id, heights[index] ?? 40]),
		),
	};
}

describe("paginateTravelNewspaper", () => {
	it("正常系: 記事を左段から右段へ時系列で分割する", () => {
		const days = [day(1, 6), day(2, 1)];
		const pages = paginateTravelNewspaper(
			booklet(days),
			measurement(days),
			profile,
		);

		expect(pages).toEqual([
			{ kind: "cover", pageId: "travel-newspaper-cover-journey-1" },
			{
				dayIndex: 0,
				kind: "articles",
				pageId: "travel-newspaper-articles-day-1-1",
				unitIndexes: [0, 1, 2, 3, 4, 5],
			},
			{
				dayIndex: 1,
				kind: "articles",
				pageId: "travel-newspaper-articles-day-2-2",
				unitIndexes: [0],
			},
		]);
	});

	it("異常系: 作風不一致はinvalid-measurementになる", () => {
		const days = [day(1, 1)];
		expect(() =>
			paginateTravelNewspaper(
				booklet(days),
				{ ...measurement(days), styleProfileId: "other" },
				profile,
			),
		).toThrowError(expect.objectContaining({ code: "invalid-measurement" }));
	});

	it("異常系: 継続容量を超える単位を拒否する", () => {
		const days = [day(1, 1)];
		expect(() =>
			paginateTravelNewspaper(booklet(days), measurement(days, [167]), profile),
		).toThrowError(expect.objectContaining({ code: "unit-overflow" }));
	});

	it("異常系: 固定寸法が異なる計測結果を拒否する", () => {
		const days = [day(1, 1)];
		expect(() =>
			paginateTravelNewspaper(
				booklet(days),
				{ ...measurement(days), articleStartYmm: 67 },
				profile,
			),
		).toThrowError(expect.objectContaining({ code: "invalid-measurement" }));
	});

	it("境界値: 通常容量と段間隔を含む高さに等しい記事を収める", () => {
		const days = [day(1, 2)];
		const pages = paginateTravelNewspaper(
			booklet(days),
			measurement(days, [60, 64]),
			profile,
		);
		expect(pages[1]).toMatchObject({
			kind: "articles",
			unitIndexes: [0, 1],
		});
	});

	it("境界値: 通常容量を超える先頭記事は空の記事ページから継続する", () => {
		const days = [day(1, 1)];
		const pages = paginateTravelNewspaper(
			booklet(days),
			measurement(days, [129]),
			profile,
		);
		expect(pages.slice(1)).toEqual([
			{
				dayIndex: 0,
				kind: "articles",
				pageId: "travel-newspaper-articles-day-1-1",
				unitIndexes: [],
			},
			{
				dayIndex: 0,
				kind: "continuation",
				pageId: "travel-newspaper-continuation-day-1-2",
				unitIndexes: [0],
			},
		]);
	});

	it("境界値: 継続容量から記事間隔を差し引いた単位は収容する", () => {
		const days = [day(1, 1)];
		const pages = paginateTravelNewspaper(
			booklet(days),
			measurement(days, [166]),
			profile,
		);
		expect(pages[2]).toMatchObject({
			kind: "continuation",
			unitIndexes: [0],
		});
	});

	it("境界値: 予定0件の日と日0件を扱う", () => {
		const emptyDay = [day(1, 0)];
		expect(
			paginateTravelNewspaper(
				booklet(emptyDay),
				measurement(emptyDay),
				profile,
			),
		).toEqual([
			{ kind: "cover", pageId: "travel-newspaper-cover-journey-1" },
			{
				dayIndex: 0,
				kind: "articles",
				pageId: "travel-newspaper-articles-day-1-1",
				unitIndexes: [],
			},
		]);
		expect(
			paginateTravelNewspaper(
				booklet([]),
				{
					articleGapMm: 0,
					articleStartYmm: 0,
					columnGapMm: 0,
					continuationHeaderHeightMm: 0,
					continuationStartYmm: 0,
					coverTitleHeightMm: 0,
					dayHeaderHeightMm: 0,
					pageBottomYmm: 0,
					styleProfileId: "invalid",
					unitHeightsMm: new Map(),
				},
				profile,
			),
		).toEqual([{ kind: "cover", pageId: "travel-newspaper-cover-journey-1" }]);
	});

	it("異常系: 計測mapに単位がなければPaginationErrorを返す", () => {
		const days = [day(1, 1)];
		expect(() =>
			paginateTravelNewspaper(
				booklet(days),
				{ ...measurement(days), unitHeightsMm: new Map() },
				profile,
			),
		).toThrow(PaginationError);
	});
});
