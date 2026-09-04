import { describe, expect, it } from "vitest";
import { THEME_CATALOG_REFERENCES, THEME_RECIPES_V1 } from "./bookletTheme";
import {
	buildThemeCandidates,
	defineThemeRecipe,
	ThemeRecipeValidationError,
	validateThemeCatalog,
} from "./recipeSafety";
import type {
	CoverLayoutDefinition,
	RequestedBookletTheme,
	ThemeCatalogReferences,
	ThemeRecipeDefinition,
	TypographySafety,
} from "./types";

function makeRecipe(
	overrides: Partial<ThemeRecipeDefinition> = {},
): ThemeRecipeDefinition {
	const recipe = THEME_RECIPES_V1[0];
	if (!recipe) {
		throw new Error("fixtureがありません。");
	}
	return { ...recipe, ...overrides, typography: { ...recipe.typography } };
}

function requested(recipe: ThemeRecipeDefinition): RequestedBookletTheme {
	return {
		catalogVersion: "v1",
		recipe,
		seed: { value: 7, version: "v1" },
		seedToken: "v1-00000007",
	};
}

function referencesWithCoverLayout(
	id: CoverLayoutDefinition["id"],
	overrides: Partial<CoverLayoutDefinition>,
): ThemeCatalogReferences {
	const cover = THEME_CATALOG_REFERENCES.coverLayouts.get(id);
	if (!cover) {
		throw new Error(`表紙構図「${id}」がありません。`);
	}
	return {
		...THEME_CATALOG_REFERENCES,
		coverLayouts: new Map(THEME_CATALOG_REFERENCES.coverLayouts).set(id, {
			...cover,
			...overrides,
		}),
	};
}

type RangeCase = {
	readonly label: string;
	readonly lower: number;
	readonly upper?: number;
	readonly apply: (
		value: number,
		typography: TypographySafety,
	) => TypographySafety;
};

