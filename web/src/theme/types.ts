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
	| "none"
	| "wave-margins"
	| "confetti-corners"
	| "bold-frame"
	| "sheet-on-dots"
	| "ring-binder"
	| "photo-wash"
	| "ticket-notches";

export type UnitFormId = "full" | "compact" | "line";

export type CompositionId =
	| "top-stack"
	| "side-band"
	| "two-column"
	| "center-column"
	| "bottom-anchored";

export type InkStyleId = "text" | "pill" | "band" | "zebra";

export type ContentInsetMm = {
	readonly bottom: number;
	readonly left: number;
	readonly right: number;
	readonly top: number;
};

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
	/**
	 * Width the template's own skeleton takes away from the description column,
	 * per unit form (for example the hanging time column of `field-journal`).
	 */
	readonly reservedWidthMm: Readonly<Record<UnitFormId, number>>;
};

export type UnitFormDefinition = {
	readonly detailColumns: 3 | 0;
	readonly id: UnitFormId;
	readonly minDescriptionWidthMm: number;
	readonly minDetailCellWidthMm: number;
};

export type CompositionDefinition = {
	readonly align: "top" | "bottom";
	readonly columnGapMm: number;
	readonly columns: 1 | 2;
	readonly contentInsetMm: ContentInsetMm;
	readonly header: {
		readonly bandWidthMm: number | null;
		readonly placement: "top" | "side-left" | "side-right";
		readonly writingMode: "horizontal" | "vertical";
	};
	readonly id: CompositionId;
	readonly selectable: boolean;
	readonly unitForms: readonly UnitFormId[];
};

