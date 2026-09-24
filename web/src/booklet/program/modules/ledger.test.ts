import { describe, expect, it } from "vitest";
import {
	bodyMeasurement,
	compiledProgram,
	moduleSpec,
	specsFor,
} from "../programTestKit";
import { paginateLedgerScene } from "./ledger";

const specs = specsFor(compiledProgram(["rail"]));

describe("paginateLedgerScene", () => {
	it("正常系: 列見出しの下142mmへ行間2mmで詰め、継続も同じ", () => {
		const spec = moduleSpec(specs, "day:d1", "ledger");
		// 70 + 2 + 70 = 142 fits exactly.
		const plan = paginateLedgerScene(spec, bodyMeasurement(spec, 70, 128));
		expect(plan.pages.map((page) => page.unitIds.length)).toEqual([2, 2]);
	});

	it("異常系: 142mmを超える行はunit-overflow", () => {
		const spec = moduleSpec(specs, "day:d2", "ledger");
		expect(() =>
			paginateLedgerScene(spec, bodyMeasurement(spec, 142.1, 128)),
		).toThrow(expect.objectContaining({ code: "unit-overflow" }));
	});

	it("異常系: 負の計測値はinvalid-measurement", () => {
		const spec = moduleSpec(specs, "day:d2", "ledger");
		expect(() =>
			paginateLedgerScene(spec, bodyMeasurement(spec, -1, 128)),
		).toThrow(expect.objectContaining({ code: "invalid-measurement" }));
	});
});
