import { describe, expect, it } from "vitest";
import {
	testDay,
	testModel,
} from "../../../theme/composition/compositionTestKit";
import {
	bodyMeasurement,
	compiledProgram,
	moduleSpec,
	specsFor,
} from "../programTestKit";
import { paginateSchematicMapScene } from "./schematicMap";

const times = (count: number) =>
	Array.from(
		{ length: count },
		(_, index) => `${String(8 + index).padStart(2, "0")}:00`,
	);

function mapSpec(unitCount: number) {
	const model = testModel({ days: [testDay("d1", 1, times(unitCount))] });
	return moduleSpec(
		specsFor(compiledProgram(["map"], model), model),
		"day:d1",
		"schematic-map",
	);
}

describe("paginateSchematicMapScene", () => {
	it("境界値系: 8ノードは一頁、9ノードは8と1に分け番号は日内通し", () => {
		const eight = mapSpec(8);
		expect(
			paginateSchematicMapScene(eight, bodyMeasurement(eight, 5, 128)).pages,
		).toHaveLength(1);
		const nine = mapSpec(9);
		const plan = paginateSchematicMapScene(nine, bodyMeasurement(nine, 5, 128));
		expect(plan.pages.map((page) => page.unitIds.length)).toEqual([8, 1]);
		expect(plan.pages[1]).toMatchObject({ firstUnitNumber: 9 });
	});

	it("正常系: 高さでは初頁94mm・継続118mmで分ける（高さと8ノードの小さい方）", () => {
		const spec = mapSpec(4);
		// 45 + 3 + 45 = 93 <= 94; continuation holds 2 more.
		const plan = paginateSchematicMapScene(
			spec,
			bodyMeasurement(spec, 45, 128),
		);
		expect(plan.pages.map((page) => page.unitIds.length)).toEqual([2, 2]);
	});

	it("異常系: 継続本文118mmを超える単位はunit-overflow", () => {
		const spec = mapSpec(1);
		expect(() =>
			paginateSchematicMapScene(spec, bodyMeasurement(spec, 118.5, 128)),
		).toThrow(expect.objectContaining({ code: "unit-overflow" }));
	});
});
