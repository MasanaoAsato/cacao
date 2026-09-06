import {
	ThemeRecipeValidationError,
	validateCoverLayoutDefinitions,
	validateDecorDefinitions,
	validateFontFamilyCombinations,
	validatePaletteDefinitions,
} from "./recipeSafety";
import type {
	MoodDefinition,
	ThemeCatalogReferences,
	ThemeRecipeDefinition,
} from "./types";

export const MOODS = new Map<MoodDefinition["id"], MoodDefinition>([
	[
		"field-notes",
		{
			coverLayouts: [
				"north-west",
				"south-west",
				"split-left",
				"horizon",
				"panel-bottom",
				"window-arch",
			],
			decors: ["dotted-grid", "hairline-frame"],
			displayFonts: ["inherit", "zen-kurenaido"],
			fontPairs: ["classic", "literary"],
			id: "field-notes",
			itineraryTemplates: ["field-journal", "rail-ledger"],
			palettes: ["paper-ink", "forest-map", "graphite", "cobalt-sunrise"],
		},
	],
	[
		"wayfinder",
		{
			coverLayouts: [
				"north-east",
				"split-left",
				"south-east",
				"horizon",
				"panel-top",
				"poster",
			],
			decors: ["stripe-band", "route-dash"],
			displayFonts: ["inherit", "dela-gothic-one"],
			fontPairs: ["wayfinding", "modern"],
			id: "wayfinder",
			itineraryTemplates: ["route-thread", "banner-list"],
			palettes: ["graphite", "cobalt-sunrise", "marine-glass", "night-window"],
		},
	],
	[
		"postcard",
		{
			coverLayouts: [
				"center",
				"south-east",
				"north-west",
				"horizon",
				"window-arch",
				"panel-bottom",
			],
			decors: ["hairline-frame", "dotted-grid"],
			displayFonts: ["inherit", "zen-kurenaido", "rocknroll-one"],
			fontPairs: ["round-trip", "literary", "classic"],
			id: "postcard",
			itineraryTemplates: ["travel-ticket", "banner-list"],
			palettes: ["plum-sunset", "paper-ink", "cobalt-sunrise", "marine-glass"],
		},
	],
	[
		"night-train",
		{
			coverLayouts: [
				"center",
				"north-east",
				"split-left",
				"south-west",
				"panel-bottom",
				"poster",
			],
			decors: ["route-dash", "gallery-rule"],
			displayFonts: ["inherit", "kaisei-decol", "dela-gothic-one"],
			fontPairs: ["modern", "literary", "wayfinding", "round-trip"],
			id: "night-train",
			itineraryTemplates: ["route-thread", "rail-ledger"],
			palettes: ["night-window", "plum-sunset", "indigo-mist"],
		},
	],
	[
		"quiet-gallery",
		{
			coverLayouts: [
				"center",
				"north-west",
				"south-east",
				"horizon",
				"window-arch",
				"poster",
			],
			decors: ["gallery-rule", "hairline-frame"],
			displayFonts: ["inherit", "kaisei-decol"],
			fontPairs: ["literary", "classic", "modern"],
			id: "quiet-gallery",
			itineraryTemplates: ["field-journal", "rail-ledger"],
			palettes: ["graphite", "paper-ink", "marine-glass", "forest-map"],
		},
	],
	[
		"festival-ticket",
		{
			coverLayouts: [
				"south-west",
				"north-east",
				"split-left",
				"center",
				"panel-top",
				"poster",
			],
			decors: ["dashed-ticket", "stripe-band"],
			displayFonts: ["inherit", "rocknroll-one", "dela-gothic-one"],
			fontPairs: ["round-trip", "wayfinding", "modern"],
			id: "festival-ticket",
			itineraryTemplates: ["travel-ticket", "banner-list"],
			palettes: ["plum-sunset", "cobalt-sunrise", "indigo-mist", "forest-map"],
		},
	],
]);

