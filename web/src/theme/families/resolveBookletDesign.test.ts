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
		const legacyRequested = {
			...requested,
			recipe: { ...requested.recipe, moodId: "postcard" as const },
		};
		const design = resolveBookletDesign(legacyRequested);

		expect(design.comparisonKey).toBe(designKey(legacyRequested.recipe));
		expect(design.renderKey).toBe(
			`legacy:${legacyRequested.seedToken}:legacy-full:${design.comparisonKey}`,
		);
	});

	it("境界値: 表示書体を持たないテーマではnullを必要書体へ含めない", () => {
		const requested = createBookletTheme({ value: 0, version: "v2" });
		const legacyRequested = {
			...requested,
			recipe: {
				...requested.recipe,
				displayFontId: "inherit" as const,
				moodId: "postcard" as const,
			},
		};
		const design = resolveBookletDesign(legacyRequested);

		expect(design.fontFamilies).toEqual(
			getFontPairFamilies(legacyRequested.recipe.fontPairId),
		);
	});

	it("正常系: atlas-gridの素材・書体・掲載方針を解決する", () => {
		const requested = createBookletTheme({ value: 7, version: "v2" });
		const design = resolveBookletDesign({
			...requested,
			recipe: { ...requested.recipe, moodId: "wayfinder" },
		});

		expect(design).toMatchObject({
			decorAssetIds: ["atlas-compass", "atlas-route-mark", "atlas-perforation"],
			familyId: "atlas-grid",
			fontFamilies: ["Zen Kaku Gothic New", "Noto Sans JP"],
			policyId: "timetable",
		});
	});

	it("正常系: paper-collageの素材・書体・掲載方針を解決する", () => {
		const requested = createBookletTheme({ value: 7, version: "v2" });
		const design = resolveBookletDesign({
			...requested,
			recipe: { ...requested.recipe, moodId: "field-notes" },
		});

		expect(design).toMatchObject({
			decorAssetIds: [
				"paper-torn-sheet",
				"paper-tape",
				"paper-leaf",
				"paper-postage",
			],
			familyId: "paper-collage",
			fontFamilies: ["Kaisei Decol", "Noto Serif JP", "Noto Sans JP"],
			policyId: "captions",
		});
	});
});
