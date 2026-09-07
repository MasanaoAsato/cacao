import {
	ThemeRecipeValidationError,
	validateCompositionDefinitions,
	validateCoverLayoutDefinitions,
	validateDecorContrast,
	validateDecorDefinitions,
	validateFontFamilyCombinations,
	validateInkStyleDefinitions,
	validateMoodBodyWidths,
	validatePaletteDefinitions,
	validateUnitFormDefinitions,
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
			compositions: ["top-stack", "center-column"],
			decors: ["dotted-grid", "hairline-frame", "sheet-on-dots", "ring-binder"],
			displayFonts: ["inherit", "zen-kurenaido"],
			fontPairs: ["classic", "literary"],
			inkStyles: ["text", "pill"],
			id: "field-notes",
			itineraryTemplates: ["field-journal", "rail-ledger"],
			unitForms: ["full", "compact"],
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
			compositions: ["top-stack", "side-band"],
			decors: ["stripe-band", "route-dash", "wave-margins"],
			displayFonts: ["inherit", "dela-gothic-one"],
			fontPairs: ["wayfinding", "modern"],
			inkStyles: ["band", "text"],
			id: "wayfinder",
			itineraryTemplates: ["route-thread", "banner-list"],
			unitForms: ["compact", "line"],
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
			compositions: ["two-column", "bottom-anchored"],
			decors: ["hairline-frame", "dotted-grid", "confetti-corners"],
			displayFonts: ["inherit", "zen-kurenaido", "rocknroll-one"],
			fontPairs: ["round-trip", "literary", "classic"],
			inkStyles: ["pill", "zebra"],
			id: "postcard",
			itineraryTemplates: ["travel-ticket", "banner-list"],
			unitForms: ["compact", "line"],
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
			compositions: ["side-band", "top-stack"],
			decors: ["route-dash", "gallery-rule", "bold-frame"],
			displayFonts: ["inherit", "kaisei-decol", "dela-gothic-one"],
			fontPairs: ["modern", "literary", "wayfinding", "round-trip"],
			inkStyles: ["band", "text"],
			id: "night-train",
			itineraryTemplates: ["route-thread", "rail-ledger"],
			unitForms: ["full", "compact"],
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
			compositions: ["center-column", "bottom-anchored"],
			decors: ["gallery-rule", "hairline-frame", "photo-wash"],
			displayFonts: ["inherit", "kaisei-decol"],
			fontPairs: ["literary", "classic", "modern"],
			inkStyles: ["text", "pill"],
			id: "quiet-gallery",
			itineraryTemplates: ["field-journal", "rail-ledger"],
			unitForms: ["full", "compact"],
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
			compositions: ["two-column", "side-band"],
			decors: ["dashed-ticket", "stripe-band", "ticket-notches"],
			displayFonts: ["inherit", "rocknroll-one", "dela-gothic-one"],
			fontPairs: ["round-trip", "wayfinding", "modern"],
			inkStyles: ["zebra", "pill"],
			id: "festival-ticket",
			itineraryTemplates: ["travel-ticket", "banner-list"],
			unitForms: ["compact", "line"],
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
	validateDecorContrast(references);
	validateFontFamilyCombinations(references);
	validatePaletteDefinitions(references);
	validateUnitFormDefinitions(references);
	validateCompositionDefinitions(references);
	validateInkStyleDefinitions(references);
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
		validateList(`雰囲気「${id}」の単位形式`, mood.unitForms, (value) =>
			references.unitForms.has(value),
		);
		validateList(
			`雰囲気「${id}」のページ構図`,
			mood.compositions,
			(value) => references.compositions.get(value)?.selectable === true,
		);
		validateList(`雰囲気「${id}」の色の載せ方`, mood.inkStyles, (value) =>
			references.inkStyles.has(value),
		);
		validateMoodBodyWidths(mood, references);
	}
}

export type V2RepresentativeSeed = {
	readonly expected: Pick<
		ThemeRecipeDefinition,
		| "compositionId"
		| "coverLayoutId"
		| "decorId"
		| "displayFontId"
		| "fontPairId"
		| "inkStyleId"
		| "itineraryTemplateId"
		| "moodId"
		| "paletteId"
		| "unitFormId"
	>;
	readonly seed: number;
};

