import { describe, expect, it } from "vitest";
import {
	bodyMeasurement,
	compiledProgram,
	moduleSpec,
	specsFor,
} from "../programTestKit";
import { paginateQuestBoardScene } from "./questBoard";

describe("paginateQuestBoardScene", () => {
	it("正常系: 押印欄24mmとpadding4mmを引いた96mm幅で計測し、予定間4mmで詰める", () => {
		const specs = specsFor(compiledProgram(["stamp"]));
		const spec = moduleSpec(specs, "day:d1", "quest-board");
		// 50 + 4 + 50 = 104 <= 108.
		const plan = paginateQuestBoardScene(spec, bodyMeasurement(spec, 50, 96));
		expect(plan.pages.map((page) => page.unitIds.length)).toEqual([2, 2]);
	});

	it("異常系: 欄を引かずに計測した幅はinvalid-measurement", () => {
		const specs = specsFor(compiledProgram(["stamp"]));
		const spec = moduleSpec(specs, "day:d1", "quest-board");
		expect(() =>
			paginateQuestBoardScene(spec, bodyMeasurement(spec, 10, 120)),
		).toThrow(expect.objectContaining({ code: "invalid-measurement" }));
	});

	it("境界値系: 欄のない参加なしの面は120mm幅", () => {
		const specs = specsFor(compiledProgram(["cards"]));
		const spec = moduleSpec(specs, "day:d2", "quest-board");
		expect(
			paginateQuestBoardScene(spec, bodyMeasurement(spec, 108, 120)).pages,
		).toHaveLength(1);
	});
});