export type InkStyleDefinition = {
	readonly id: InkStyleId;
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

export type MotifId =
	| "dot"
	| "stripe"
	| "dash-rail"
	| "rule-square"
	| "wave"
	| "ring"
	| "star"
	| "sparkle"
	| "cross"
	| "notch"
	| "binder-hole"
	| "triangle"
	| "atlas-compass"
	| "atlas-route-mark"
	| "atlas-perforation"
	| "paper-torn-sheet"
	| "paper-tape"
	| "paper-leaf"
	| "paper-postage"
	| "playful-bag"
	| "playful-sun"
	| "playful-squiggle"
	| "playful-burst";

export type MotifStyleId = "atlas-ink" | "paper-cut" | "playful-doodle";

/** Which palette colour a motif or ground is painted with. `own` keeps the asset's colours. */
export type MotifColor = "accent" | "border" | "muted" | "own";

export type MotifSlotId =
	| "corner-nw"
	| "corner-ne"
	| "corner-sw"
	| "corner-se"
	| "band-top"
	| "band-bottom"
	| "margin-left"
	| "margin-right";

export type RuleStyle = "solid" | "dashed" | "dotted" | "wavy" | "double";

export type DecorGround =
	| { readonly kind: "plain" }
	| {
			readonly kind: "pattern";
			readonly color: MotifColor;
			readonly motif: MotifId;
			readonly opacity: number;
			/** Motif size inside each tile. */
			readonly sizeMm: number;
			readonly tileMm: number;
	  }
	| {
			readonly kind: "frame";
			readonly color: MotifColor;
			/** Distance from the page edge to the outer edge of the frame. */
			readonly edgeMm: number;
			readonly opacity: number;
			readonly stroke: "solid" | "dashed";
			readonly widthMm: number;
	  }
	| {
			readonly kind: "image";
			readonly opacity: number;
			readonly source: "cover" | "illustration";
			readonly treatment: "blur" | "tint" | "tile";
	  };

export type DecorPanel =
	| { readonly kind: "none" }
	| {
			readonly kind: "sheet";
			readonly insetMm: number;
			readonly opacity: number;
			readonly radiusMm: number;
	  };

export type MotifPlacement = {
	/** Bands anchored to the page edge push the content inward by their size. */
	readonly anchor: "page-edge" | "content-edge";
	readonly color: MotifColor;
	readonly count: number;
	readonly motif: MotifId;
	readonly opacity: number;
	readonly rotateDeg: readonly [number, number];
	/** Height of the motif box in mm; picked from the range by the seed. */
	readonly sizeMm: readonly [number, number];
	readonly slot: MotifSlotId;
};

export type DecorHeading = {
	readonly font: "heading" | "display";
	readonly outline: boolean;
	readonly shadow: "none" | "offset";
};

export type DecorDefinition = {
	readonly coverPaddingMm: number;
	readonly ground: DecorGround;
	readonly heading: DecorHeading;
	readonly id: DecorId;
	readonly motifs: readonly MotifPlacement[];
	readonly panel: DecorPanel;
	readonly rule: RuleStyle;
};

/**
 * A primitive drawn inside the motif box. Coordinates are in box units where
 * the box is `aspect` wide and 1 high; the renderer scales it to `sizeMm`.
 * `"color"` resolves to the placement's palette colour.
 */
export type MotifShape =
	| {
			readonly kind: "path";
			readonly d: string;
			readonly fill: "color" | "none";
			readonly stroke: "color" | "none";
			readonly strokeWidth: number;
			readonly dashed?: boolean;
	  }
	| {
			readonly kind: "circle";
			readonly cx: number;
			readonly cy: number;
			readonly r: number;
			readonly fill: "color" | "none";
			readonly stroke: "color" | "none";
			readonly strokeWidth: number;
	  }
	| {
			readonly kind: "rect";
			readonly x: number;
			readonly y: number;
			readonly width: number;
			readonly height: number;
			readonly fill: "color" | "none";
			readonly stroke: "color" | "none";
			readonly strokeWidth: number;
	  };

export type MotifDefinition =
	| {
			readonly kind: "procedural";
			readonly id: MotifId;
			/** Box width divided by height. */
			readonly aspect: number;
			/** Fraction of the box area the shapes cover; bounds pattern coverage. */
			readonly coverage: number;
			readonly shapes: readonly MotifShape[];
	  }
	| {
			readonly kind: "asset";
			readonly id: MotifId;
			/** Visual family of the repository-managed artwork. */
			readonly styleId: MotifStyleId;
			readonly aspect: number;
			readonly coverage: number;
			readonly recolor: "mask" | "none";
			readonly src: string;
	  };

export type MoodDefinition = {
	readonly compositions: readonly CompositionId[];
	readonly coverLayouts: readonly CoverLayoutId[];
	readonly decors: readonly DecorId[];
	readonly displayFonts: readonly DisplayFontId[];
	readonly fontPairs: readonly FontPairId[];
	readonly id: MoodId;
	readonly inkStyles: readonly InkStyleId[];
	readonly itineraryTemplates: readonly ItineraryTemplateId[];
	readonly palettes: readonly PaletteId[];
	readonly unitForms: readonly UnitFormId[];
};

export type ThemeContext = {
	readonly coverVisualStyle: CoverVisualStyle | null;
};

export type CompatibilityRule = {
	readonly when: {
		readonly coverVisualStyle: readonly CoverVisualStyle[];
	};
	readonly exclude: {
		readonly compositions?: readonly CompositionId[];
		readonly coverLayouts?: readonly CoverLayoutId[];
		readonly decors?: readonly DecorId[];
		readonly inkStyles?: readonly InkStyleId[];
		readonly palettes?: readonly PaletteId[];
	};
};

export type ThemeRecipeDefinition = {
	readonly compositionId: CompositionId;
	readonly coverLayoutId: CoverLayoutId;
	readonly decorId: DecorId;
	readonly densityId: DensityId;
	readonly displayFontId: DisplayFontId;
	readonly emphasisId: EmphasisId;
	readonly fontPairId: FontPairId;
	readonly id: string;
	readonly inkStyleId: InkStyleId;
	readonly itineraryTemplateId: ItineraryTemplateId;
	readonly moodId: MoodId;
	readonly paletteId: PaletteId;
	readonly typography: TypographySafety;
	readonly unitFormId: UnitFormId;
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
	| "single-column"
	| "safe-geometry";

export type BookletThemeCandidate = {
	readonly compositionId: CompositionId;
	readonly coverLayoutId: CoverLayoutId;
	readonly decorId: DecorId;
	readonly densityId: DensityId;
	readonly displayFontId: DisplayFontId;
	readonly emphasisId: EmphasisId;
	readonly fallbackStep: FallbackStep;
	readonly fontPairId: FontPairId;
	readonly inkStyleId: InkStyleId;
	readonly itineraryTemplateId: ItineraryTemplateId;
	readonly moodId: MoodId;
	readonly paletteId: PaletteId;
	readonly requestedRecipeId: string;
	readonly resolvedThemeKey: string;
	readonly typography: TypographySafety;
	readonly unitFormId: UnitFormId;
};

export type ResolvedBookletTheme = BookletThemeCandidate & {
	readonly catalogVersion: ThemeCatalogVersion;
	readonly seed: ThemeSeed;
	readonly seedToken: string;
};

export type ThemeCatalogReferences = {
	readonly compositions: ReadonlyMap<CompositionId, CompositionDefinition>;
	readonly coverLayouts: ReadonlyMap<CoverLayoutId, CoverLayoutDefinition>;
	readonly decors: ReadonlyMap<DecorId, DecorDefinition>;
	readonly densities: ReadonlyMap<DensityId, DensityDefinition>;
	readonly displayFonts: ReadonlyMap<DisplayFontId, DisplayFontDefinition>;
	readonly emphasis: ReadonlyMap<EmphasisId, EmphasisDefinition>;
	readonly fonts: ReadonlyMap<FontPairId, FontPairDefinition>;
	readonly inkStyles: ReadonlyMap<InkStyleId, InkStyleDefinition>;
	readonly itineraries: ReadonlyMap<
		ItineraryTemplateId,
		ItineraryTemplateDefinition
	>;
	readonly motifs: ReadonlyMap<MotifId, MotifDefinition>;
	readonly palettes: ReadonlyMap<PaletteId, PaletteDefinition>;
	readonly unitForms: ReadonlyMap<UnitFormId, UnitFormDefinition>;
};