function validateList<T>(
	label: string,
	values: readonly T[],
	isRegistered: (value: T) => boolean,
): void {
	if (values.length === 0)
		throw new ThemeRecipeValidationError(`${label}は1件以上必要です。`);
	if (new Set(values).size !== values.length)
		throw new ThemeRecipeValidationError(`${label}に重複した値があります。`);
	for (const value of values) {
		if (!isRegistered(value))
			throw new ThemeRecipeValidationError(`${label}に未登録の値があります。`);
	}
}

export function validateCatalog(
	moods: ReadonlyMap<MoodDefinition["id"], MoodDefinition>,
	references: ThemeCatalogReferences,
): void {
	validateCoverLayoutDefinitions(references);
	validateDecorDefinitions(references);
	validateFontFamilyCombinations(references);
	validatePaletteDefinitions(references);
	if (moods.size === 0)
		throw new ThemeRecipeValidationError("雰囲気の定義は1件以上必要です。");
	for (const [id, mood] of moods) {
		if (id !== mood.id)
			throw new ThemeRecipeValidationError(
				`雰囲気のキー「${id}」と定義ID「${mood.id}」が一致しません。`,
			);
		validateList(
			`雰囲気「${id}」の表紙構図`,
			mood.coverLayouts,
			(value) => references.coverLayouts.get(value)?.selectable === true,
		);
		if (mood.decors.includes("none"))
			throw new ThemeRecipeValidationError(
				`雰囲気「${id}」の装飾にnoneは指定できません。`,
			);
		validateList(`雰囲気「${id}」の装飾`, mood.decors, (value) =>
			references.decors.has(value),
		);
		validateList(`雰囲気「${id}」の表示書体`, mood.displayFonts, (value) =>
			references.displayFonts.has(value),
		);
		validateList(`雰囲気「${id}」の本文書体`, mood.fontPairs, (value) =>
			references.fonts.has(value),
		);
		validateList(
			`雰囲気「${id}」の本文テンプレート`,
			mood.itineraryTemplates,
			(value) => references.itineraries.has(value),
		);
		validateList(`雰囲気「${id}」の配色`, mood.palettes, (value) =>
			references.palettes.has(value),
		);
	}
}

export type V2RepresentativeSeed = {
	readonly expected: Pick<
		ThemeRecipeDefinition,
		| "coverLayoutId"
		| "decorId"
		| "displayFontId"
		| "fontPairId"
		| "itineraryTemplateId"
		| "moodId"
		| "paletteId"
	>;
	readonly seed: number;
};

