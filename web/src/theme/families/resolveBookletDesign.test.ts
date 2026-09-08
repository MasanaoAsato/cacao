import { describe, expect, it } from "vitest";
import { createBookletTheme, getFontPairFamilies } from "../bookletTheme";
import { designKey } from "../resolve";
import { resolveBookletDesign } from "./resolveBookletDesign";

describe("resolveBookletDesign", () => {
	it("正常系: 同じv2シードから同じlegacy設計を解決する", () => {
		const requested = createBookletTheme({ value: 7, version: "v2" });

		expect(resolveBookletDesign(requested)).toEqual(
			resolveBookletDesign(requested),
		);
	});

	it("異常系: 未登録moodは系統の解決時に拒否される", () => {
		const requested = createBookletTheme({ value: 7, version: "v2" });
		const invalid = {
			...requested,
			recipe: { ...requested.recipe, moodId: "unknown" },
		};

		expect(() => resolveBookletDesign(invalid as typeof requested)).toThrow(
			"系統が登録されていません",
		);
	});

	it("境界値: legacyの比較キーは既存designKeyを維持する", () => {
		const requested = createBookletTheme({ value: 0, version: "v2" });
		const design = resolveBookletDesign(requested);

		expect(design.comparisonKey).toBe(designKey(requested.recipe));
		expect(design.renderKey).toBe(
			`legacy:${requested.seedToken}:legacy-full:${design.comparisonKey}`,
		);
	});

	it("境界値: 表示書体を持たないテーマではnullを必要書体へ含めない", () => {
		const requested = createBookletTheme({ value: 0, version: "v2" });
		const design = resolveBookletDesign({
			...requested,
			recipe: { ...requested.recipe, displayFontId: "inherit" },
		});

		expect(design.fontFamilies).toEqual(
			getFontPairFamilies(requested.recipe.fontPairId),
		);
	});
});
