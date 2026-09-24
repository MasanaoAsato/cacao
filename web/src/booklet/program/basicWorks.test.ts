import { describe, expect, it } from "vitest";
import { testDay, testModel } from "../../theme/composition/compositionTestKit";
import { BASIC_WORK_IDS, basicWorkProgram } from "./basicWorks";
import { programComparisonKey } from "./programKeys";
import { buildSceneSpecs } from "./sceneSpec";
import { programIssues } from "./validateProgram";

const meta = { catalogRevision: "test-revision", seed: "v2-00000001" };

describe("basicWorkProgram", () => {
	it("正常系: 四作例とも表紙と全予定を入力順に持つ正しいprogram", () => {
		const model = testModel();
		for (const workId of BASIC_WORK_IDS) {
			const program = basicWorkProgram(workId, model, meta);
			expect(programIssues(program, model)).toEqual([]);
			expect(() => buildSceneSpecs(program, model)).not.toThrow();
		}
		const keys = BASIC_WORK_IDS.map((workId) =>
			programComparisonKey(basicWorkProgram(workId, model, meta)),
		);
		expect(new Set(keys).size).toBe(4);
	});

	it("正常系: 章変化は日ごとにwoodcut・rail・specimen・playful-popを循環する", () => {
		const model = testModel({
			days: [
				testDay("d1", 1, ["09:00"]),
				testDay("d2", 2, ["09:00"]),
				testDay("d3", 3, ["09:00"]),
				testDay("d4", 4, ["09:00"]),
				testDay("d5", 5, ["09:00"]),
			],
		});
		const program = basicWorkProgram("changing-chapters", model, meta);
		expect(
			program.scenes.map((scene) => [
				scene.moduleId,
				"styleProfileId" in scene.config ? scene.config.styleProfileId : null,
			]),
		).toEqual([
			["woodcut-folio", null],
			["woodcut-folio", null],
			["atlas-grid", null],
			["specimen-board", null],
			["playful-route", "playful-route.playful-pop"],
			["woodcut-folio", null],
		]);
	});

	it("境界値系: 日0件は表紙だけ、日が少なければ存在する日だけを描く", () => {
		const empty = testModel({ days: [] });
		const program = basicWorkProgram("changing-chapters", empty, meta);
		expect(program.scenes.map((scene) => scene.kind)).toEqual(["cover"]);
		expect(programIssues(program, empty)).toEqual([]);
	});
});
