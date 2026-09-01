import {
	buildThemeCandidates,
	defineThemeRecipe,
	ThemeRecipeValidationError,
	validateThemeCatalog,
} from "./recipeSafety";
import { formatThemeSeed, mulberry32 } from "./seed";
import type {
	BookletThemeCandidate,
	CoverLayoutDefinition,
	DensityDefinition,
	EmphasisDefinition,
	FontPairDefinition,
	ItineraryTemplateDefinition,
	PaletteDefinition,
	RequestedBookletTheme,
	ResolvedBookletTheme,
	SignatureDefinition,
	ThemeCatalogReferences,
	ThemeRecipeDefinition,
	ThemeSeed,
	TypographySafety,
} from "./types";

const typography = (
	spacingMultiplier: number,
	pageMarginMm: number,
): TypographySafety => ({
	body: { fontSizePt: 10, letterSpacingEm: 0, lineHeight: 1.65 },
	coverTitle: { fontSizePt: 34, letterSpacingEm: 0.02, lineHeight: 1.2 },
	dayTitle: { fontSizePt: 20, letterSpacingEm: 0.02, lineHeight: 1.3 },
	detailWidthMm: 76,
	emphasized: { fontSizePt: 11, letterSpacingEm: 0.02, lineHeight: 1.35 },
	pageMarginMm,
	spacingMultiplier,
	spotTitle: { fontSizePt: 15, letterSpacingEm: 0.02, lineHeight: 1.35 },
	utility: { fontSizePt: 8, letterSpacingEm: 0.06, lineHeight: 1.45 },
	utilityWidthMm: 22,
});

const FONT_PAIRS = new Map<FontPairDefinition["id"], FontPairDefinition>([
	[
		"classic",
		{
			bodyFamily: '"Noto Serif JP", serif',
			families: ["Noto Serif JP"],
			headingFamily: '"Noto Serif JP", serif',
			id: "classic",
			utilityFamily: '"Noto Serif JP", serif',
		},
	],
	[
		"literary",
		{
			bodyFamily: '"Shippori Mincho", serif',
			families: ["Shippori Mincho", "Noto Sans JP"],
			headingFamily: '"Shippori Mincho", serif',
			id: "literary",
			utilityFamily: '"Noto Sans JP", sans-serif',
		},
	],
	[
		"wayfinding",
		{
			bodyFamily: '"Zen Kaku Gothic New", sans-serif',
			families: ["Zen Kaku Gothic New", "Noto Sans JP"],
			headingFamily: '"Zen Kaku Gothic New", sans-serif',
			id: "wayfinding",
			utilityFamily: '"Noto Sans JP", sans-serif',
		},
	],
	[
		"modern",
		{
			bodyFamily: '"Noto Sans JP", sans-serif',
			families: ["Noto Sans JP"],
			headingFamily: '"Noto Sans JP", sans-serif',
			id: "modern",
			utilityFamily: '"Noto Sans JP", sans-serif',
		},
	],
	[
		"round-trip",
		{
			bodyFamily: '"Noto Sans JP", sans-serif',
			families: ["M PLUS Rounded 1c", "Noto Sans JP"],
			headingFamily: '"M PLUS Rounded 1c", sans-serif',
			id: "round-trip",
			utilityFamily: '"Noto Sans JP", sans-serif',
		},
	],
]);