export const V2_REPRESENTATIVE_SEEDS: readonly V2RepresentativeSeed[] = [
	{
		seed: 0,
		expected: {
			compositionId: "side-band",
			coverLayoutId: "horizon",
			decorId: "route-dash",
			displayFontId: "inherit",
			fontPairId: "wayfinding",
			inkStyleId: "text",
			itineraryTemplateId: "route-thread",
			moodId: "wayfinder",
			paletteId: "marine-glass",
			unitFormId: "line",
		},
	},
	{
		seed: 1,
		expected: {
			compositionId: "top-stack",
			coverLayoutId: "north-east",
			decorId: "wave-margins",
			displayFontId: "inherit",
			fontPairId: "wayfinding",
			inkStyleId: "band",
			itineraryTemplateId: "route-thread",
			moodId: "wayfinder",
			paletteId: "night-window",
			unitFormId: "compact",
		},
	},
	{
		seed: 2,
		expected: {
			compositionId: "two-column",
			coverLayoutId: "split-left",
			decorId: "dashed-ticket",
			displayFontId: "inherit",
			fontPairId: "wayfinding",
			inkStyleId: "zebra",
			itineraryTemplateId: "banner-list",
			moodId: "festival-ticket",
			paletteId: "indigo-mist",
			unitFormId: "line",
		},
	},
	{
		seed: 3,
		expected: {
			compositionId: "center-column",
			coverLayoutId: "window-arch",
			decorId: "hairline-frame",
			displayFontId: "zen-kurenaido",
			fontPairId: "literary",
			inkStyleId: "text",
			itineraryTemplateId: "field-journal",
			moodId: "field-notes",
			paletteId: "graphite",
			unitFormId: "compact",
		},
	},
	{
		seed: 4,
		expected: {
			compositionId: "bottom-anchored",
			coverLayoutId: "horizon",
			decorId: "gallery-rule",
			displayFontId: "kaisei-decol",
			fontPairId: "modern",
			inkStyleId: "text",
			itineraryTemplateId: "field-journal",
			moodId: "quiet-gallery",
			paletteId: "marine-glass",
			unitFormId: "compact",
		},
	},
	{
		seed: 5,
		expected: {
			compositionId: "center-column",
			coverLayoutId: "north-west",
			decorId: "gallery-rule",
			displayFontId: "kaisei-decol",
			fontPairId: "literary",
			inkStyleId: "text",
			itineraryTemplateId: "field-journal",
			moodId: "quiet-gallery",
			paletteId: "graphite",
			unitFormId: "compact",
		},
	},
	{
		seed: 6,
		expected: {
			compositionId: "bottom-anchored",
			coverLayoutId: "center",
			decorId: "hairline-frame",
			displayFontId: "kaisei-decol",
			fontPairId: "classic",
			inkStyleId: "pill",
			itineraryTemplateId: "field-journal",
			moodId: "quiet-gallery",
			paletteId: "marine-glass",
			unitFormId: "compact",
		},
	},
	{
		seed: 7,
		expected: {
			compositionId: "side-band",
			coverLayoutId: "panel-top",
			decorId: "route-dash",
			displayFontId: "inherit",
			fontPairId: "wayfinding",
			inkStyleId: "text",
			itineraryTemplateId: "banner-list",
			moodId: "wayfinder",
			paletteId: "graphite",
			unitFormId: "compact",
		},
	},
	{
		seed: 8,
		expected: {
			compositionId: "side-band",
			coverLayoutId: "poster",
			decorId: "stripe-band",
			displayFontId: "inherit",
			fontPairId: "wayfinding",
			inkStyleId: "text",
			itineraryTemplateId: "banner-list",
			moodId: "wayfinder",
			paletteId: "marine-glass",
			unitFormId: "compact",
		},
	},
	{
		seed: 10,
		expected: {
			compositionId: "side-band",
			coverLayoutId: "panel-bottom",
			decorId: "gallery-rule",
			displayFontId: "dela-gothic-one",
			fontPairId: "wayfinding",
			inkStyleId: "text",
			itineraryTemplateId: "route-thread",
			moodId: "night-train",
			paletteId: "night-window",
			unitFormId: "compact",
		},
	},
	{
		seed: 11,
		expected: {
			compositionId: "center-column",
			coverLayoutId: "south-west",
			decorId: "hairline-frame",
			displayFontId: "zen-kurenaido",
			fontPairId: "classic",
			inkStyleId: "pill",
			itineraryTemplateId: "field-journal",
			moodId: "field-notes",
			paletteId: "cobalt-sunrise",
			unitFormId: "compact",
		},
	},
	{
		seed: 13,
		expected: {
			compositionId: "center-column",
			coverLayoutId: "north-west",
			decorId: "dotted-grid",
			displayFontId: "zen-kurenaido",
			fontPairId: "literary",
			inkStyleId: "pill",
			itineraryTemplateId: "field-journal",
			moodId: "field-notes",
			paletteId: "cobalt-sunrise",
			unitFormId: "compact",
		},
	},
	{
		seed: 14,
		expected: {
			compositionId: "top-stack",
			coverLayoutId: "poster",
			decorId: "gallery-rule",
			displayFontId: "kaisei-decol",
			fontPairId: "wayfinding",
			inkStyleId: "text",
			itineraryTemplateId: "route-thread",
			moodId: "night-train",
			paletteId: "plum-sunset",
			unitFormId: "compact",
		},
	},
	{
		seed: 15,
		expected: {
			compositionId: "side-band",
			coverLayoutId: "poster",
			decorId: "dashed-ticket",
			displayFontId: "inherit",
			fontPairId: "modern",
			inkStyleId: "zebra",
			itineraryTemplateId: "travel-ticket",
			moodId: "festival-ticket",
			paletteId: "forest-map",
			unitFormId: "compact",
		},
	},
	{
		seed: 17,
		expected: {
			compositionId: "side-band",
			coverLayoutId: "south-east",
			decorId: "stripe-band",
			displayFontId: "dela-gothic-one",
			fontPairId: "modern",
			inkStyleId: "text",
			itineraryTemplateId: "route-thread",
			moodId: "wayfinder",
			paletteId: "marine-glass",
			unitFormId: "line",
		},
	},
	{
		seed: 20,
		expected: {
			compositionId: "side-band",
			coverLayoutId: "south-west",
			decorId: "ticket-notches",
			displayFontId: "rocknroll-one",
			fontPairId: "modern",
			inkStyleId: "zebra",
			itineraryTemplateId: "travel-ticket",
			moodId: "festival-ticket",
			paletteId: "indigo-mist",
			unitFormId: "compact",
		},
	},
	{
		seed: 22,
		expected: {
			compositionId: "bottom-anchored",
			coverLayoutId: "horizon",
			decorId: "hairline-frame",
			displayFontId: "kaisei-decol",
			fontPairId: "classic",
			inkStyleId: "text",
			itineraryTemplateId: "rail-ledger",
			moodId: "quiet-gallery",
			paletteId: "paper-ink",
			unitFormId: "full",
		},
	},
	{
		seed: 23,
		expected: {
			compositionId: "side-band",
			coverLayoutId: "north-east",
			decorId: "ticket-notches",
			displayFontId: "rocknroll-one",
			fontPairId: "round-trip",
			inkStyleId: "zebra",
			itineraryTemplateId: "travel-ticket",
			moodId: "festival-ticket",
			paletteId: "plum-sunset",
			unitFormId: "compact",
		},
	},
	{
		seed: 24,
		expected: {
			compositionId: "center-column",
			coverLayoutId: "north-west",
			decorId: "ring-binder",
			displayFontId: "zen-kurenaido",
			fontPairId: "classic",
			inkStyleId: "text",
			itineraryTemplateId: "rail-ledger",
			moodId: "field-notes",
			paletteId: "cobalt-sunrise",
			unitFormId: "compact",
		},
	},
	{
		seed: 25,
		expected: {
			compositionId: "top-stack",
			coverLayoutId: "north-west",
			decorId: "sheet-on-dots",
			displayFontId: "inherit",
			fontPairId: "literary",
			inkStyleId: "pill",
			itineraryTemplateId: "rail-ledger",
			moodId: "field-notes",
			paletteId: "forest-map",
			unitFormId: "compact",
		},
	},
	{
		seed: 28,
		expected: {
			compositionId: "two-column",
			coverLayoutId: "center",
			decorId: "hairline-frame",
			displayFontId: "inherit",
			fontPairId: "classic",
			inkStyleId: "zebra",
			itineraryTemplateId: "banner-list",
			moodId: "postcard",
			paletteId: "cobalt-sunrise",
			unitFormId: "line",
		},
	},
	{
		seed: 30,
		expected: {
			compositionId: "bottom-anchored",
			coverLayoutId: "north-west",
			decorId: "confetti-corners",
			displayFontId: "inherit",
			fontPairId: "literary",
			inkStyleId: "pill",
			itineraryTemplateId: "banner-list",
			moodId: "postcard",
			paletteId: "cobalt-sunrise",
			unitFormId: "compact",
		},
	},
	{
		seed: 45,
		expected: {
			compositionId: "side-band",
			coverLayoutId: "split-left",
			decorId: "bold-frame",
			displayFontId: "inherit",
			fontPairId: "modern",
			inkStyleId: "band",
			itineraryTemplateId: "rail-ledger",
			moodId: "night-train",
			paletteId: "plum-sunset",
			unitFormId: "compact",
		},
	},
	{
		seed: 46,
		expected: {
			compositionId: "bottom-anchored",
			coverLayoutId: "poster",
			decorId: "photo-wash",
			displayFontId: "kaisei-decol",
			fontPairId: "classic",
			inkStyleId: "text",
			itineraryTemplateId: "field-journal",
			moodId: "quiet-gallery",
			paletteId: "marine-glass",
			unitFormId: "compact",
		},
	},
];
