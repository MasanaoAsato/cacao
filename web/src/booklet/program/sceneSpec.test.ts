import { describe, expect, it } from "vitest";
import { testModel } from "../../theme/composition/compositionTestKit";
import { compiledProgram, specById, specsFor } from "./programTestKit";

describe("buildSceneSpecs", () => {
	it("正常系: moduleのpolicyで射影し、sceneの予定範囲だけを所有する", () => {
		const specs = specsFor(compiledProgram(["day-story"]));
		const morning = specById(specs, "day:d1");
		const later = specById(specs, "day:d1:d1-u2");
		expect(morning.content.policyId).toBe("captions");
		expect(morning.content.ownedUnits.map((unit) => unit.id)).toEqual([
			"d1-u0",
			"d1-u1",
		]);
		expect(later.content.firstUnitOffset).toBe(2);
		expect(later.content.day?.units.map((unit) => unit.id)).toEqual(["d1-u2"]);
	});

	it("正常系: 名称・日時・予定順は射影後も保持する", () => {
		const model = testModel();
		const specs = specsFor(compiledProgram(["rail"]), model);
		const day = specById(specs, "day:d1");
		expect(
			day.content.ownedUnits.map((unit) => [unit.spotName, unit.startAt]),
		).toEqual(
			model.days[0]?.units.map((unit) => [unit.spot.name, unit.spot.start_at]),
		);
	});

	it("境界値系: memoは参照だけを持ち、本文の予定を所有しない", () => {
		const specs = specsFor(compiledProgram(["checklist"]));
		const memo = specById(specs, "memo:d1");
		expect(memo.content.ownedUnits).toEqual([]);
		expect(memo.content.referencedUnits).toHaveLength(4);
	});

	it("異常系: styleKeyは見出し・紙面の束が違えば変わる", () => {
		const a = specById(specsFor(compiledProgram(["rail"])), "cover");
		const b = specById(specsFor(compiledProgram(["flight"])), "cover");
		expect(a.styleKey).toBe(b.styleKey);
		const c = specById(specsFor(compiledProgram(["cafe"])), "cover");
		expect(c.styleKey).not.toBe(a.styleKey);
	});
});
