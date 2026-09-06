export type ThemeCatalogVersion = "v2";

export type FontPairId =
	| "classic"
	| "literary"
	| "wayfinding"
	| "modern"
	| "round-trip";

export type PaletteId =
	| "paper-ink"
	| "graphite"
	| "indigo-mist"
	| "marine-glass"
	| "plum-sunset"
	| "forest-map"
	| "cobalt-sunrise"
	| "night-window";

export type CoverLayoutId =
	| "center"
	| "north-west"
	| "north-east"
	| "south-west"
	| "south-east"
	| "split-left"
	| "horizon"
	| "panel-bottom"
	| "panel-top"
	| "window-arch"
	| "poster"
	| "safe-cover";

export type ItineraryTemplateId =
	| "route-thread"
	| "field-journal"
	| "travel-ticket"
	| "rail-ledger"
	| "banner-list";

export type EmphasisId = "place-led" | "balanced" | "route-led" | "time-led";

export type DensityId = "airy" | "balanced" | "compact";

export type MoodId =
	| "field-notes"
	| "wayfinder"
	| "postcard"
	| "night-train"
	| "quiet-gallery"
	| "festival-ticket";

export type DisplayFontId =
	| "inherit"
	| "dela-gothic-one"
	| "zen-kurenaido"
	| "kaisei-decol"
	| "rocknroll-one";

export type DecorId =
	| "hairline-frame"
	| "dashed-ticket"
	| "dotted-grid"
	| "stripe-band"
	| "route-dash"
	| "gallery-rule"
	| "none";

export type CoverVisualStyle =
	| "editorial-photograph"
	| "cinematic-photograph"
	| "watercolor"
	| "gouache"
	| "oil-painting"
	| "pastel";

export type ThemeSeed = {
	readonly value: number;
	readonly version: ThemeCatalogVersion;
};

export type CoverVeilBounds = {
	readonly height: number;
	readonly width: number;
	readonly x: number;
	readonly y: number;
};

export type TypographySafety = {
	readonly body: TextStyleSafety;
	readonly coverTitle: TextStyleSafety;
	readonly dayTitle: TextStyleSafety;
	readonly emphasized: TextStyleSafety;
	readonly spotTitle: TextStyleSafety;
	readonly utility: TextStyleSafety;
	readonly detailWidthMm: number;
	readonly utilityWidthMm: number;
	readonly pageMarginMm: number;
	readonly spacingMultiplier: number;
};

export type TextStyleSafety = {
	readonly fontSizePt: number;
	readonly letterSpacingEm: number;
	readonly lineHeight: number;
};

export type FontPairDefinition = {
	readonly bodyFamily: string;
	readonly families: readonly string[];
	readonly headingFamily: string;
	readonly id: FontPairId;
	readonly utilityFamily: string;
};

export type PaletteDefinition = {
	readonly accent: string;
	readonly background: string;
	readonly border: string;
	readonly coverInk: string;
	readonly coverVeil: string;
	readonly coverVeilOpacity: number;
	readonly id: PaletteId;
	readonly muted: string;
	readonly surfaceStops: readonly [string, string];
	readonly text: string;
	readonly itinerary?: ItineraryPaletteDefinition;
};

export type ItineraryPaletteDefinition = {
	readonly accent: string;
	readonly border: string;
	readonly muted: string;
	readonly surfaceStops: readonly [string, string];
	readonly text: string;
};

export type CoverLayoutDefinition = {
	readonly id: CoverLayoutId;
	readonly selectable: boolean;
	readonly imageFrame: {
		readonly heightMm: number;
		readonly shape: "rect" | "arch";
		readonly widthMm: number;
		readonly xMm: number;
		readonly yMm: number;
	};
	readonly textBox: {
		readonly align: "left" | "center";
		readonly anchorX: "left" | "right";
		readonly anchorY: "top" | "bottom";
		readonly offsetXMm: number;
		readonly offsetYMm: number;
		readonly paddingMm: number;
		readonly widthMm: number;
	};
	readonly safeArea: {
		readonly heightMm: number;
		readonly widthMm: number;
		readonly xMm: number;
		readonly yMm: number;
	};
	readonly titleSizePt: number | null;
	readonly veil: "radial" | "linear-x" | "linear-y" | "none";
};

