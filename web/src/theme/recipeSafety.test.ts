import { describe, expect, it } from "vitest";
import {
	createBookletTheme,
	getThemeCandidates,
	THEME_CATALOG_REFERENCES,
} from "./bookletTheme";
import { defineThemeRecipe, ThemeRecipeValidationError } from "./recipeSafety";
import type { CoverLayoutDefinition, ThemeCatalogReferences } from "./types";

function selectedRecipe() {
	return createBookletTheme({ value: 7, version: "v2" }).recipe;
}

function referencesWithCover(
	override: Partial<CoverLayoutDefinition>,
): ThemeCatalogReferences {
	const cover = THEME_CATALOG_REFERENCES.coverLayouts.get("north-west");
	if (!cover) {
		throw new Error("north-west構図がありません。");
	}
	return {
		...THEME_CATALOG_REFERENCES,
		coverLayouts: new Map(THEME_CATALOG_REFERENCES.coverLayouts).set(
			"north-west",
			{ ...cover, ...override },
		),
	};
}

describe("テーマレシピの静的安全性", () => {
	it("正常系: 解決済みのV2テーマから収まり確認候補を作る", () => {
		const requested = createBookletTheme({ value: 7, version: "v2" });
		const candidates = getThemeCandidates(requested);
		expect(candidates.length).toBeGreaterThanOrEqual(2);
		expect(candidates.length).toBeLessThanOrEqual(4);
		expect(candidates[0]?.fallbackStep).toBe("selected");
		expect(candidates.at(-1)?.fallbackStep).toBe("safe-geometry");
		expect(candidates.at(-1)?.displayFontId).toBe("inherit");
	});

	it("異常系: safe-coverを通常レシピとして定義できない", () => {
		expect(() =>
			defineThemeRecipe(
				{ ...selectedRecipe(), coverLayoutId: "safe-cover" },
				THEME_CATALOG_REFERENCES,
			),
		).toThrow(ThemeRecipeValidationError);
	});

	it("境界値系: 表紙タイトルの22〜56ptを受理する", () => {
		for (const titleSizePt of [22, 56]) {
			expect(() =>
				defineThemeRecipe(
					{ ...selectedRecipe(), coverLayoutId: "north-west" },
					referencesWithCover({ titleSizePt }),
				),
			).not.toThrow();
		}
	});

	it("異常系: 表紙紙面とcoverInkの薄いコントラストを拒否する", () => {
		const palette = THEME_CATALOG_REFERENCES.palettes.get("paper-ink");
		if (!palette) {
			throw new Error("paper-ink配色がありません。");
		}
		const references: ThemeCatalogReferences = {
			...THEME_CATALOG_REFERENCES,
			palettes: new Map(THEME_CATALOG_REFERENCES.palettes).set("paper-ink", {
				...palette,
				surfaceStops: [palette.coverInk, palette.coverInk],
			}),
		};
		expect(() =>
			defineThemeRecipe(
				{ ...selectedRecipe(), paletteId: "paper-ink" },
				references,
			),
		).toThrow(ThemeRecipeValidationError);
	});
});