export const V2_REPRESENTATIVE_SEEDS: readonly V2RepresentativeSeed[] = [
	{
		seed: 0,
		expected: {
			coverLayoutId: "horizon",
			decorId: "route-dash",
			displayFontId: "inherit",
			fontPairId: "wayfinding",
			itineraryTemplateId: "route-thread",
			moodId: "wayfinder",
			paletteId: "marine-glass",
		},
	},
	{
		seed: 1,
		expected: {
			coverLayoutId: "north-east",
			decorId: "route-dash",
			displayFontId: "inherit",
			fontPairId: "wayfinding",
			itineraryTemplateId: "route-thread",
			moodId: "wayfinder",
			paletteId: "night-window",
		},
	},
	{
		seed: 2,
		expected: {
			coverLayoutId: "split-left",
			decorId: "dashed-ticket",
			displayFontId: "inherit",
			fontPairId: "wayfinding",
			itineraryTemplateId: "banner-list",
			moodId: "festival-ticket",
			paletteId: "indigo-mist",
		},
	},
	{
		seed: 3,
		expected: {
			coverLayoutId: "window-arch",
			decorId: "dotted-grid",
			displayFontId: "zen-kurenaido",
			fontPairId: "literary",
			itineraryTemplateId: "field-journal",
			moodId: "field-notes",
			paletteId: "graphite",
		},
	},
	{
		seed: 4,
		expected: {
			coverLayoutId: "horizon",
			decorId: "gallery-rule",
			displayFontId: "kaisei-decol",
			fontPairId: "modern",
			itineraryTemplateId: "field-journal",
			moodId: "quiet-gallery",
			paletteId: "marine-glass",
		},
	},
	{
		seed: 5,
		expected: {
			coverLayoutId: "north-west",
			decorId: "gallery-rule",
			displayFontId: "kaisei-decol",
			fontPairId: "literary",
			itineraryTemplateId: "field-journal",
			moodId: "quiet-gallery",
			paletteId: "graphite",
		},
	},
	{
		seed: 6,
		expected: {
			coverLayoutId: "center",
			decorId: "gallery-rule",
			displayFontId: "kaisei-decol",
			fontPairId: "classic",
			itineraryTemplateId: "field-journal",
			moodId: "quiet-gallery",
			paletteId: "marine-glass",
		},
	},
	{
		seed: 7,
		expected: {
			coverLayoutId: "panel-top",
			decorId: "route-dash",
			displayFontId: "inherit",
			fontPairId: "wayfinding",
			itineraryTemplateId: "banner-list",
			moodId: "wayfinder",
			paletteId: "graphite",
		},
	},
	{
		seed: 8,
		expected: {
			coverLayoutId: "poster",
			decorId: "stripe-band",
			displayFontId: "inherit",
			fontPairId: "wayfinding",
			itineraryTemplateId: "banner-list",
			moodId: "wayfinder",
			paletteId: "marine-glass",
		},
	},
	{
		seed: 10,
		expected: {
			coverLayoutId: "panel-bottom",
			decorId: "route-dash",
			displayFontId: "dela-gothic-one",
			fontPairId: "wayfinding",
			itineraryTemplateId: "route-thread",
			moodId: "night-train",
			paletteId: "night-window",
		},
	},
	{
		seed: 11,
		expected: {
			coverLayoutId: "south-west",
			decorId: "dotted-grid",
			displayFontId: "zen-kurenaido",
			fontPairId: "classic",
			itineraryTemplateId: "field-journal",
			moodId: "field-notes",
			paletteId: "cobalt-sunrise",
		},
	},
	{
		seed: 14,
		expected: {
			coverLayoutId: "poster",
			decorId: "route-dash",
			displayFontId: "kaisei-decol",
			fontPairId: "wayfinding",
			itineraryTemplateId: "route-thread",
			moodId: "night-train",
			paletteId: "plum-sunset",
		},
	},
	{
		seed: 15,
		expected: {
			coverLayoutId: "poster",
			decorId: "dashed-ticket",
			displayFontId: "inherit",
			fontPairId: "modern",
			itineraryTemplateId: "travel-ticket",
			moodId: "festival-ticket",
			paletteId: "forest-map",
		},
	},
	{
		seed: 17,
		expected: {
			coverLayoutId: "south-east",
			decorId: "stripe-band",
			displayFontId: "dela-gothic-one",
			fontPairId: "modern",
			itineraryTemplateId: "route-thread",
			moodId: "wayfinder",
			paletteId: "marine-glass",
		},
	},
	{
		seed: 59,
		expected: {
			coverLayoutId: "poster",
			decorId: "route-dash",
			displayFontId: "dela-gothic-one",
			fontPairId: "modern",
			itineraryTemplateId: "rail-ledger",
			moodId: "night-train",
			paletteId: "indigo-mist",
		},
	},
	{
		seed: 23,
		expected: {
			coverLayoutId: "north-east",
			decorId: "stripe-band",
			displayFontId: "rocknroll-one",
			fontPairId: "round-trip",
			itineraryTemplateId: "travel-ticket",
			moodId: "festival-ticket",
			paletteId: "plum-sunset",
		},
	},
	{
		seed: 28,
		expected: {
			coverLayoutId: "center",
			decorId: "hairline-frame",
			displayFontId: "inherit",
			fontPairId: "classic",
			itineraryTemplateId: "banner-list",
			moodId: "postcard",
			paletteId: "cobalt-sunrise",
		},
	},
	{
		seed: 36,
		expected: {
			coverLayoutId: "poster",
			decorId: "hairline-frame",
			displayFontId: "kaisei-decol",
			fontPairId: "modern",
			itineraryTemplateId: "field-journal",
			moodId: "quiet-gallery",
			paletteId: "paper-ink",
		},
	},
];
