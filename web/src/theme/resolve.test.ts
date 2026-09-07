import { describe, expect, it } from "vitest";
import { THEME_CATALOG_REFERENCES } from "./bookletTheme";
import { MOODS, V2_REPRESENTATIVE_SEEDS } from "./catalog";
import { designKey, resolveTheme, sameDesign, unitFormsFor } from "./resolve";
import type { PaletteId, ThemeCatalogReferences } from "./types";

function resolve(seed: number) {
	return resolveTheme(
		{ value: seed, version: "v2" },
		{ coverVisualStyle: null },
		MOODS,
		THEME_CATALOG_REFERENCES,
	);
}

describe("V2テーマ解決", () => {
	it("正常系: 代表シードを設計表で固定した軸の値へ解決する", () => {
		for (const { expected, seed } of V2_REPRESENTATIVE_SEEDS) {
			expect(resolve(seed).recipe).toMatchObject(expected);
		}
	});

	it("正常系: 10,000シードを許可リスト内へ決定的に解決する", () => {
		for (let seed = 0; seed < 10_000; seed += 1) {
			const theme = resolve(seed);
			const sameTheme = resolve(seed);
			const mood = MOODS.get(theme.recipe.moodId);
			if (!mood) {
				throw new Error("解決された雰囲気がカタログにありません。");
			}
			expect(theme).toEqual(sameTheme);
			expect(mood.coverLayouts).toContain(theme.recipe.coverLayoutId);
			expect(mood.decors).toContain(theme.recipe.decorId);
			expect(mood.displayFonts).toContain(theme.recipe.displayFontId);
			expect(mood.fontPairs).toContain(theme.recipe.fontPairId);
			expect(mood.itineraryTemplates).toContain(
				theme.recipe.itineraryTemplateId,
			);
			expect(mood.palettes).toContain(theme.recipe.paletteId);
			expect(mood.compositions).toContain(theme.recipe.compositionId);
			expect(mood.inkStyles).toContain(theme.recipe.inkStyleId);
			expect(
				unitFormsFor(
					mood,
					theme.recipe.compositionId,
					THEME_CATALOG_REFERENCES,
				),
			).toContain(theme.recipe.unitFormId);
			expect(
				THEME_CATALOG_REFERENCES.densities.has(theme.recipe.densityId),
			).toBe(true);
			expect(
				THEME_CATALOG_REFERENCES.emphasis.has(theme.recipe.emphasisId),
			).toBe(true);
			expect(theme.recipe.id).toBe(designKey(theme.recipe));
			expect(theme.recipe.typography.detailWidthMm).toBe(
				THEME_CATALOG_REFERENCES.unitForms.get(theme.recipe.unitFormId)
					?.minDescriptionWidthMm,
			);
		}
	}, 10_000);

	it("正常系: ページ構図の追加は構図と単位形式以外の軸の選択結果を変えない", () => {
		const fieldNotes = MOODS.get("field-notes");
		if (!fieldNotes) {
			throw new Error("テスト用のカタログ定義がありません。");
		}
		const moods = new Map(MOODS).set("field-notes", {
			...fieldNotes,
			compositions: [...fieldNotes.compositions, "bottom-anchored"],
		});

		for (let seed = 0; seed < 1_000; seed += 1) {
			const original = resolve(seed).recipe;
			const changed = resolveTheme(
				{ value: seed, version: "v2" },
				{ coverVisualStyle: null },
				moods,
				THEME_CATALOG_REFERENCES,
			).recipe;
			const neutral = {
				compositionId: "",
				id: "",
				typography: null,
				unitFormId: "",
			};
			expect({ ...changed, ...neutral }).toEqual({ ...original, ...neutral });
		}
	});

	it("境界値系: 2列の構図ではlineだけを選ぶ", () => {
		for (let seed = 0; seed < 2_000; seed += 1) {
			const recipe = resolve(seed).recipe;
			if (recipe.compositionId === "two-column") {
				expect(recipe.unitFormId).toBe("line");
			}
		}
	});

	it("正常系: 配色の追加は他の軸の選択結果を変えない", () => {
		const fieldNotes = MOODS.get("field-notes");
		const paperInk = THEME_CATALOG_REFERENCES.palettes.get("paper-ink");
		if (!fieldNotes || !paperInk) {
			throw new Error("テスト用のカタログ定義がありません。");
		}
		const addedPaletteId = "test-palette" as PaletteId;
		const references: ThemeCatalogReferences = {
			...THEME_CATALOG_REFERENCES,
			palettes: new Map(THEME_CATALOG_REFERENCES.palettes).set(addedPaletteId, {
				...paperInk,
				id: addedPaletteId,
			}),
		};
		const moods = new Map(MOODS).set("field-notes", {
			...fieldNotes,
			palettes: [...fieldNotes.palettes, addedPaletteId],
		});

		for (let seed = 0; seed < 1_000; seed += 1) {
			const original = resolve(seed).recipe;
			const changed = resolveTheme(
				{ value: seed, version: "v2" },
				{ coverVisualStyle: null },
				moods,
				references,
			).recipe;
			expect({ ...changed, id: "", paletteId: "" }).toEqual({
				...original,
				id: "",
				paletteId: "",
			});
		}
	});

	it("境界値系: 写真系の画風文脈はnullと同じデザインを選ぶ", () => {
		const seed = { value: 0x12345678, version: "v2" as const };
		const withoutContext = resolveTheme(
			seed,
			{ coverVisualStyle: null },
			MOODS,
			THEME_CATALOG_REFERENCES,
		);
		const withPhotograph = resolveTheme(
			seed,
			{ coverVisualStyle: "editorial-photograph" },
			MOODS,
			THEME_CATALOG_REFERENCES,
		);

		expect(designKey(withPhotograph.recipe)).toBe(
			designKey(withoutContext.recipe),
		);
	});

	it("境界値系: 同一の軸値を持つテーマを同じデザインとして判定する", () => {
		const theme = resolve(0).recipe;
		expect(sameDesign(theme, { ...theme })).toBe(true);
		expect(sameDesign(theme, { ...theme, emphasisId: "balanced" })).toBe(
			theme.emphasisId === "balanced",
		);
		expect(
			sameDesign(theme, {
				...theme,
				inkStyleId: theme.inkStyleId === "text" ? "pill" : "text",
			}),
		).toBe(false);
	});
});