const PALETTES = new Map<PaletteDefinition["id"], PaletteDefinition>([
	[
		"paper-ink",
		{
			accent: "#8A3A18",
			background: "#F7F2E8",
			border: "#BDB3A3",
			coverInk: "#1D1B18",
			coverVeil: "#FFFFFF",
			coverVeilOpacity: 0.36,
			id: "paper-ink",
			muted: "#585249",
			surfaceStops: ["#F7F2E8", "#F7F2E8"],
			text: "#1D1B18",
		},
	],
	[
		"graphite",
		{
			accent: "#30373D",
			background: "#F1F2F2",
			border: "#B7BDC0",
			coverInk: "#111315",
			coverVeil: "#FFFFFF",
			coverVeilOpacity: 0.36,
			id: "graphite",
			muted: "#4D5357",
			surfaceStops: ["#F1F2F2", "#F1F2F2"],
			text: "#111315",
		},
	],
	[
		"indigo-mist",
		{
			accent: "#5746A3",
			background: "linear-gradient(145deg, #F2F0FA, #E8EDF8)",
			border: "#C5C0DC",
			coverInk: "#1D1933",
			coverVeil: "#FFFFFF",
			coverVeilOpacity: 0.36,
			id: "indigo-mist",
			muted: "#56506D",
			surfaceStops: ["#F2F0FA", "#E8EDF8"],
			text: "#1D1933",
		},
	],
	[
		"marine-glass",
		{
			accent: "#006E73",
			background: "linear-gradient(160deg, #ECF6F5, #E5F1EC)",
			border: "#B9D1CF",
			coverInk: "#102C2F",
			coverVeil: "#FFFFFF",
			coverVeilOpacity: 0.36,
			id: "marine-glass",
			muted: "#456064",
			surfaceStops: ["#ECF6F5", "#E5F1EC"],
			text: "#102C2F",
		},
	],
	[
		"plum-sunset",
		{
			accent: "#982D5A",
			background: "linear-gradient(145deg, #FAEFF3, #F6E9DE)",
			border: "#D8BEC8",
			coverInk: "#321621",
			coverVeil: "#FFFFFF",
			coverVeilOpacity: 0.36,
			id: "plum-sunset",
			muted: "#6B4F59",
			surfaceStops: ["#FAEFF3", "#F6E9DE"],
			text: "#321621",
		},
	],
	[
		"forest-map",
		{
			accent: "#4B6C2F",
			background: "#EFF4EA",
			border: "#BFCFB7",
			coverInk: "#182718",
			coverVeil: "#FFFFFF",
			coverVeilOpacity: 0.36,
			id: "forest-map",
			muted: "#4E604B",
			surfaceStops: ["#EFF4EA", "#EFF4EA"],
			text: "#182718",
		},
	],
	[
		"cobalt-sunrise",
		{
			accent: "#165DAD",
			background: "linear-gradient(160deg, #F4F5FB, #EAF2F7)",
			border: "#C2CCDA",
			coverInk: "#14233B",
			coverVeil: "#FFFFFF",
			coverVeilOpacity: 0.36,
			id: "cobalt-sunrise",
			muted: "#4D5B6D",
			surfaceStops: ["#F4F5FB", "#EAF2F7"],
			text: "#14233B",
		},
	],
	[
		"night-window",
		{
			accent: "#F1B84B",
			background: "linear-gradient(160deg, #161A21, #222A35)",
			border: "#414956",
			coverInk: "#F5F1E8",
			coverVeil: "#000000",
			coverVeilOpacity: 0.42,
			id: "night-window",
			muted: "#BEC2C9",
			surfaceStops: ["#161A21", "#222A35"],
			text: "#F5F1E8",
			itinerary: {
				accent: "#8A5000",
				border: "#B5C0C8",
				muted: "#52606B",
				surfaceStops: ["#EDF1F3", "#E4EAEE"],
				text: "#18212A",
			},
		},
	],
]);

const COVER_LAYOUTS = new Map<
	CoverLayoutDefinition["id"],
	CoverLayoutDefinition
>([
	["center", { id: "center", textAreaHeightMm: 76, textAreaWidthMm: 104 }],
	[
		"north-west",
		{ id: "north-west", textAreaHeightMm: 70, textAreaWidthMm: 80 },
	],
	[
		"north-east",
		{ id: "north-east", textAreaHeightMm: 70, textAreaWidthMm: 80 },
	],
	[
		"south-west",
		{ id: "south-west", textAreaHeightMm: 70, textAreaWidthMm: 80 },
	],
	[
		"south-east",
		{ id: "south-east", textAreaHeightMm: 70, textAreaWidthMm: 80 },
	],
	[
		"split-left",
		{ id: "split-left", textAreaHeightMm: 186, textAreaWidthMm: 58 },
	],
	["horizon", { id: "horizon", textAreaHeightMm: 62, textAreaWidthMm: 124 }],
]);

const ITINERARY_LAYOUTS = new Map<
	ItineraryTemplateDefinition["id"],
	ItineraryTemplateDefinition
>([
	["route-thread", { id: "route-thread" }],
	["field-journal", { id: "field-journal" }],
	["travel-ticket", { id: "travel-ticket" }],
]);

