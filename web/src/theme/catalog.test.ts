import { describe, expect, it } from "vitest";
import { THEME_CATALOG_REFERENCES } from "./bookletTheme";
import { MOODS, validateCatalog } from "./catalog";
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
	it("正常系: 設計表の6雰囲気と3,072通りを検証する", () => {
		expect(MOODS).toHaveLength(6);
		expect(combinationCount()).toBe(3072);
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