export type ItineraryTemplateDefinition = {
	readonly id: ItineraryTemplateId;
};

export type EmphasisDefinition = {
	readonly id: EmphasisId;
	readonly target: "route" | "time" | "uniform";
};

export type DensityDefinition = {
	readonly id: DensityId;
	readonly spacingMultiplier: number;
};

export type DisplayFontDefinition = {
	readonly family: string | null;
	readonly id: DisplayFontId;
	readonly package: string | null;
	readonly weight: 400 | 700;
};

export type DecorDefinition = {
	readonly contentInsetTopMm: number;
	readonly coverPaddingMm: number;
	readonly id: DecorId;
};

export type MoodDefinition = {
	readonly coverLayouts: readonly CoverLayoutId[];
	readonly decors: readonly DecorId[];
	readonly displayFonts: readonly DisplayFontId[];
	readonly fontPairs: readonly FontPairId[];
	readonly id: MoodId;
	readonly itineraryTemplates: readonly ItineraryTemplateId[];
	readonly palettes: readonly PaletteId[];
};

export type ThemeContext = {
	readonly coverVisualStyle: CoverVisualStyle | null;
};

export type CompatibilityRule = {
	readonly when: {
		readonly coverVisualStyle: readonly CoverVisualStyle[];
	};
	readonly exclude: {
		readonly coverLayouts?: readonly CoverLayoutId[];
		readonly decors?: readonly DecorId[];
		readonly palettes?: readonly PaletteId[];
	};
};

export type ThemeRecipeDefinition = {
	readonly coverLayoutId: CoverLayoutId;
	readonly decorId: DecorId;
	readonly densityId: DensityId;
	readonly displayFontId: DisplayFontId;
	readonly emphasisId: EmphasisId;
	readonly fontPairId: FontPairId;
	readonly id: string;
	readonly itineraryTemplateId: ItineraryTemplateId;
	readonly moodId: MoodId;
	readonly paletteId: PaletteId;
	readonly typography: TypographySafety;
};

export type RequestedBookletTheme = {
	readonly catalogVersion: ThemeCatalogVersion;
	readonly recipe: ThemeRecipeDefinition;
	readonly seed: ThemeSeed;
	readonly seedToken: string;
};

export type FallbackStep =
	| "selected"
	| "balanced-density"
	| "compact-density"
	| "safe-geometry";

export type BookletThemeCandidate = {
	readonly coverLayoutId: CoverLayoutId;
	readonly decorId: DecorId;
	readonly densityId: DensityId;
	readonly displayFontId: DisplayFontId;
	readonly emphasisId: EmphasisId;
	readonly fallbackStep: FallbackStep;
	readonly fontPairId: FontPairId;
	readonly itineraryTemplateId: ItineraryTemplateId;
	readonly moodId: MoodId;
	readonly paletteId: PaletteId;
	readonly requestedRecipeId: string;
	readonly resolvedThemeKey: string;
	readonly typography: TypographySafety;
};

export type ResolvedBookletTheme = BookletThemeCandidate & {
	readonly catalogVersion: ThemeCatalogVersion;
	readonly seed: ThemeSeed;
	readonly seedToken: string;
};

export type ThemeCatalogReferences = {
	readonly coverLayouts: ReadonlyMap<CoverLayoutId, CoverLayoutDefinition>;
	readonly decors: ReadonlyMap<DecorId, DecorDefinition>;
	readonly densities: ReadonlyMap<DensityId, DensityDefinition>;
	readonly displayFonts: ReadonlyMap<DisplayFontId, DisplayFontDefinition>;
	readonly emphasis: ReadonlyMap<EmphasisId, EmphasisDefinition>;
	readonly fonts: ReadonlyMap<FontPairId, FontPairDefinition>;
	readonly itineraries: ReadonlyMap<
		ItineraryTemplateId,
		ItineraryTemplateDefinition
	>;
	readonly palettes: ReadonlyMap<PaletteId, PaletteDefinition>;
};