const EMPHASIS = new Map<EmphasisDefinition["id"], EmphasisDefinition>([
	["place-led", { id: "place-led", target: "uniform" }],
	["time-led", { id: "time-led", target: "time" }],
	["route-led", { id: "route-led", target: "route" }],
	["balanced", { id: "balanced", target: "uniform" }],
]);

const DENSITIES = new Map<DensityDefinition["id"], DensityDefinition>([
	["compact", { id: "compact", spacingMultiplier: 0.86 }],
	["balanced", { id: "balanced", spacingMultiplier: 1 }],
	["airy", { id: "airy", spacingMultiplier: 1.14 }],
]);

const SIGNATURES = new Map<SignatureDefinition["id"], SignatureDefinition>([
	["field-notes", { id: "field-notes" }],
	["wayfinder", { id: "wayfinder" }],
	["postcard", { id: "postcard" }],
	["night-train", { id: "night-train" }],
	["quiet-gallery", { id: "quiet-gallery" }],
	["festival-ticket", { id: "festival-ticket" }],
]);

export const THEME_CATALOG_REFERENCES: ThemeCatalogReferences = {
	coverLayouts: COVER_LAYOUTS,
	densities: DENSITIES,
	emphasis: EMPHASIS,
	fonts: FONT_PAIRS,
	itineraries: ITINERARY_LAYOUTS,
	palettes: PALETTES,
	signatures: SIGNATURES,
};

type RecipeValues = Omit<ThemeRecipeDefinition, "typography">;

function recipe(values: RecipeValues): ThemeRecipeDefinition {
	const density = DENSITIES.get(values.densityId);
	if (!density) {
		throw new ThemeRecipeValidationError(
			`密度「${values.densityId}」がありません。`,
		);
	}
	const pageMarginMm =
		values.densityId === "compact" ? 10 : values.densityId === "airy" ? 14 : 12;
	return defineThemeRecipe(
		{
			...values,
			typography: typography(density.spacingMultiplier, pageMarginMm),
		},
		THEME_CATALOG_REFERENCES,
	);
}

