import { describe, expect, it } from "vitest";
import {
	createBookletTheme,
	getBookletThemeCssVariables,
	selectV1Recipe,
	THEME_RECIPES_V1,
	V1_REPRESENTATIVE_SEEDS,
} from "./bookletTheme";

describe("V1テーマカタログ", () => {
	it("正常系: 24件の代表シードが固定レシピへ解決される", () => {
		expect(THEME_RECIPES_V1).toHaveLength(24);
		for (const [seedValue, recipeId] of V1_REPRESENTATIVE_SEEDS) {
			expect(selectV1Recipe({ value: seedValue, version: "v1" }).id).toBe(
				recipeId,
			);
		}
	});

	it("正常系: テーマのCSS変数は閉じたカタログ値だけを返す", () => {
		const theme = createBookletTheme({ value: 7, version: "v1" });
		expect(
			getBookletThemeCssVariables({
				...theme.recipe,
				fallbackStep: "selected",
				requestedRecipeId: theme.recipe.id,
				resolvedThemeKey: "v1-00000007:selected",
			}),
		).toMatchObject({
			"--booklet-background": "#F7F2E8",
			"--booklet-cover-ink": "#1D1B18",
			"--booklet-cover-veil": "#FFFFFF",
			"--booklet-cover-veil-opacity": "0.36",
			"--booklet-cover-title-size-long": "27.2pt",
			"--booklet-cover-title-size-very-long": "22pt",
			"--booklet-text": "#1D1B18",
		});
	});

	it("境界値系: 同じシードは同じ要求テーマを返す", () => {
		expect(createBookletTheme({ value: 0, version: "v1" })).toEqual(
			createBookletTheme({ value: 0, version: "v1" }),
		);
	});
});
