import { describe, expect, it } from "vitest";
import type {
	EditorialArrivalUnit,
	EditorialBooklet,
	EditorialDay,
} from "../editorialModel";
import { PaginationError } from "../paginationError";
import {
	type AtlasGridMeasurement,
	paginateAtlasGridTables,
} from "./atlasGrid";

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
		stayCost: { amount: 1000, currency: "JPY" },
		timeLabel: "09:00",
		transportCost: { amount: 300, currency: "JPY" },
		transportMode: "電車",
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
	bodyHeight = 100,
): AtlasGridMeasurement {
	return {
		bodyHeight,
		days: days.map((item) => ({
			bandHeight: 8,
			emptyRowHeight: 10,
			rowHeights: item.units.map(() => 10),
		})),
	};
}

function paginationFailureOf(run: () => unknown): PaginationError {
	try {
		run();
	} catch (error) {
		if (error instanceof PaginationError) {
			return error;
		}
		throw error;
	}
	throw new Error("PaginationErrorが発生しませんでした。");
}

describe("paginateAtlasGridTables", () => {
	it("正常系: 複数日を空間の許す限り同じページへ順番どおり配置する", () => {
		const days = [day(1, 2), day(2, 2)];
		const pages = paginateAtlasGridTables(booklet(days), measurement(days));

		expect(pages).toEqual([
			{
				kind: "table",
				pageId: "atlas-table-journey-1-1",
				sections: [
					{ continuation: false, dayIndex: 0, unitIndexes: [0, 1] },
					{ continuation: false, dayIndex: 1, unitIndexes: [0, 1] },
				],
			},
		]);
	});

	it("異常系: 日付帯と組にしても収まらない単独行を拒否する", () => {
		const days = [day(1, 1)];
		const measured = measurement(days, 100);
		const error = paginationFailureOf(() =>
			paginateAtlasGridTables(booklet(days), {
				...measured,
				days: [{ bandHeight: 8, emptyRowHeight: 10, rowHeights: [93] }],
			}),
		);

		expect(error.code).toBe("unit-overflow");
	});

	it.each<readonly [string, AtlasGridMeasurement]>([
		[
			"表本体の高さが0",
			{
				bodyHeight: 0,
				days: [{ bandHeight: 8, emptyRowHeight: 10, rowHeights: [10] }],
			},
		],
		[
			"行の高さが非数",
			{
				bodyHeight: 100,
				days: [{ bandHeight: 8, emptyRowHeight: 10, rowHeights: [Number.NaN] }],
			},
		],
		[
			"行計測の件数が不足",
			{
				bodyHeight: 100,
				days: [{ bandHeight: 8, emptyRowHeight: 10, rowHeights: [] }],
			},
		],
		["日の計測が不足", { bodyHeight: 100, days: [] }],
	])("異常系: %sの計測値を拒否する", (_name, measured) => {
		const error = paginationFailureOf(() =>
			paginateAtlasGridTables(booklet([day(1, 1)]), measured),
		);

		expect(error.code).toBe("invalid-measurement");
	});

	it("境界値: 次の日の帯と最初の行がちょうど入る場合は同じページに置く", () => {
		const days = [day(1, 1), day(2, 1)];
		const pages = paginateAtlasGridTables(booklet(days), measurement(days, 36));

		expect(pages).toHaveLength(1);
		expect(pages[0]).toMatchObject({
			sections: [{ dayIndex: 0 }, { dayIndex: 1 }],
		});
	});

	it("境界値: 1px足りなければ日付帯だけを残さず次ページへ送る", () => {
		const days = [day(1, 1), day(2, 1)];
		const pages = paginateAtlasGridTables(booklet(days), measurement(days, 35));

		expect(pages).toHaveLength(2);
		expect(pages[0]).toMatchObject({ sections: [{ dayIndex: 0 }] });
		expect(pages[1]).toMatchObject({ sections: [{ dayIndex: 1 }] });
	});

	it("境界値: 次の行だけが入らない場合は同日の帯を続き付きで再掲する", () => {
		const days = [day(1, 3)];
		const pages = paginateAtlasGridTables(booklet(days), measurement(days, 28));

		expect(pages).toHaveLength(2);
		expect(pages[0]).toMatchObject({
			sections: [{ continuation: false, dayIndex: 0, unitIndexes: [0, 1] }],
		});
		expect(pages[1]).toMatchObject({
			sections: [{ continuation: true, dayIndex: 0, unitIndexes: [2] }],
		});
	});

	it("境界値: 空の日は帯と空行を1組にして配置する", () => {
		const days = [day(1, 0)];
		const pages = paginateAtlasGridTables(booklet(days), measurement(days, 18));

		expect(pages).toEqual([
			{
				kind: "table",
				pageId: "atlas-table-journey-1-1",
				sections: [{ continuation: false, dayIndex: 0, unitIndexes: [] }],
			},
		]);
	});

	it("境界値: 日がなければ表のページを作らない", () => {
		const pages = paginateAtlasGridTables(booklet([]), {
			bodyHeight: 100,
			days: [],
		});

		expect(pages).toEqual([]);
	});
});