export const THEME_RECIPES_V1: readonly ThemeRecipeDefinition[] = Object.freeze(
	[
		recipe({
			coverLayoutId: "north-west",
			densityId: "balanced",
			emphasisId: "place-led",
			fontPairId: "classic",
			id: "field-01",
			itineraryTemplateId: "field-journal",
			paletteId: "paper-ink",
			signatureId: "field-notes",
		}),
		recipe({
			coverLayoutId: "south-west",
			densityId: "airy",
			emphasisId: "route-led",
			fontPairId: "literary",
			id: "field-02",
			itineraryTemplateId: "field-journal",
			paletteId: "forest-map",
			signatureId: "field-notes",
		}),
		recipe({
			coverLayoutId: "split-left",
			densityId: "compact",
			emphasisId: "balanced",
			fontPairId: "classic",
			id: "field-03",
			itineraryTemplateId: "field-journal",
			paletteId: "graphite",
			signatureId: "field-notes",
		}),
		recipe({
			coverLayoutId: "horizon",
			densityId: "balanced",
			emphasisId: "time-led",
			fontPairId: "literary",
			id: "field-04",
			itineraryTemplateId: "field-journal",
			paletteId: "cobalt-sunrise",
			signatureId: "field-notes",
		}),
		recipe({
			coverLayoutId: "north-east",
			densityId: "compact",
			emphasisId: "time-led",
			fontPairId: "wayfinding",
			id: "way-01",
			itineraryTemplateId: "route-thread",
			paletteId: "graphite",
			signatureId: "wayfinder",
		}),
		recipe({
			coverLayoutId: "split-left",
			densityId: "balanced",
			emphasisId: "route-led",
			fontPairId: "modern",
			id: "way-02",
			itineraryTemplateId: "route-thread",
			paletteId: "cobalt-sunrise",
			signatureId: "wayfinder",
		}),
		recipe({
			coverLayoutId: "south-east",
			densityId: "balanced",
			emphasisId: "place-led",
			fontPairId: "wayfinding",
			id: "way-03",
			itineraryTemplateId: "route-thread",
			paletteId: "marine-glass",
			signatureId: "wayfinder",
		}),
		recipe({
			coverLayoutId: "horizon",
			densityId: "compact",
			emphasisId: "time-led",
			fontPairId: "modern",
			id: "way-04",
			itineraryTemplateId: "route-thread",
			paletteId: "night-window",
			signatureId: "wayfinder",
		}),
		recipe({
			coverLayoutId: "center",
			densityId: "airy",
			emphasisId: "place-led",
			fontPairId: "round-trip",
			id: "postcard-01",
			itineraryTemplateId: "travel-ticket",
			paletteId: "plum-sunset",
			signatureId: "postcard",
		}),
		recipe({
			coverLayoutId: "south-east",
			densityId: "balanced",
			emphasisId: "place-led",
			fontPairId: "literary",
			id: "postcard-02",
			itineraryTemplateId: "travel-ticket",
			paletteId: "paper-ink",
			signatureId: "postcard",
		}),
		recipe({
			coverLayoutId: "north-west",
			densityId: "balanced",
			emphasisId: "route-led",
			fontPairId: "round-trip",
			id: "postcard-03",
			itineraryTemplateId: "travel-ticket",
			paletteId: "cobalt-sunrise",
			signatureId: "postcard",
		}),
		recipe({
			coverLayoutId: "horizon",
			densityId: "airy",
			emphasisId: "balanced",
			fontPairId: "classic",
			id: "postcard-04",
			itineraryTemplateId: "travel-ticket",
			paletteId: "marine-glass",
			signatureId: "postcard",
		}),
		recipe({
			coverLayoutId: "center",
			densityId: "compact",
			emphasisId: "time-led",
			fontPairId: "modern",
			id: "night-01",
			itineraryTemplateId: "route-thread",
			paletteId: "night-window",
			signatureId: "night-train",
		}),
		recipe({
			coverLayoutId: "north-east",
			densityId: "balanced",
			emphasisId: "place-led",
			fontPairId: "literary",
			id: "night-02",
			itineraryTemplateId: "route-thread",
			paletteId: "plum-sunset",
			signatureId: "night-train",
		}),
		recipe({
			coverLayoutId: "split-left",
			densityId: "compact",
			emphasisId: "route-led",
			fontPairId: "wayfinding",
			id: "night-03",
			itineraryTemplateId: "route-thread",
			paletteId: "night-window",
			signatureId: "night-train",
		}),
		recipe({
			coverLayoutId: "south-west",
			densityId: "airy",
			emphasisId: "balanced",
			fontPairId: "round-trip",
			id: "night-04",
			itineraryTemplateId: "route-thread",
			paletteId: "indigo-mist",
			signatureId: "night-train",
		}),
		recipe({
			coverLayoutId: "center",
			densityId: "airy",
			emphasisId: "balanced",
			fontPairId: "literary",
			id: "quiet-01",
			itineraryTemplateId: "field-journal",
			paletteId: "graphite",
			signatureId: "quiet-gallery",
		}),
		recipe({
			coverLayoutId: "north-west",
			densityId: "balanced",
			emphasisId: "place-led",
			fontPairId: "classic",
			id: "quiet-02",
			itineraryTemplateId: "field-journal",
			paletteId: "paper-ink",
			signatureId: "quiet-gallery",
		}),
		recipe({
			coverLayoutId: "south-east",
			densityId: "airy",
			emphasisId: "time-led",
			fontPairId: "modern",
			id: "quiet-03",
			itineraryTemplateId: "field-journal",
			paletteId: "marine-glass",
			signatureId: "quiet-gallery",
		}),
		recipe({
			coverLayoutId: "horizon",
			densityId: "balanced",
			emphasisId: "route-led",
			fontPairId: "literary",
			id: "quiet-04",
			itineraryTemplateId: "field-journal",
			paletteId: "forest-map",
			signatureId: "quiet-gallery",
		}),
		recipe({
			coverLayoutId: "south-west",
			densityId: "balanced",
			emphasisId: "place-led",
			fontPairId: "round-trip",
			id: "ticket-01",
			itineraryTemplateId: "travel-ticket",
			paletteId: "plum-sunset",
			signatureId: "festival-ticket",
		}),
		recipe({
			coverLayoutId: "north-east",
			densityId: "compact",
			emphasisId: "time-led",
			fontPairId: "wayfinding",
			id: "ticket-02",
			itineraryTemplateId: "travel-ticket",
			paletteId: "cobalt-sunrise",
			signatureId: "festival-ticket",
		}),
		recipe({
			coverLayoutId: "split-left",
			densityId: "balanced",
			emphasisId: "route-led",
			fontPairId: "modern",
			id: "ticket-03",
			itineraryTemplateId: "travel-ticket",
			paletteId: "indigo-mist",
			signatureId: "festival-ticket",
		}),
		recipe({
			coverLayoutId: "center",
			densityId: "airy",
			emphasisId: "balanced",
			fontPairId: "round-trip",
			id: "ticket-04",
			itineraryTemplateId: "travel-ticket",
			paletteId: "forest-map",
			signatureId: "festival-ticket",
		}),
	],
);

