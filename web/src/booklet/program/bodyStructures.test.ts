import { describe, expect, it } from "vitest";
import { scriptedRandom } from "../../theme/composition/compositionTestKit";
import {
	bodyStructureFor,
	maxUnitsPerPage,
	policyForScene,
} from "./bodyStructures";
import { compiledProgram } from "./programTestKit";

describe("bodyStructureFor", () => {
	it("正常系: 各moduleの標準本文を返し、既存familyの本体はnull", () => {
		const woodcut = compiledProgram(["vintage-journal"]).scenes[1];
		const atlas = compiledProgram(["travel-note"]).scenes[1];
		if (!woodcut || !atlas) throw new Error("scene");
		expect(bodyStructureFor(woodcut)).toMatchObject({
			id: "full-width-list",
			textWidthMm: 128,
		});
		expect(bodyStructureFor(atlas)).toBeNull();
	});

	it("正常系: 移植された構造は元moduleのpolicyを持ち込む", () => {
		// travel-note (atlas-grid) with map's concept route transplanted into a day.
		const program = compiledProgram(
			["travel-note", "map"],
			undefined,
			scriptedRandom({
				choices: { direction: 0.9, operation: 0.9, scope: 0 },
				steps: 1,
			}),
		);
		const day = program.scenes.find(
			(scene) => scene.kind === "day" && scene.config.contentStructure,
		);
		if (!day) throw new Error("content structure was not adopted");
		expect(policyForScene(day)).toBe("route");
		expect(bodyStructureFor(day, 124)).toMatchObject({
			headerMm: 36,
			id: "concept-route",
			maxUnitsPerPage: 8,
			textWidthMm: 124,
		});
	});

	it("境界値系: schematic-mapは本文構造によらず8ノードで分ける", () => {
		const map = compiledProgram(["map"]).scenes[1];
		if (!map) throw new Error("scene");
		expect(maxUnitsPerPage(map)).toBe(8);
	});
});
