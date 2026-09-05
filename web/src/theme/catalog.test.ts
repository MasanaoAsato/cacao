import { describe, expect, it } from "vitest";
import { THEME_CATALOG_REFERENCES } from "./bookletTheme";
import { MOODS, V2_REPRESENTATIVE_SEEDS, validateCatalog } from "./catalog";
import { ThemeRecipeValidationError } from "./recipeSafety";
import type { PaletteId } from "./types";

const V1_RECIPE_AXES = [
	[
		"field-notes",
		"north-west",
		"paper-ink",
		"classic",
		"field-journal",
		"balanced",
		"place-led",
	],
	[
		"field-notes",
		"south-west",
		"forest-map",
		"literary",
		"field-journal",
		"airy",
		"route-led",
	],
	[
		"field-notes",
		"split-left",
		"graphite",
		"classic",
		"field-journal",
		"compact",
		"balanced",
	],
	[
		"field-notes",
		"horizon",
		"cobalt-sunrise",
		"literary",
		"field-journal",
		"balanced",
		"time-led",
	],
	[
		"wayfinder",
		"north-east",
		"graphite",
		"wayfinding",
		"route-thread",
		"compact",
		"time-led",
	],
	[
		"wayfinder",
		"split-left",
		"cobalt-sunrise",
		"modern",
		"route-thread",
		"balanced",
		"route-led",
	],
	[
		"wayfinder",
		"south-east",
		"marine-glass",
		"wayfinding",
		"route-thread",
		"balanced",
		"place-led",
	],
	[
		"wayfinder",
		"horizon",
		"night-window",
		"modern",
		"route-thread",
		"compact",
		"time-led",
	],
	[
		"postcard",
		"center",
		"plum-sunset",
		"round-trip",
		"travel-ticket",
		"airy",
		"place-led",
	],
	[
		"postcard",
		"south-east",
		"paper-ink",
		"literary",
		"travel-ticket",
		"balanced",
		"place-led",
	],
	[
		"postcard",
		"north-west",
		"cobalt-sunrise",
		"round-trip",
		"travel-ticket",
		"balanced",
		"route-led",
	],
	[
		"postcard",
		"horizon",
		"marine-glass",
		"classic",
		"travel-ticket",
		"airy",
		"balanced",
	],
	[
		"night-train",
		"center",
		"night-window",
		"modern",
		"route-thread",
		"compact",
		"time-led",
	],
	[
		"night-train",
		"north-east",
		"plum-sunset",
		"literary",
		"route-thread",
		"balanced",
		"place-led",
	],
	[
		"night-train",
		"split-left",
		"night-window",
		"wayfinding",
		"route-thread",
		"compact",
		"route-led",
	],
	[
		"night-train",
		"south-west",
		"indigo-mist",
		"round-trip",
		"route-thread",
		"airy",
		"balanced",
	],
	[
		"quiet-gallery",
		"center",
		"graphite",
		"literary",
		"field-journal",
		"airy",
		"balanced",
	],
	[
		"quiet-gallery",
		"north-west",
		"paper-ink",
		"classic",
		"field-journal",
		"balanced",
		"place-led",
	],
	[
		"quiet-gallery",
		"south-east",
		"marine-glass",
		"modern",
		"field-journal",
		"airy",
		"time-led",
	],
	[
		"quiet-gallery",
		"horizon",
		"forest-map",
		"literary",
		"field-journal",
		"balanced",
		"route-led",
	],
	[
		"festival-ticket",
		"south-west",
		"plum-sunset",
		"round-trip",
		"travel-ticket",
		"balanced",
		"place-led",
	],
	[
		"festival-ticket",
		"north-east",
		"cobalt-sunrise",
		"wayfinding",
		"travel-ticket",
		"compact",
		"time-led",
	],
	[
		"festival-ticket",
		"split-left",
		"indigo-mist",
		"modern",
		"travel-ticket",
		"balanced",
		"route-led",
	],
	[
		"festival-ticket",
		"center",
		"forest-map",
		"round-trip",
		"travel-ticket",
		"airy",
		"balanced",
	],
] as const;

function combinationCount(): number {
	return Array.from(MOODS.values()).reduce(
		(total, mood) =>
			total +
			mood.coverLayouts.length *
				mood.decors.length *
				mood.displayFonts.length *
				mood.fontPairs.length *
				mood.itineraryTemplates.length *
				mood.palettes.length *
				THEME_CATALOG_REFERENCES.densities.size *
				THEME_CATALOG_REFERENCES.emphasis.size,
		0,
	);
}