export const V1_REPRESENTATIVE_SEEDS = new Map<number, string>([
	[0x00000007, "field-01"],
	[0x00000013, "field-02"],
	[0x00000017, "field-03"],
	[0x00000008, "field-04"],
	[0x00000009, "way-01"],
	[0x0000000f, "way-02"],
	[0x00000000, "way-03"],
	[0x00000018, "way-04"],
	[0x00000031, "postcard-01"],
	[0x00000012, "postcard-02"],
	[0x0000000e, "postcard-03"],
	[0x0000003a, "postcard-04"],
	[0x00000006, "night-01"],
	[0x0000000d, "night-02"],
	[0x00000016, "night-03"],
	[0x00000001, "night-04"],
	[0x00000005, "quiet-01"],
	[0x00000002, "quiet-02"],
	[0x00000014, "quiet-03"],
	[0x00000045, "quiet-04"],
	[0x0000001e, "ticket-01"],
	[0x0000008f, "ticket-02"],
	[0x00000004, "ticket-03"],
	[0x0000002b, "ticket-04"],
]);

let catalogValidationError: ThemeRecipeValidationError | null = null;
let catalogValidated = false;

export function validateV1ThemeCatalog(): void {
	if (catalogValidated) {
		if (catalogValidationError) {
			throw catalogValidationError;
		}
		return;
	}
	catalogValidated = true;
	try {
		if (THEME_RECIPES_V1.length !== 24) {
			throw new ThemeRecipeValidationError(
				"V1テーマカタログは24件でなければなりません。",
			);
		}
		validateThemeCatalog(THEME_RECIPES_V1, THEME_CATALOG_REFERENCES);
		for (const [seedValue, expectedRecipeId] of V1_REPRESENTATIVE_SEEDS) {
			const recipe = selectV1Recipe({ value: seedValue, version: "v1" });
			if (recipe.id !== expectedRecipeId) {
				throw new ThemeRecipeValidationError(
					`代表シード${seedValue.toString(16)}は${expectedRecipeId}へ解決されなければなりません。`,
				);
			}
		}
	} catch (error) {
		catalogValidationError =
			error instanceof ThemeRecipeValidationError
				? error
				: new ThemeRecipeValidationError(
						"しおりのデザイン定義を読み込めませんでした。",
					);
		throw catalogValidationError;
	}
}

export function selectV1Recipe(seed: ThemeSeed): ThemeRecipeDefinition {
	const random = mulberry32(seed.value)();
	const index = Math.floor(random * THEME_RECIPES_V1.length);
	const recipe = THEME_RECIPES_V1[index];
	if (!recipe) {
		throw new ThemeRecipeValidationError(
			"テーマレシピを選択できませんでした。",
		);
	}
	return recipe;
}

export function createBookletTheme(seed: ThemeSeed): RequestedBookletTheme {
	validateV1ThemeCatalog();
	return Object.freeze({
		catalogVersion: "v1",
		recipe: selectV1Recipe(seed),
		seed,
		seedToken: formatThemeSeed(seed),
	});
}

export function getThemeCandidates(
	requested: RequestedBookletTheme,
): readonly BookletThemeCandidate[] {
	validateV1ThemeCatalog();
	return buildThemeCandidates(requested, THEME_CATALOG_REFERENCES);
}

