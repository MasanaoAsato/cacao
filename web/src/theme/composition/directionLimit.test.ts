import { describe, expect, it } from "vitest";
import { compileBooklet, productionCompositionCatalog } from "./compileBooklet";
import { fullTestCatalog, testModel } from "./compositionTestKit";
import { parseDirectionLimit } from "./directionLimit";

describe("direction limit", () => {
	it("正常系: 未指定は1方向、指定された正の整数はそのまま使う", () => {
		expect(parseDirectionLimit(undefined)).toBe(1);
		expect(parseDirectionLimit("1")).toBe(1);
		expect(parseDirectionLimit("2")).toBe(2);
		expect(parseDirectionLimit("52")).toBe(52);
		expect(productionCompositionCatalog().maxDirections).toBe(
			parseDirectionLimit(import.meta.env.VITE_BOOKLET_MAX_DIRECTIONS),
		);
	});

	it("正常系: 上限1で配信するとどのseedも1方向で止まる", () => {
		if (productionCompositionCatalog().maxDirections !== 1) return;
		const model = testModel();
		const catalog = { ...fullTestCatalog(), maxDirections: 1 };
		for (let value = 0; value < 32; value += 1) {
			const result = compileBooklet(
				model,
				{ seed: { value, version: "v2" } },
				catalog,
			);
			expect(result.status).toBe("compiled");
			if (result.status !== "compiled") continue;
			expect(result.trace.effectiveDirectionIds).toHaveLength(1);
			expect(result.trace.stopReason).toBe("max-directions");
		}
	});

	it("異常系・境界値系: 空・小数・0・安全な整数超過を拒否する", () => {
		for (const raw of [
			"",
			"0",
			"-1",
			"1.5",
			"1e2",
			"02",
			" 2",
			"9007199254740992",
		]) {
			expect(() => parseDirectionLimit(raw)).toThrow(
				/VITE_BOOKLET_MAX_DIRECTIONS/,
			);
		}
		expect(parseDirectionLimit(String(Number.MAX_SAFE_INTEGER))).toBe(
			Number.MAX_SAFE_INTEGER,
		);
	});
});