describe("V2テーマカタログ", () => {
	it("正常系: 設計表の6雰囲気と11,808通りを検証する", () => {
		expect(MOODS).toHaveLength(6);
		expect(combinationCount()).toBe(11808);
		expect(() =>
			validateCatalog(MOODS, THEME_CATALOG_REFERENCES),
		).not.toThrow();
	});

	it("正常系: v1の24レシピの全軸がv2の許可リストに含まれる", () => {
		for (const [
			moodId,
			coverLayoutId,
			paletteId,
			fontPairId,
			itineraryTemplateId,
			densityId,
			emphasisId,
		] of V1_RECIPE_AXES) {
			const mood = MOODS.get(moodId);
			if (!mood) {
				throw new Error(`雰囲気「${moodId}」の定義がありません。`);
			}
			expect(mood.coverLayouts).toContain(coverLayoutId);
			expect(mood.decors).toContain(moodId);
			expect(mood.fontPairs).toContain(fontPairId);
			expect(mood.itineraryTemplates).toContain(itineraryTemplateId);
			expect(mood.palettes).toContain(paletteId);
			expect(THEME_CATALOG_REFERENCES.densities.has(densityId)).toBe(true);
			expect(THEME_CATALOG_REFERENCES.emphasis.has(emphasisId)).toBe(true);
		}
	});

	it("正常系: 代表シード表が登録済みの全軸値を網羅する", () => {
		const representatives = V2_REPRESENTATIVE_SEEDS.map(
			({ expected }) => expected,
		);
		expect(new Set(representatives.map(({ moodId }) => moodId))).toEqual(
			new Set(MOODS.keys()),
		);
		expect(
			new Set(representatives.map(({ coverLayoutId }) => coverLayoutId)),
		).toEqual(
			new Set(
				Array.from(THEME_CATALOG_REFERENCES.coverLayouts.keys()).filter(
					(id) => THEME_CATALOG_REFERENCES.coverLayouts.get(id)?.selectable,
				),
			),
		);
		expect(new Set(representatives.map(({ paletteId }) => paletteId))).toEqual(
			new Set(THEME_CATALOG_REFERENCES.palettes.keys()),
		);
		expect(
			new Set(representatives.map(({ fontPairId }) => fontPairId)),
		).toEqual(new Set(THEME_CATALOG_REFERENCES.fonts.keys()));
		expect(
			new Set(representatives.map(({ displayFontId }) => displayFontId)),
		).toEqual(new Set(THEME_CATALOG_REFERENCES.displayFonts.keys()));
		expect(
			new Set(
				representatives.map(({ itineraryTemplateId }) => itineraryTemplateId),
			),
		).toEqual(new Set(THEME_CATALOG_REFERENCES.itineraries.keys()));
		expect(new Set(representatives.map(({ decorId }) => decorId))).toEqual(
			new Set(THEME_CATALOG_REFERENCES.decors.keys()),
		);
	});

	it("異常系: 同じ許可リストに重複した値があれば拒否する", () => {
		const fieldNotes = MOODS.get("field-notes");
		if (!fieldNotes) {
			throw new Error("field-notesの定義がありません。");
		}
		const moods = new Map(MOODS).set("field-notes", {
			...fieldNotes,
			palettes: ["paper-ink", "paper-ink"],
		});
		expect(() => validateCatalog(moods, THEME_CATALOG_REFERENCES)).toThrow(
			ThemeRecipeValidationError,
		);
	});

	it("異常系: 未登録の許可値を拒否する", () => {
		const fieldNotes = MOODS.get("field-notes");
		if (!fieldNotes) {
			throw new Error("field-notesの定義がありません。");
		}
		const moods = new Map(MOODS).set("field-notes", {
			...fieldNotes,
			palettes: ["not-registered" as unknown as PaletteId],
		});
		expect(() => validateCatalog(moods, THEME_CATALOG_REFERENCES)).toThrow(
			ThemeRecipeValidationError,
		);
	});

	it("異常系: 空の許可リストを拒否する", () => {
		const fieldNotes = MOODS.get("field-notes");
		if (!fieldNotes) {
			throw new Error("field-notesの定義がありません。");
		}
		const moods = new Map(MOODS).set("field-notes", {
			...fieldNotes,
			palettes: [],
		});
		expect(() => validateCatalog(moods, THEME_CATALOG_REFERENCES)).toThrow(
			ThemeRecipeValidationError,
		);
	});

	it("異常系: selectableでない表紙構図を拒否する", () => {
		const fieldNotes = MOODS.get("field-notes");
		if (!fieldNotes) {
			throw new Error("field-notesの定義がありません。");
		}
		const moods = new Map(MOODS).set("field-notes", {
			...fieldNotes,
			coverLayouts: ["safe-cover"],
		});
		expect(() => validateCatalog(moods, THEME_CATALOG_REFERENCES)).toThrow(
			ThemeRecipeValidationError,
		);
	});

	it("異常系: 本文2書体と表示2書体の組み合わせを拒否する", () => {
		const displayFont =
			THEME_CATALOG_REFERENCES.displayFonts.get("dela-gothic-one");
		if (!displayFont) {
			throw new Error("表示書体の定義がありません。");
		}
		const references = {
			...THEME_CATALOG_REFERENCES,
			displayFonts: new Map(THEME_CATALOG_REFERENCES.displayFonts).set(
				"dela-gothic-one",
				{
					...displayFont,
					family: '"Display One", "Display Two", sans-serif',
				},
			),
		};
		expect(() => validateCatalog(MOODS, references)).toThrow(
			ThemeRecipeValidationError,
		);
	});

	it("異常系: 未選択の配色でも表紙紙面の薄いコントラストを拒否する", () => {
		const palette = THEME_CATALOG_REFERENCES.palettes.get("paper-ink");
		if (!palette) {
			throw new Error("paper-ink配色がありません。");
		}
		const references = {
			...THEME_CATALOG_REFERENCES,
			palettes: new Map(THEME_CATALOG_REFERENCES.palettes).set("paper-ink", {
				...palette,
				surfaceStops: [palette.coverInk, palette.coverInk] as const,
			}),
		};
		expect(() => validateCatalog(MOODS, references)).toThrow(
			ThemeRecipeValidationError,
		);
	});

	it("境界値系: 1件だけの許可リストを持つカタログを受理する", () => {
		const fieldNotes = MOODS.get("field-notes");
		if (!fieldNotes) {
			throw new Error("field-notesの定義がありません。");
		}
		const moods = new Map([
			[
				fieldNotes.id,
				{
					...fieldNotes,
					coverLayouts: ["north-west"] as const,
					decors: ["field-notes"] as const,
					displayFonts: ["inherit"] as const,
					fontPairs: ["classic"] as const,
					itineraryTemplates: ["field-journal"] as const,
					palettes: ["paper-ink"] as const,
				},
			],
		]);
		expect(() =>
			validateCatalog(moods, THEME_CATALOG_REFERENCES),
		).not.toThrow();
	});
});