export function resolveBookletTheme(
	requested: RequestedBookletTheme,
	candidate: BookletThemeCandidate,
): ResolvedBookletTheme {
	return Object.freeze({
		...candidate,
		catalogVersion: requested.catalogVersion,
		seed: requested.seed,
		seedToken: requested.seedToken,
	});
}

function formatPoints(value: number): string {
	return `${Number(value.toFixed(2))}pt`;
}

export function getBookletThemeCssVariables(
	theme: BookletThemeCandidate,
): Readonly<Record<`--booklet-${string}`, string>> {
	const font = FONT_PAIRS.get(theme.fontPairId);
	const palette = PALETTES.get(theme.paletteId);
	if (!font || !palette) {
		throw new ThemeRecipeValidationError(
			"テーマの書体または配色がありません。",
		);
	}
	const itinerary = palette.itinerary ?? palette;
	return Object.freeze({
		"--booklet-accent": palette.accent,
		"--booklet-background": palette.background,
		"--booklet-body-family": font.bodyFamily,
		"--booklet-body-letter-spacing": `${theme.typography.body.letterSpacingEm}em`,
		"--booklet-body-line-height": `${theme.typography.body.lineHeight}`,
		"--booklet-body-size": `${theme.typography.body.fontSizePt}pt`,
		"--booklet-border": palette.border,
		"--booklet-cover-ink": palette.coverInk,
		"--booklet-cover-veil": palette.coverVeil,
		"--booklet-cover-veil-opacity": `${palette.coverVeilOpacity}`,
		"--booklet-cover-title-letter-spacing": `${theme.typography.coverTitle.letterSpacingEm}em`,
		"--booklet-cover-title-line-height": `${theme.typography.coverTitle.lineHeight}`,
		"--booklet-cover-title-size": formatPoints(
			theme.typography.coverTitle.fontSizePt,
		),
		"--booklet-cover-title-size-long": formatPoints(
			Math.max(22, theme.typography.coverTitle.fontSizePt * 0.8),
		),
		"--booklet-cover-title-size-very-long": formatPoints(
			Math.max(22, theme.typography.coverTitle.fontSizePt * 0.6),
		),
		"--booklet-itinerary-accent": itinerary.accent,
		"--booklet-itinerary-border": itinerary.border,
		"--booklet-itinerary-muted": itinerary.muted,
		"--booklet-itinerary-surface": itinerary.surfaceStops[0],
		"--booklet-itinerary-text": itinerary.text,
		"--booklet-day-title-letter-spacing": `${theme.typography.dayTitle.letterSpacingEm}em`,
		"--booklet-day-title-line-height": `${theme.typography.dayTitle.lineHeight}`,
		"--booklet-day-title-size": formatPoints(
			theme.typography.dayTitle.fontSizePt,
		),
		"--booklet-emphasis-line-height": `${theme.typography.emphasized.lineHeight}`,
		"--booklet-emphasis-size": formatPoints(
			theme.typography.emphasized.fontSizePt,
		),
		"--booklet-heading-family": font.headingFamily,
		"--booklet-muted": palette.muted,
		"--booklet-page-margin": `${theme.typography.pageMarginMm}mm`,
		"--booklet-spacing": `${theme.typography.spacingMultiplier}`,
		"--booklet-spot-title-letter-spacing": `${theme.typography.spotTitle.letterSpacingEm}em`,
		"--booklet-spot-title-line-height": `${theme.typography.spotTitle.lineHeight}`,
		"--booklet-spot-title-size": formatPoints(
			theme.typography.spotTitle.fontSizePt,
		),
		"--booklet-text": palette.text,
		"--booklet-utility-family": font.utilityFamily,
		"--booklet-utility-letter-spacing": `${theme.typography.utility.letterSpacingEm}em`,
		"--booklet-utility-line-height": `${theme.typography.utility.lineHeight}`,
		"--booklet-utility-size": formatPoints(theme.typography.utility.fontSizePt),
	});
}

export function getBookletPageSurface(
	theme: BookletThemeCandidate,
): readonly [string, string] {
	const palette = PALETTES.get(theme.paletteId);
	if (!palette) {
		throw new ThemeRecipeValidationError("テーマの配色がありません。");
	}
	return palette.itinerary?.surfaceStops ?? palette.surfaceStops;
}
