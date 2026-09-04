import { describe, expect, it } from "vitest";
import {
	COVER_LAYOUTS,
	createBookletTheme,
	getBookletThemeCssVariables,
	getCoverLayoutDefinition,
	getFontPairFamilies,
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
			"--booklet-itinerary-text": "#1D1B18",
			"--booklet-text": "#1D1B18",
		});
	});

	it("正常系: 表紙構図の定義から文字箱・安全領域・ベールを取得する", () => {
		expect(
			Array.from(COVER_LAYOUTS.values()).map((layout) => ({
				id: layout.id,
				safeArea: layout.safeArea,
				selectable: layout.selectable,
				textBox: layout.textBox,
				veil: layout.veil,
			})),
		).toEqual([
			{
				id: "north-west",
				safeArea: { heightMm: 70, widthMm: 80, xMm: 12, yMm: 12 },
				selectable: true,
				textBox: {
					align: "left",
					anchorX: "left",
					anchorY: "top",
					offsetXMm: 12,
					offsetYMm: 12,
					paddingMm: 0,
					widthMm: 80,
				},
				veil: "radial",
			},
			{
				id: "north-east",
				safeArea: { heightMm: 70, widthMm: 80, xMm: 56, yMm: 12 },
				selectable: true,
				textBox: {
					align: "left",
					anchorX: "right",
					anchorY: "top",
					offsetXMm: 12,
					offsetYMm: 12,
					paddingMm: 0,
					widthMm: 80,
				},
				veil: "radial",
			},
			{
				id: "south-west",
				safeArea: { heightMm: 70, widthMm: 80, xMm: 12, yMm: 128 },
				selectable: true,
				textBox: {
					align: "left",
					anchorX: "left",
					anchorY: "bottom",
					offsetXMm: 12,
					offsetYMm: 12,
					paddingMm: 0,
					widthMm: 80,
				},
				veil: "radial",
			},
			{
				id: "south-east",
				safeArea: { heightMm: 70, widthMm: 80, xMm: 56, yMm: 128 },
				selectable: true,
				textBox: {
					align: "left",
					anchorX: "right",
					anchorY: "bottom",
					offsetXMm: 12,
					offsetYMm: 12,
					paddingMm: 0,
					widthMm: 80,
				},
				veil: "radial",
			},
			{
				id: "center",
				safeArea: { heightMm: 76, widthMm: 104, xMm: 22, yMm: 67 },
				selectable: true,
				textBox: {
					align: "center",
					anchorX: "left",
					anchorY: "top",
					offsetXMm: 22,
					offsetYMm: 67,
					paddingMm: 0,
					widthMm: 104,
				},
				veil: "radial",
			},
			{
				id: "split-left",
				safeArea: { heightMm: 210, widthMm: 70, xMm: 0, yMm: 0 },
				selectable: true,
				textBox: {
					align: "left",
					anchorX: "left",
					anchorY: "top",
					offsetXMm: 12,
					offsetYMm: 12,
					paddingMm: 0,
					widthMm: 46,
				},
				veil: "linear-x",
			},
			{
				id: "horizon",
				safeArea: { heightMm: 62, widthMm: 148, xMm: 0, yMm: 148 },
				selectable: true,
				textBox: {
					align: "left",
					anchorX: "left",
					anchorY: "top",
					offsetXMm: 12,
					offsetYMm: 156,
					paddingMm: 0,
					widthMm: 124,
				},
				veil: "linear-y",
			},
			{
				id: "safe-cover",
				safeArea: { heightMm: 190, widthMm: 128, xMm: 10, yMm: 10 },
				selectable: false,
				textBox: {
					align: "left",
					anchorX: "left",
					anchorY: "top",
					offsetXMm: 22,
					offsetYMm: 22,
					paddingMm: 8,
					widthMm: 104,
				},
				veil: "radial",
			},
		]);
		expect(
			["classic", "literary", "wayfinding", "modern", "round-trip"].map(
				(fontPairId) => getFontPairFamilies(fontPairId),
			),
		).toEqual([
			["Noto Serif JP"],
			["Shippori Mincho", "Noto Sans JP"],
			["Zen Kaku Gothic New", "Noto Sans JP"],
			["Noto Sans JP"],
			["M PLUS Rounded 1c", "Noto Sans JP"],
		]);
	});

	it("境界値系: 最小の安全領域を持つhorizon構図をCSS変数へ変換する", () => {
		const theme = createBookletTheme({ value: 7, version: "v1" });
		const variables = getBookletThemeCssVariables({
			...theme.recipe,
			coverLayoutId: "horizon",
			fallbackStep: "selected",
			requestedRecipeId: theme.recipe.id,
			resolvedThemeKey: "v1-00000007:selected",
		});

		expect(getCoverLayoutDefinition("horizon").safeArea.heightMm).toBe(62);
		expect(variables).toMatchObject({
			"--booklet-cover-text-bottom": "auto",
			"--booklet-cover-text-left": "12mm",
			"--booklet-cover-text-right": "auto",
			"--booklet-cover-text-top": "156mm",
			"--booklet-cover-text-width": "124mm",
		});
	});

	it("正常系: north-east構図を右上のCSS変数へ変換する", () => {
		const theme = createBookletTheme({ value: 7, version: "v1" });
		const variables = getBookletThemeCssVariables({
			...theme.recipe,
			coverLayoutId: "north-east",
			fallbackStep: "selected",
			requestedRecipeId: theme.recipe.id,
			resolvedThemeKey: "v1-00000007:selected",
		});

		expect(variables).toMatchObject({
			"--booklet-cover-text-bottom": "auto",
			"--booklet-cover-text-left": "auto",
			"--booklet-cover-text-right": "12mm",
			"--booklet-cover-text-top": "12mm",
			"--booklet-cover-text-width": "80mm",
		});
	});

	it("正常系: レシピの署名グループが本文テンプレートへ固定される", () => {
		expect(
			THEME_RECIPES_V1.filter((recipe) => recipe.id.startsWith("field-")).every(
				(recipe) => recipe.itineraryTemplateId === "field-journal",
			),
		).toBe(true);
		expect(
			THEME_RECIPES_V1.filter((recipe) => recipe.id.startsWith("way-")).every(
				(recipe) => recipe.itineraryTemplateId === "route-thread",
			),
		).toBe(true);
		expect(
			THEME_RECIPES_V1.filter((recipe) =>
				recipe.id.startsWith("ticket-"),
			).every((recipe) => recipe.itineraryTemplateId === "travel-ticket"),
		).toBe(true);
	});

	it("境界値系: 同じシードは同じ要求テーマを返す", () => {
		expect(createBookletTheme({ value: 0, version: "v1" })).toEqual(
			createBookletTheme({ value: 0, version: "v1" }),
		);
	});
});