const rangeCases: readonly RangeCase[] = [
	{
		label: "本文文字サイズ",
		lower: 9,
		upper: 11,
		apply: (value, typography) => ({
			...typography,
			body: { ...typography.body, fontSizePt: value },
		}),
	},
	{
		label: "本文行高",
		lower: 1.5,
		upper: 1.9,
		apply: (value, typography) => ({
			...typography,
			body: { ...typography.body, lineHeight: value },
		}),
	},
	{
		label: "本文字間",
		lower: -0.02,
		upper: 0.06,
		apply: (value, typography) => ({
			...typography,
			body: { ...typography.body, letterSpacingEm: value },
		}),
	},
	{
		label: "表紙見出し文字サイズ",
		lower: 22,
		upper: 56,
		apply: (value, typography) => ({
			...typography,
			coverTitle: { ...typography.coverTitle, fontSizePt: value },
		}),
	},
	{
		label: "表紙見出し行高",
		lower: 1.1,
		upper: 1.35,
		apply: (value, typography) => ({
			...typography,
			coverTitle: { ...typography.coverTitle, lineHeight: value },
		}),
	},
	{
		label: "表紙見出し字間",
		lower: -0.02,
		upper: 0.16,
		apply: (value, typography) => ({
			...typography,
			coverTitle: { ...typography.coverTitle, letterSpacingEm: value },
		}),
	},
	{
		label: "日見出し文字サイズ",
		lower: 16,
		upper: 26,
		apply: (value, typography) => ({
			...typography,
			dayTitle: { ...typography.dayTitle, fontSizePt: value },
		}),
	},
	{
		label: "日見出し行高",
		lower: 1.2,
		upper: 1.5,
		apply: (value, typography) => ({
			...typography,
			dayTitle: { ...typography.dayTitle, lineHeight: value },
		}),
	},
	{
		label: "日見出し字間",
		lower: -0.02,
		upper: 0.16,
		apply: (value, typography) => ({
			...typography,
			dayTitle: { ...typography.dayTitle, letterSpacingEm: value },
		}),
	},
	{
		label: "強調文字サイズ",
		lower: 9,
		upper: 18,
		apply: (value, typography) => ({
			...typography,
			emphasized: { ...typography.emphasized, fontSizePt: value },
		}),
	},
	{
		label: "強調行高",
		lower: 1.2,
		upper: 1.5,
		apply: (value, typography) => ({
			...typography,
			emphasized: { ...typography.emphasized, lineHeight: value },
		}),
	},
	{
		label: "強調字間",
		lower: -0.02,
		upper: 0.16,
		apply: (value, typography) => ({
			...typography,
			emphasized: { ...typography.emphasized, letterSpacingEm: value },
		}),
	},
	{
		label: "Spot見出し文字サイズ",
		lower: 13,
		upper: 20,
		apply: (value, typography) => ({
			...typography,
			spotTitle: { ...typography.spotTitle, fontSizePt: value },
		}),
	},
	{
		label: "Spot見出し行高",
		lower: 1.25,
		upper: 1.6,
		apply: (value, typography) => ({
			...typography,
			spotTitle: { ...typography.spotTitle, lineHeight: value },
		}),
	},
	{
		label: "Spot見出し字間",
		lower: -0.02,
		upper: 0.16,
		apply: (value, typography) => ({
			...typography,
			spotTitle: { ...typography.spotTitle, letterSpacingEm: value },
		}),
	},
	{
		label: "補助情報文字サイズ",
		lower: 7.5,
		upper: 9,
		apply: (value, typography) => ({
			...typography,
			utility: { ...typography.utility, fontSizePt: value },
		}),
	},
	{
		label: "補助情報行高",
		lower: 1.35,
		upper: 1.7,
		apply: (value, typography) => ({
			...typography,
			utility: { ...typography.utility, lineHeight: value },
		}),
	},
	{
		label: "補助情報字間",
		lower: -0.02,
		upper: 0.16,
		apply: (value, typography) => ({
			...typography,
			utility: { ...typography.utility, letterSpacingEm: value },
		}),
	},
	{
		label: "Spot説明領域幅",
		lower: 76,
		apply: (value, typography) => ({
			...typography,
			detailWidthMm: value,
		}),
	},
	{
		label: "補助情報領域幅",
		lower: 22,
		apply: (value, typography) => ({
			...typography,
			utilityWidthMm: value,
		}),
	},
	{
		label: "本文ページ余白",
		lower: 10,
		upper: 14,
		apply: (value, typography) => ({
			...typography,
			pageMarginMm: value,
		}),
	},
	{
		label: "間隔倍率",
		lower: 0.86,
		upper: 1.14,
		apply: (value, typography) => ({
			...typography,
			spacingMultiplier: value,
		}),
	},
];

