export type ThemeCatalogVersion = "v1";

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

export type SelectableCoverLayoutId =
	| "center"
	| "north-west"
	| "north-east"
	| "south-west"
	| "south-east"
	| "split-left"
	| "horizon";

export type ResolvedCoverLayoutId = SelectableCoverLayoutId | "safe-cover";

export type ItineraryLayoutId =
	| "stacked-ledger"
	| "route-rail"
	| "split-forward"
	| "split-reverse"
	| "center-column"
	| "upper-right"
	| "lower-right";

export type EmphasisId = "place-led" | "balanced" | "route-led" | "time-led";

export type DensityId = "airy" | "balanced" | "compact";

export type SignatureId =
	| "field-notes"
	| "wayfinder"
	| "postcard"
	| "night-train"
	| "quiet-gallery"
	| "festival-ticket";

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
};

export type CoverLayoutDefinition = {
	readonly id: SelectableCoverLayoutId;
	readonly textAreaHeightMm: number;
	readonly textAreaWidthMm: number;
};

export type ItineraryLayoutDefinition = {
	readonly id: ItineraryLayoutId;
};

export type EmphasisDefinition = {
	readonly id: EmphasisId;
	readonly target: "route" | "time" | "uniform";
};

export type DensityDefinition = {
	readonly id: DensityId;
	readonly spacingMultiplier: number;
};

export type SignatureDefinition = {
	readonly id: SignatureId;
};

export type ThemeRecipeDefinition = {
	readonly coverLayoutId: SelectableCoverLayoutId;
	readonly densityId: DensityId;
	readonly emphasisId: EmphasisId;
	readonly fontPairId: FontPairId;
	readonly id: string;
	readonly itineraryLayoutId: ItineraryLayoutId;
	readonly paletteId: PaletteId;
	readonly signatureId: SignatureId;
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
	readonly coverLayoutId: ResolvedCoverLayoutId;
	readonly densityId: DensityId;
	readonly emphasisId: EmphasisId;
	readonly fallbackStep: FallbackStep;
	readonly fontPairId: FontPairId;
	readonly itineraryLayoutId: ItineraryLayoutId;
	readonly paletteId: PaletteId;
	readonly requestedRecipeId: string;
	readonly resolvedThemeKey: string;
	readonly signatureId: SignatureId;
	readonly typography: TypographySafety;
};

export type ResolvedBookletTheme = BookletThemeCandidate & {
	readonly catalogVersion: ThemeCatalogVersion;
	readonly seed: ThemeSeed;
	readonly seedToken: string;
};

export type ThemeCatalogReferences = {
	readonly coverLayouts: ReadonlyMap<
		SelectableCoverLayoutId,
		CoverLayoutDefinition
	>;
	readonly densities: ReadonlyMap<DensityId, DensityDefinition>;
	readonly emphasis: ReadonlyMap<EmphasisId, EmphasisDefinition>;
	readonly fonts: ReadonlyMap<FontPairId, FontPairDefinition>;
	readonly itineraries: ReadonlyMap<
		ItineraryLayoutId,
		ItineraryLayoutDefinition
	>;
	readonly palettes: ReadonlyMap<PaletteId, PaletteDefinition>;
	readonly signatures: ReadonlyMap<SignatureId, SignatureDefinition>;
};
