import { describe, expect, it } from "vitest";
import type {
	EditorialArrivalUnit,
	EditorialBooklet,
	EditorialDay,
} from "../editorialModel";
import { PaginationError } from "../paginate";
import {
	type PlayfulRouteMeasurement,
	paginatePlayfulRoute,
} from "./playfulRoute";

function unit(id: string): EditorialArrivalUnit {
	return {
		description: null,
		durationMinutes: 30,
		id,
		legId: `leg-${id}`,
		route: null,
		spotId: `spot-${id}`,
		spotName: `訪問先 ${id}`,
		startAt: "2026-09-16T09:00:00+09:00",
		stayCost: null,
		timeLabel: "09:00",
		transportCost: null,
		transportMode: "train",
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
		policyId: "route",
	};
}

function measurement(
	days: readonly EditorialDay[],
	selectedHeight = 40,
	wideHeight = 30,
	selectedBlockWidth = 104,
): PlayfulRouteMeasurement {
	return {
		blockGap: 8,
		continuationBodyHeight: 158,
		days: days.map((item) => ({
			selectedBlockHeights: item.units.map(() => selectedHeight),
			wideBlockHeights: item.units.map(() => wideHeight),
		})),
		firstBodyHeight: 140,
		selectedBlockWidth,
		wideBlockWidth: 128,
	};
}

describe("paginatePlayfulRoute", () => {
	it("正常系: 元の順で詰め、継続ページでも日内indexを保つ", () => {
		const days = [day(1, 7), day(2, 1)];
		const pages = paginatePlayfulRoute(booklet(days), measurement(days));

		expect(pages).toEqual([
			{ kind: "cover", pageId: "playful-route-cover-journey-1" },
			{
				blockHeightsMm: [40, 40, 40],
				continuation: false,
				dayIndex: 0,
				kind: "day",
				layoutVariant: "selected",
				pageId: "playful-route-day-day-1-1",
				unitIndexes: [0, 1, 2],
			},
			{
				blockHeightsMm: [40, 40, 40],
				continuation: true,
				dayIndex: 0,
				kind: "day",
				layoutVariant: "selected",
				pageId: "playful-route-day-day-1-2",
				unitIndexes: [3, 4, 5],
			},
			{
				blockHeightsMm: [40],
				continuation: true,
				dayIndex: 0,
				kind: "day",
				layoutVariant: "selected",
				pageId: "playful-route-day-day-1-3",
				unitIndexes: [6],
			},
			{
				blockHeightsMm: [40],
				continuation: false,
				dayIndex: 1,
				kind: "day",
				layoutVariant: "selected",
				pageId: "playful-route-day-day-2-4",
				unitIndexes: [0],
			},
		]);
	});

	it("異常系: 最後の候補でも単体超過するブロックを拒否する", () => {
		const days = [day(1, 1)];
		expect(() =>
			paginatePlayfulRoute(booklet(days), measurement(days, 159, 159)),
		).toThrow(PaginationError);
	});

	it("境界値: 先頭容量にちょうど収まる場合はselectedを保つ", () => {
		const days = [day(1, 1)];
		const pages = paginatePlayfulRoute(booklet(days), measurement(days, 140));
		expect(pages[1]).toMatchObject({ layoutVariant: "selected" });
	});

	it("境界値: 先頭容量を1px超える場合はcompact-headerへ退避する", () => {
		const days = [day(1, 1)];
		const pages = paginatePlayfulRoute(booklet(days), measurement(days, 141));
		expect(pages[1]).toMatchObject({ layoutVariant: "compact-header" });
	});

	it("境界値: 2件目が先頭容量を超えても通常の継続ページで収まればselectedを保つ", () => {
		const days = [day(1, 2)];
		const measured = measurement(days);
		const pages = paginatePlayfulRoute(booklet(days), {
			...measured,
			days: [
				{
					selectedBlockHeights: [40, 150],
					wideBlockHeights: [30, 100],
				},
			],
		});

		expect(pages.slice(1)).toEqual([
			expect.objectContaining({
				continuation: false,
				layoutVariant: "selected",
				unitIndexes: [0],
			}),
			expect.objectContaining({
				continuation: true,
				layoutVariant: "selected",
				unitIndexes: [1],
			}),
		]);
	});

	it("境界値: 104mm幅だけが超過する場合はwide-ribbonへ退避する", () => {
		const days = [day(1, 1)];
		const pages = paginatePlayfulRoute(
			booklet(days),
			measurement(days, 159, 100),
		);
		expect(pages[1]).toMatchObject({ layoutVariant: "wide-ribbon" });
	});

	it("境界値: ribbonでは重複するwide-ribbon候補を使わない", () => {
		const days = [day(1, 1)];
		expect(() =>
			paginatePlayfulRoute(booklet(days), measurement(days, 159, 100, 128)),
		).toThrow(PaginationError);
	});

	it("境界値: 空の日も日見出し用のページを作る", () => {
		const days = [day(1, 0)];
		const pages = paginatePlayfulRoute(booklet(days), measurement(days));
		expect(pages[1]).toMatchObject({
			continuation: false,
			dayIndex: 0,
			unitIndexes: [],
		});
	});
});