describe("レシピ安全規格", () => {
	it("正常系: 登録済み最小安全レシピを受理する", () => {
		expect(defineThemeRecipe(makeRecipe(), THEME_CATALOG_REFERENCES).id).toBe(
			"field-01",
		);
	});

	it("異常系: safe-coverを通常のテーマレシピとして選択できない", () => {
		expect(() =>
			defineThemeRecipe(
				makeRecipe({ coverLayoutId: "safe-cover" }),
				THEME_CATALOG_REFERENCES,
			),
		).toThrow(ThemeRecipeValidationError);
	});

	it("境界値系: 表紙構図の見出しサイズは22ptから56ptを受理する", () => {
		for (const titleSizePt of [22, 56]) {
			expect(() =>
				validateThemeCatalog(
					[makeRecipe()],
					referencesWithCoverLayout("center", { titleSizePt }),
				),
			).not.toThrow();
		}
	});

	it("異常系: 表紙構図の見出しサイズが範囲外ならカタログを拒否する", () => {
		for (const titleSizePt of [21.99, 56.01]) {
			expect(() =>
				validateThemeCatalog(
					[makeRecipe()],
					referencesWithCoverLayout("center", { titleSizePt }),
				),
			).toThrow(ThemeRecipeValidationError);
		}
	});

	it("正常系: 件数に依存しないカタログ安全検査を行う", () => {
		expect(() =>
			validateThemeCatalog([makeRecipe()], THEME_CATALOG_REFERENCES),
		).not.toThrow();
	});

	for (const rangeCase of rangeCases) {
		it(`境界値系: ${rangeCase.label}の安全範囲を検証する`, () => {
			const recipe = makeRecipe();
			const typography = recipe.typography;
			const upper = rangeCase.upper;
			for (const value of [rangeCase.lower, rangeCase.upper].filter(
				(candidate): candidate is number => candidate !== undefined,
			)) {
				expect(() =>
					defineThemeRecipe(
						{ ...recipe, typography: rangeCase.apply(value, typography) },
						THEME_CATALOG_REFERENCES,
					),
				).not.toThrow();
			}

			expect(() =>
				defineThemeRecipe(
					{
						...recipe,
						typography: rangeCase.apply(rangeCase.lower - 0.01, typography),
					},
					THEME_CATALOG_REFERENCES,
				),
			).toThrow(ThemeRecipeValidationError);
			if (upper !== undefined) {
				expect(() =>
					defineThemeRecipe(
						{
							...recipe,
							typography: rangeCase.apply(upper + 0.01, typography),
						},
						THEME_CATALOG_REFERENCES,
					),
				).toThrow(ThemeRecipeValidationError);
			}
		});
	}

	it("異常系: 未知ID・3書体・コントラスト不足を拒否する", () => {
		expect(() =>
			defineThemeRecipe(
				makeRecipe({
					paletteId: "unknown" as ThemeRecipeDefinition["paletteId"],
				}),
				THEME_CATALOG_REFERENCES,
			),
		).toThrow(ThemeRecipeValidationError);

		const references = {
			...THEME_CATALOG_REFERENCES,
			fonts: new Map(THEME_CATALOG_REFERENCES.fonts),
		};
		const classicFont = THEME_CATALOG_REFERENCES.fonts.get("classic");
		if (!classicFont) {
			throw new Error("classic書体がありません。");
		}
		references.fonts.set("classic", {
			...classicFont,
			families: ["A", "B", "C"],
		});
		expect(() => defineThemeRecipe(makeRecipe(), references)).toThrow(
			"2種類まで",
		);
	});

	it("境界値系: 表紙ベール不透明度は画像を残す安全範囲だけを受理する", () => {
		const palette = THEME_CATALOG_REFERENCES.palettes.get("paper-ink");
		if (!palette) {
			throw new Error("paper-ink配色がありません。");
		}
		const references = {
			...THEME_CATALOG_REFERENCES,
			palettes: new Map(THEME_CATALOG_REFERENCES.palettes),
		};
		for (const opacity of [0.36, 0.42]) {
			references.palettes.set("paper-ink", {
				...palette,
				coverVeilOpacity: opacity,
			});
			expect(() => defineThemeRecipe(makeRecipe(), references)).not.toThrow();
		}
		for (const opacity of [0.35, 0.43]) {
			references.palettes.set("paper-ink", {
				...palette,
				coverVeilOpacity: opacity,
			});
			expect(() => defineThemeRecipe(makeRecipe(), references)).toThrow(
				"表紙ベール不透明度",
			);
		}
	});

	it("異常系: PDF実使用面と表紙ベールの低コントラストを拒否する", () => {
		const palette = THEME_CATALOG_REFERENCES.palettes.get("paper-ink");
		if (!palette) {
			throw new Error("paper-ink配色がありません。");
		}
		const references = {
			...THEME_CATALOG_REFERENCES,
			palettes: new Map(THEME_CATALOG_REFERENCES.palettes),
		};
		references.palettes.set("paper-ink", {
			...palette,
			surfaceStops: ["#000000", "#000000"],
		});
		expect(() => defineThemeRecipe(makeRecipe(), references)).toThrow(
			"コントラスト",
		);

		references.palettes.set("paper-ink", {
			...palette,
			coverVeil: "#000000",
		});
		expect(() => defineThemeRecipe(makeRecipe(), references)).toThrow(
			"コントラスト",
		);
	});

	it("境界値系: airyは4候補、compactは重複せず2候補になる", () => {
		const airy = makeRecipe({ densityId: "airy" });
		const compact = makeRecipe({ densityId: "compact" });
		expect(
			buildThemeCandidates(requested(airy), THEME_CATALOG_REFERENCES),
		).toHaveLength(4);
		const compactCandidates = buildThemeCandidates(
			requested(compact),
			THEME_CATALOG_REFERENCES,
		);
		expect(compactCandidates).toHaveLength(2);
		expect(
			new Set(compactCandidates.map((item) => item.resolvedThemeKey)).size,
		).toBe(compactCandidates.length);
	});
});
