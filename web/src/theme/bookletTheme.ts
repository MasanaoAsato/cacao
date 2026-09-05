import { MOODS, validateCatalog } from "./catalog";
import {
	buildThemeCandidates,
	ThemeRecipeValidationError,
} from "./recipeSafety";
import { createV2BookletTheme } from "./resolve";
import type {
	BookletThemeCandidate,
	CoverLayoutDefinition,
	DecorDefinition,
	DensityDefinition,
	DisplayFontDefinition,
	EmphasisDefinition,
	FontPairDefinition,
	ItineraryTemplateDefinition,
	PaletteDefinition,
	RequestedBookletTheme,
	ResolvedBookletTheme,
	ThemeCatalogReferences,
	ThemeContext,
	ThemeSeed,
} from "./types";

export const FONT_PAIRS = new Map<FontPairDefinition["id"], FontPairDefinition>(
	[
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
	],
);

export const PALETTES = new Map<PaletteDefinition["id"], PaletteDefinition>([
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

const FULL_COVER_IMAGE_FRAME = {
	heightMm: 210,
	shape: "rect",
	widthMm: 148,
	xMm: 0,
	yMm: 0,
} as const;

function coverLayout(
	id: CoverLayoutDefinition["id"],
	selectable: boolean,
	textBox: CoverLayoutDefinition["textBox"],
	safeArea: CoverLayoutDefinition["safeArea"],
	veil: CoverLayoutDefinition["veil"],
): CoverLayoutDefinition {
	return coverLayoutWithFrame(
		id,
		selectable,
		FULL_COVER_IMAGE_FRAME,
		textBox,
		safeArea,
		veil,
		null,
	);
}

function coverLayoutWithFrame(
	id: CoverLayoutDefinition["id"],
	selectable: boolean,
	imageFrame: CoverLayoutDefinition["imageFrame"],
	textBox: CoverLayoutDefinition["textBox"],
	safeArea: CoverLayoutDefinition["safeArea"],
	veil: CoverLayoutDefinition["veil"],
	titleSizePt: number | null = null,
): CoverLayoutDefinition {
	return {
		id,
		imageFrame,
		safeArea,
		selectable,
		textBox,
		titleSizePt,
		veil,
	};
}

export const COVER_LAYOUTS = new Map<
	CoverLayoutDefinition["id"],
	CoverLayoutDefinition
>([
	[
		"north-west",
		coverLayout(
			"north-west",
			true,
			{
				align: "left",
				anchorX: "left",
				anchorY: "top",
				offsetXMm: 12,
				offsetYMm: 12,
				paddingMm: 0,
				widthMm: 80,
			},
			{ heightMm: 70, widthMm: 80, xMm: 12, yMm: 12 },
			"radial",
		),
	],
	[
		"north-east",
		coverLayout(
			"north-east",
			true,
			{
				align: "left",
				anchorX: "right",
				anchorY: "top",
				offsetXMm: 12,
				offsetYMm: 12,
				paddingMm: 0,
				widthMm: 80,
			},
			{ heightMm: 70, widthMm: 80, xMm: 56, yMm: 12 },
			"radial",
		),
	],
	[
		"south-west",
		coverLayout(
			"south-west",
			true,
			{
				align: "left",
				anchorX: "left",
				anchorY: "bottom",
				offsetXMm: 12,
				offsetYMm: 12,
				paddingMm: 0,
				widthMm: 80,
			},
			{ heightMm: 70, widthMm: 80, xMm: 12, yMm: 128 },
			"radial",
		),
	],
	[
		"south-east",
		coverLayout(
			"south-east",
			true,
			{
				align: "left",
				anchorX: "right",
				anchorY: "bottom",
				offsetXMm: 12,
				offsetYMm: 12,
				paddingMm: 0,
				widthMm: 80,
			},
			{ heightMm: 70, widthMm: 80, xMm: 56, yMm: 128 },
			"radial",
		),
	],
	[
		"center",
		coverLayout(
			"center",
			true,
			{
				align: "center",
				anchorX: "left",
				anchorY: "top",
				offsetXMm: 22,
				offsetYMm: 67,
				paddingMm: 0,
				widthMm: 104,
			},
			{ heightMm: 76, widthMm: 104, xMm: 22, yMm: 67 },
			"radial",
		),
	],
	[
		"split-left",
		coverLayout(
			"split-left",
			true,
			{
				align: "left",
				anchorX: "left",
				anchorY: "top",
				offsetXMm: 12,
				offsetYMm: 12,
				paddingMm: 0,
				widthMm: 46,
			},
			{ heightMm: 210, widthMm: 70, xMm: 0, yMm: 0 },
			"linear-x",
		),
	],
	[
		"horizon",
		coverLayout(
			"horizon",
			true,
			{
				align: "left",
				anchorX: "left",
				anchorY: "top",
				offsetXMm: 12,
				offsetYMm: 156,
				paddingMm: 0,
				widthMm: 124,
			},
			{ heightMm: 62, widthMm: 148, xMm: 0, yMm: 148 },
			"linear-y",
		),
	],
	[
		"panel-bottom",
		coverLayoutWithFrame(
			"panel-bottom",
			true,
			{
				heightMm: 128,
				shape: "rect",
				widthMm: 148,
				xMm: 0,
				yMm: 0,
			},
			{
				align: "left",
				anchorX: "left",
				anchorY: "top",
				offsetXMm: 12,
				offsetYMm: 138,
				paddingMm: 0,
				widthMm: 124,
			},
			{ heightMm: 66, widthMm: 124, xMm: 12, yMm: 136 },
			"none",
		),
	],
	[
		"panel-top",
		coverLayoutWithFrame(
			"panel-top",
			true,
			{
				heightMm: 128,
				shape: "rect",
				widthMm: 148,
				xMm: 0,
				yMm: 82,
			},
			{
				align: "left",
				anchorX: "left",
				anchorY: "top",
				offsetXMm: 12,
				offsetYMm: 12,
				paddingMm: 0,
				widthMm: 124,
			},
			{ heightMm: 66, widthMm: 124, xMm: 12, yMm: 10 },
			"none",
		),
	],
	[
		"window-arch",
		coverLayoutWithFrame(
			"window-arch",
			true,
			{
				heightMm: 112,
				shape: "arch",
				widthMm: 104,
				xMm: 22,
				yMm: 14,
			},
			{
				align: "center",
				anchorX: "left",
				anchorY: "top",
				offsetXMm: 12,
				offsetYMm: 134,
				paddingMm: 0,
				widthMm: 124,
			},
			{ heightMm: 70, widthMm: 124, xMm: 12, yMm: 132 },
			"none",
		),
	],
	[
		"poster",
		coverLayoutWithFrame(
			"poster",
			true,
			{
				heightMm: 60,
				shape: "rect",
				widthMm: 148,
				xMm: 0,
				yMm: 150,
			},
			{
				align: "left",
				anchorX: "left",
				anchorY: "top",
				offsetXMm: 12,
				offsetYMm: 14,
				paddingMm: 0,
				widthMm: 124,
			},
			{ heightMm: 132, widthMm: 124, xMm: 12, yMm: 12 },
			"none",
			44,
		),
	],
	[
		"safe-cover",
		coverLayout(
			"safe-cover",
			false,
			{
				align: "left",
				anchorX: "left",
				anchorY: "top",
				offsetXMm: 22,
				offsetYMm: 22,
				paddingMm: 8,
				widthMm: 104,
			},
			{ heightMm: 190, widthMm: 128, xMm: 10, yMm: 10 },
			"radial",
		),
	],
]);

export const ITINERARY_LAYOUTS = new Map<
	ItineraryTemplateDefinition["id"],
	ItineraryTemplateDefinition
>([
	["route-thread", { id: "route-thread" }],
	["field-journal", { id: "field-journal" }],
	["travel-ticket", { id: "travel-ticket" }],
]);

export const EMPHASIS = new Map<EmphasisDefinition["id"], EmphasisDefinition>([
	["place-led", { id: "place-led", target: "uniform" }],
	["time-led", { id: "time-led", target: "time" }],
	["route-led", { id: "route-led", target: "route" }],
	["balanced", { id: "balanced", target: "uniform" }],
]);

export const DENSITIES = new Map<DensityDefinition["id"], DensityDefinition>([
	["compact", { id: "compact", spacingMultiplier: 0.86 }],
	["balanced", { id: "balanced", spacingMultiplier: 1 }],
	["airy", { id: "airy", spacingMultiplier: 1.14 }],
]);

export const DISPLAY_FONTS = new Map<
	DisplayFontDefinition["id"],
	DisplayFontDefinition
>([
	[
		"inherit",
		{
			family: null,
			id: "inherit",
			package: null,
			weight: 700,
		},
	],
	[
		"dela-gothic-one",
		{
			family: '"Dela Gothic One", sans-serif',
			id: "dela-gothic-one",
			package: "@fontsource/dela-gothic-one",
			weight: 400,
		},
	],
	[
		"zen-kurenaido",
		{
			family: '"Zen Kurenaido", sans-serif',
			id: "zen-kurenaido",
			package: "@fontsource/zen-kurenaido",
			weight: 400,
		},
	],
	[
		"kaisei-decol",
		{
			family: '"Kaisei Decol", serif',
			id: "kaisei-decol",
			package: "@fontsource/kaisei-decol",
			weight: 700,
		},
	],
	[
		"rocknroll-one",
		{
			family: '"RocknRoll One", sans-serif',
			id: "rocknroll-one",
			package: "@fontsource/rocknroll-one",
			weight: 400,
		},
	],
]);

export const DECORS = new Map<DecorDefinition["id"], DecorDefinition>([
	["field-notes", { id: "field-notes" }],
	["wayfinder", { id: "wayfinder" }],
	["postcard", { id: "postcard" }],
	["night-train", { id: "night-train" }],
	["quiet-gallery", { id: "quiet-gallery" }],
	["festival-ticket", { id: "festival-ticket" }],
]);

export const THEME_CATALOG_REFERENCES: ThemeCatalogReferences = {
	coverLayouts: COVER_LAYOUTS,
	decors: DECORS,
	densities: DENSITIES,
	displayFonts: DISPLAY_FONTS,
	emphasis: EMPHASIS,
	fonts: FONT_PAIRS,
	itineraries: ITINERARY_LAYOUTS,
	palettes: PALETTES,
};

export function getCoverLayoutDefinition(
	id: CoverLayoutDefinition["id"],
): CoverLayoutDefinition {
	const coverLayout = COVER_LAYOUTS.get(id);
	if (!coverLayout) {
		throw new ThemeRecipeValidationError(`未登録の表紙構図「${id}」です。`);
	}
	return coverLayout;
}

export function getFontPairFamilies(
	id: FontPairDefinition["id"],
): readonly string[] {
	const font = FONT_PAIRS.get(id);
	if (!font) {
		throw new ThemeRecipeValidationError(`未登録の書体「${id}」です。`);
	}
	return font.families;
}

export function getDisplayFontDefinition(
	id: DisplayFontDefinition["id"],
): DisplayFontDefinition {
	const font = DISPLAY_FONTS.get(id);
	if (!font) {
		throw new ThemeRecipeValidationError(`未登録の表示書体「${id}」です。`);
	}
	return font;
}

export function createBookletTheme(
	seed: ThemeSeed,
	context: ThemeContext = { coverVisualStyle: null },
): RequestedBookletTheme {
	validateCatalog(MOODS, THEME_CATALOG_REFERENCES);
	return createV2BookletTheme(seed, context, MOODS, THEME_CATALOG_REFERENCES);
}

export function getThemeCandidates(
	requested: RequestedBookletTheme,
): readonly BookletThemeCandidate[] {
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
	const coverLayout = getCoverLayoutDefinition(theme.coverLayoutId);
	const displayFont = getDisplayFontDefinition(theme.displayFontId);
	const coverTitleSizePt =
		coverLayout.titleSizePt ?? theme.typography.coverTitle.fontSizePt;
	const coverTitleFamily = displayFont.family ?? font.headingFamily;
	const { imageFrame, textBox } = coverLayout;
	const frameRadius =
		imageFrame.shape === "arch"
			? `${imageFrame.widthMm / 2}mm ${imageFrame.widthMm / 2}mm 0 0`
			: "0";
	const itinerary = palette.itinerary ?? {
		accent: palette.accent,
		border: palette.border,
		muted: palette.muted,
		surfaceStops: palette.surfaceStops,
		text: palette.text,
	};
	return Object.freeze({
		"--booklet-accent": palette.accent,
		"--booklet-background": palette.background,
		"--booklet-body-family": font.bodyFamily,
		"--booklet-body-letter-spacing": `${theme.typography.body.letterSpacingEm}em`,
		"--booklet-body-line-height": `${theme.typography.body.lineHeight}`,
		"--booklet-body-size": `${theme.typography.body.fontSizePt}pt`,
		"--booklet-border": palette.border,
		"--booklet-cover-ink": palette.coverInk,
		"--booklet-cover-surface": palette.surfaceStops[0],
		"--booklet-cover-frame-height": `${imageFrame.heightMm}mm`,
		"--booklet-cover-frame-left": `${imageFrame.xMm}mm`,
		"--booklet-cover-frame-radius": frameRadius,
		"--booklet-cover-frame-top": `${imageFrame.yMm}mm`,
		"--booklet-cover-frame-width": `${imageFrame.widthMm}mm`,
		"--booklet-cover-text-align": textBox.align,
		"--booklet-cover-text-bottom":
			textBox.anchorY === "bottom" ? `${textBox.offsetYMm}mm` : "auto",
		"--booklet-cover-text-left":
			textBox.anchorX === "left" ? `${textBox.offsetXMm}mm` : "auto",
		"--booklet-cover-text-padding": `${textBox.paddingMm}mm`,
		"--booklet-cover-text-right":
			textBox.anchorX === "right" ? `${textBox.offsetXMm}mm` : "auto",
		"--booklet-cover-text-top":
			textBox.anchorY === "top" ? `${textBox.offsetYMm}mm` : "auto",
		"--booklet-cover-text-width": `${textBox.widthMm}mm`,
		"--booklet-cover-veil": palette.coverVeil,
		"--booklet-cover-veil-opacity": `${palette.coverVeilOpacity}`,
		"--booklet-cover-title-family": coverTitleFamily,
		"--booklet-cover-title-letter-spacing": `${theme.typography.coverTitle.letterSpacingEm}em`,
		"--booklet-cover-title-line-height": `${theme.typography.coverTitle.lineHeight}`,
		"--booklet-cover-title-size": formatPoints(coverTitleSizePt),
		"--booklet-cover-title-weight": `${displayFont.weight}`,
		"--booklet-cover-title-size-long": formatPoints(
			Math.max(22, coverTitleSizePt * 0.8),
		),
		"--booklet-cover-title-size-very-long": formatPoints(
			Math.max(22, coverTitleSizePt * 0.6),
		),
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
		"--booklet-itinerary-accent": itinerary.accent,
		"--booklet-itinerary-border": itinerary.border,
		"--booklet-itinerary-muted": itinerary.muted,
		"--booklet-itinerary-surface": itinerary.surfaceStops[0],
		"--booklet-itinerary-text": itinerary.text,
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
		throw new ThemeRecipeValidationError(
			`未登録の配色「${theme.paletteId}」です。`,
		);
	}
	return palette.itinerary?.surfaceStops ?? palette.surfaceStops;
}
