import { describe, expect, it } from "vitest";
import type {
	EditorialArrivalUnit,
	EditorialBooklet,
	EditorialDay,
} from "../editorialModel";
import { PaginationError } from "../paginate";
import {
	type PaperCollageMeasurement,
	paginatePaperCollage,
} from "./paperCollage";

function unit(id: string): EditorialArrivalUnit {
	return {
		description: id.endsWith("1") ? "短い説明" : null,
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
	narrowHeight = 40,
	wideHeight = 30,
): PaperCollageMeasurement {
	return {
		cardGap: 5,
		continuationBodyHeight: 172,
		days: days.map((item) => ({
			narrowCardHeights: item.units.map(() => narrowHeight),
			wideCardHeights: item.units.map(() => wideHeight),
		})),
		firstBodyHeight: 146,
	};
}

describe("paginatePaperCollage", () => {
	it("正常系: 2列を列優先で詰め、日が変わると新しいページにする", () => {
		const days = [day(1, 7), day(2, 1)];
		const pages = paginatePaperCollage(booklet(days), measurement(days));

		expect(pages).toEqual([
			{ kind: "cover", pageId: "paper-collage-cover-journey-1" },
			{
				columns: [
					[0, 1, 2],
					[3, 4, 5],
				],
				continuation: false,
				dayIndex: 0,
				kind: "day",
				layoutVariant: "selected",
				pageId: "paper-collage-day-day-1-1",
			},
			{
				columns: [[6], []],
				continuation: true,
				dayIndex: 0,
				kind: "day",
				layoutVariant: "selected",
				pageId: "paper-collage-day-day-1-2",
			},
			{
				columns: [[0], []],
				continuation: false,
				dayIndex: 1,
				kind: "day",
				layoutVariant: "selected",
				pageId: "paper-collage-day-day-2-3",
			},
		]);
	});

	it("異常系: 1列構図でも収まらないカードを拒否する", () => {
		const days = [day(1, 1)];
		const measured = measurement(days, 180, 173);

		expect(() => paginatePaperCollage(booklet(days), measured)).toThrow(
			PaginationError,
		);
	});

	it("境界値: 先頭容量にちょうど収まるカードはselectedを保つ", () => {
		const days = [day(1, 1)];
		const pages = paginatePaperCollage(booklet(days), measurement(days, 146));

		expect(pages[1]).toMatchObject({ layoutVariant: "selected" });
	});

	it("境界値: 先頭容量だけを超えるカードはcompact-headerへ退避する", () => {
		const days = [day(1, 1)];
		const pages = paginatePaperCollage(booklet(days), measurement(days, 147));

		expect(pages[1]).toMatchObject({ layoutVariant: "compact-header" });
	});

	it("境界値: 狭幅で継続容量を超えるカードはwide-cardsへ退避する", () => {
		const days = [day(1, 2)];
		const pages = paginatePaperCollage(
			booklet(days),
			measurement(days, 173, 80),
		);

		expect(pages[1]).toMatchObject({
			columns: [[0, 1]],
			layoutVariant: "wide-cards",
		});
	});

	it("境界値: 空の日も日見出し用の1ページを作る", () => {
		const days = [day(1, 0)];
		const pages = paginatePaperCollage(booklet(days), measurement(days));

		expect(pages[1]).toMatchObject({
			columns: [[], []],
			continuation: false,
			dayIndex: 0,
		});
	});
});
