import { describe, expect, it } from "vitest";
import { scriptedRandom } from "../../theme/composition/compositionTestKit";
import { programComparisonKey, programRenderKey } from "./programKeys";
import { compiledProgram } from "./programTestKit";

describe("programComparisonKey / programRenderKey", () => {
	it("正常系: 同じprogramは同じキー。objectの列挙順に依存しない", () => {
		const program = compiledProgram(["vintage-journal"]);
		const reordered = {
			seed: program.seed,
			scenes: program.scenes.map((scene) => ({
				...Object.fromEntries(Object.entries(scene).reverse()),
			})) as unknown as typeof program.scenes,
			catalogRevision: program.catalogRevision,
			baseDirectionId: program.baseDirectionId,
		};
		expect(programComparisonKey(reordered)).toBe(programComparisonKey(program));
		expect(programRenderKey(reordered)).toBe(programRenderKey(program));
	});

	it("正常系: seedはrenderKeyだけを変え、comparisonKeyは変えない", () => {
		const program = compiledProgram(["vintage-journal"]);
		const reseeded = { ...program, seed: "v2-ffffffff" };
		expect(programComparisonKey(reseeded)).toBe(programComparisonKey(program));
		expect(programRenderKey(reseeded)).not.toBe(programRenderKey(program));
	});

	it("異常系: 方向・素材・構成が違えばキーも違う", () => {
		const woodcut = compiledProgram(["vintage-journal"]);
		const other = compiledProgram(["museum"]);
		expect(programComparisonKey(other)).not.toBe(programComparisonKey(woodcut));
		const fused = compiledProgram(
			["vintage-journal", "film"],
			undefined,
			scriptedRandom({ steps: 1 }),
		);
		expect(programComparisonKey(fused)).not.toBe(programComparisonKey(woodcut));
		const swappedArt = {
			...woodcut,
			catalogRevision: "other-revision",
		};
		expect(programComparisonKey(swappedArt)).not.toBe(
			programComparisonKey(woodcut),
		);
	});
});
