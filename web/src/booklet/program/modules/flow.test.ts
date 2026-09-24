import { describe, expect, it } from "vitest";
import { PaginationError } from "../../paginationError";
import { flowPageUnitIndexes, flowUnits } from "./flow";

const base = {
	continuationCapacityMm: 100,
	firstCapacityMm: 60,
	gapMm: 3,
};

function pagesOf(heights: readonly number[], columns = 1, max?: number) {
	return flowUnits(
		{ ...base, unitHeightsMm: heights },
		{ columns, maxUnitsPerPage: max },
	).map((page) => ({
		columns: page.columns.map((column) => [...column]),
		continuation: page.continuation,
	}));
}

describe("flowUnits", () => {
	it("正常系: 入力順に詰め、初頁の容量を超えた単位から継続頁へ送る", () => {
		expect(pagesOf([20, 20, 20, 30])).toEqual([
			{ columns: [[0, 1]], continuation: false },
			{ columns: [[2, 3]], continuation: true },
		]);
	});

	it("正常系: 2列では左列の上から下、次に右列へ詰め、後続の小さい単位を先取りしない", () => {
		const pages = flowUnits(
			{ ...base, unitHeightsMm: [40, 30, 10, 50] },
			{ columns: 2 },
		);
		expect(pages[0]?.columns).toEqual([[0], [1, 2]]);
		expect(pages[1]?.columns).toEqual([[3], []]);
		expect(pages.flatMap(flowPageUnitIndexes)).toEqual([0, 1, 2, 3]);
	});

	it("境界値系: 使用高+間隔+単位高が容量と同値なら同じ列に収める", () => {
		// 20 + 3 + 37 = 60
		expect(pagesOf([20, 37])).toEqual([
			{ columns: [[0, 1]], continuation: false },
		]);
	});

	it("境界値系: 容量を1px(0.265mm)超えると次頁へ送る", () => {
		expect(pagesOf([20, 37 + 25.4 / 96])).toEqual([
			{ columns: [[0]], continuation: false },
			{ columns: [[1]], continuation: true },
		]);
	});

	it("境界値系: 初頁に収まらず継続に収まる先頭単位は、空の初頁を残して継続へ送る", () => {
		expect(pagesOf([80, 10])).toEqual([
			{ columns: [[]], continuation: false },
			{ columns: [[0, 1]], continuation: true },
		]);
	});

	it("境界値系: 8ノード制約は高さより先に頁を分ける", () => {
		const pages = pagesOf(Array(9).fill(1), 1, 8);
		expect(pages.map((page) => page.columns[0]?.length)).toEqual([8, 1]);
	});

	it("境界値系: 空日は単位のない初頁一枚だけで、空の継続頁を作らない", () => {
		expect(pagesOf([])).toEqual([{ columns: [[]], continuation: false }]);
	});

	it("異常系: 継続頁の一列にも入らない単位はunit-overflow", () => {
		expect(() => pagesOf([100.01])).toThrow(
			expect.objectContaining({ code: "unit-overflow" }),
		);
	});

	it("異常系: NaN・負値・0の高さはinvalid-measurement", () => {
		for (const height of [Number.NaN, -1, 0]) {
			try {
				pagesOf([height]);
				expect.unreachable();
			} catch (error) {
				expect(error).toBeInstanceOf(PaginationError);
				expect((error as PaginationError).code).toBe("invalid-measurement");
			}
		}
	});

	it("異常系: 容量・列数・最大数が不正ならinvalid-measurement", () => {
		expect(() =>
			flowUnits(
				{ ...base, firstCapacityMm: 0, unitHeightsMm: [1] },
				{ columns: 1 },
			),
		).toThrow(expect.objectContaining({ code: "invalid-measurement" }));
		expect(() =>
			flowUnits({ ...base, unitHeightsMm: [1] }, { columns: 0 }),
		).toThrow(expect.objectContaining({ code: "invalid-measurement" }));
		expect(() =>
			flowUnits(
				{ ...base, unitHeightsMm: [1] },
				{ columns: 1, maxUnitsPerPage: 0 },
			),
		).toThrow(expect.objectContaining({ code: "invalid-measurement" }));
	});
});
