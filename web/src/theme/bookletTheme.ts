import { MOODS, validateCatalog } from "./catalog";
import { decorContentInset } from "./decorGeometry";
import { MOTIFS } from "./motifs";
import {
	buildThemeCandidates,
	ThemeRecipeValidationError,
} from "./recipeSafety";
import { createV2BookletTheme } from "./resolve";
import type {
	BookletThemeCandidate,
	CompositionDefinition,
	ContentInsetMm,
	CoverLayoutDefinition,
	DecorDefinition,
	DensityDefinition,
	DisplayFontDefinition,
	EmphasisDefinition,
	FontPairDefinition,
	InkStyleDefinition,
	ItineraryTemplateDefinition,
	PaletteDefinition,
	RequestedBookletTheme,
	ResolvedBookletTheme,
	ThemeCatalogReferences,
	ThemeContext,
	ThemeSeed,
	UnitFormDefinition,
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
	[
		"route-thread",
		{
			id: "route-thread",
			reservedWidthMm: { compact: 20, full: 20, line: 20 },
		},
	],
	[
		"field-journal",
		{
			id: "field-journal",
			reservedWidthMm: { compact: 30, full: 18, line: 0 },
		},
	],
	[
		"travel-ticket",
		{
			id: "travel-ticket",
			reservedWidthMm: { compact: 34, full: 34, line: 0 },
		},
	],
	[
		"rail-ledger",
		{
			id: "rail-ledger",
			reservedWidthMm: { compact: 38, full: 38, line: 0 },
		},
	],
	[
		"banner-list",
		{ id: "banner-list", reservedWidthMm: { compact: 0, full: 0, line: 0 } },
	],
]);

export const UNIT_FORMS = new Map<UnitFormDefinition["id"], UnitFormDefinition>(
	[
		[
			"full",
			{
				detailColumns: 3,
				id: "full",
				minDescriptionWidthMm: 76,
				minDetailCellWidthMm: 22,
			},
		],
		[
			"compact",
			{
				detailColumns: 0,
				id: "compact",
				minDescriptionWidthMm: 56,
				minDetailCellWidthMm: 0,
			},
		],
		[
			"line",
			{
				detailColumns: 0,
				id: "line",
				minDescriptionWidthMm: 48,
				minDetailCellWidthMm: 0,
			},
		],
	],
);

const NO_CONTENT_INSET = { bottom: 0, left: 0, right: 0, top: 0 } as const;

export const COMPOSITIONS = new Map<
	CompositionDefinition["id"],
	CompositionDefinition
>([
	[
		"top-stack",
		{
			align: "top",
			columnGapMm: 0,
			columns: 1,
			contentInsetMm: NO_CONTENT_INSET,
			header: {
				bandWidthMm: null,
				placement: "top",
				writingMode: "horizontal",
			},
			id: "top-stack",
			selectable: true,
			unitForms: ["full", "compact", "line"],
		},
	],
	[
		"side-band",
		{
			align: "top",
			columnGapMm: 0,
			columns: 1,
			contentInsetMm: { bottom: 0, left: 0, right: 26, top: 0 },
			header: {
				bandWidthMm: 22,
				placement: "side-right",
				writingMode: "vertical",
			},
			id: "side-band",
			selectable: true,
			unitForms: ["compact", "line"],
		},
	],
	[
		"two-column",
		{
			align: "top",
			columnGapMm: 6,
			columns: 2,
			contentInsetMm: NO_CONTENT_INSET,
			header: {
				bandWidthMm: null,
				placement: "top",
				writingMode: "horizontal",
			},
			id: "two-column",
			selectable: true,
			unitForms: ["line"],
		},
	],
	[
		"center-column",
		{
			align: "top",
			columnGapMm: 0,
			columns: 1,
			contentInsetMm: { bottom: 0, left: 12, right: 12, top: 0 },
			header: {
				bandWidthMm: null,
				placement: "top",
				writingMode: "horizontal",
			},
			id: "center-column",
			selectable: true,
			unitForms: ["compact", "line"],
		},
	],
	[
		"bottom-anchored",
		{
			align: "bottom",
			columnGapMm: 0,
			columns: 1,
			contentInsetMm: NO_CONTENT_INSET,
			header: {
				bandWidthMm: null,
				placement: "top",
				writingMode: "horizontal",
			},
			id: "bottom-anchored",
			selectable: true,
			unitForms: ["full", "compact", "line"],
		},
	],
]);

export const INK_STYLES = new Map<InkStyleDefinition["id"], InkStyleDefinition>(
	[
		["text", { id: "text" }],
		["pill", { id: "pill" }],
		["band", { id: "band" }],
		["zebra", { id: "zebra" }],
	],
);

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

const PLAIN_HEADING: DecorDefinition["heading"] = {
	font: "heading",
	outline: false,
	shadow: "none",
};
const DISPLAY_HEADING: DecorDefinition["heading"] = {
	font: "display",
	outline: false,
	shadow: "none",
};
const NO_PANEL: DecorDefinition["panel"] = { kind: "none" };
const PLAIN_GROUND: DecorDefinition["ground"] = { kind: "plain" };

function decorSet(
	id: DecorDefinition["id"],
	definition: Omit<DecorDefinition, "id">,
): readonly [DecorDefinition["id"], DecorDefinition] {
	return [id, { id, ...definition }];
}

/**
 * Decor sets (18.4). The first seven re-express the 17.4 vocabulary with the
 * same geometry; the rest add grounds, panels and motifs. Content insets are
 * derived from these definitions by `decorContentInset`.
 */
export const DECORS = new Map<DecorDefinition["id"], DecorDefinition>([
	decorSet("hairline-frame", {
		coverPaddingMm: 4,
		ground: {
			color: "border",
			edgeMm: 7,
			kind: "frame",
			opacity: 0.55,
			stroke: "solid",
			widthMm: 0.26,
		},
		heading: PLAIN_HEADING,
		motifs: [],
		panel: NO_PANEL,
		rule: "solid",
	}),
	decorSet("dashed-ticket", {
		coverPaddingMm: 4,
		ground: {
			color: "border",
			edgeMm: 7,
			kind: "frame",
			opacity: 0.55,
			stroke: "dashed",
			widthMm: 0.26,
		},
		heading: PLAIN_HEADING,
		motifs: [],
		panel: NO_PANEL,
		rule: "solid",
	}),
	decorSet("dotted-grid", {
		coverPaddingMm: 0,
		ground: {
			color: "border",
			kind: "pattern",
			motif: "dot",
			opacity: 0.3,
			sizeMm: 0.4,
			tileMm: 4,
		},
		heading: PLAIN_HEADING,
		motifs: [],
		panel: NO_PANEL,
		rule: "solid",
	}),
	decorSet("stripe-band", {
		coverPaddingMm: 0,
		ground: PLAIN_GROUND,
		heading: PLAIN_HEADING,
		motifs: [
			{
				anchor: "page-edge",
				color: "accent",
				count: 1,
				motif: "stripe",
				opacity: 0.35,
				rotateDeg: [0, 0],
				sizeMm: [6, 6],
				slot: "band-top",
			},
		],
		panel: NO_PANEL,
		rule: "solid",
	}),
	decorSet("route-dash", {
		coverPaddingMm: 0,
		ground: PLAIN_GROUND,
		heading: PLAIN_HEADING,
		motifs: [
			{
				anchor: "content-edge",
				color: "accent",
				count: 1,
				motif: "dash-rail",
				opacity: 0.55,
				rotateDeg: [0, 0],
				sizeMm: [196, 196],
				slot: "margin-left",
			},
		],
		panel: NO_PANEL,
		rule: "solid",
	}),
	decorSet("gallery-rule", {
		coverPaddingMm: 0,
		ground: PLAIN_GROUND,
		heading: PLAIN_HEADING,
		motifs: [
			{
				anchor: "content-edge",
				color: "border",
				count: 1,
				motif: "rule-square",
				opacity: 0.55,
				rotateDeg: [0, 0],
				sizeMm: [3, 3],
				slot: "band-bottom",
			},
		],
		panel: NO_PANEL,
		rule: "solid",
	}),
	decorSet("none", {
		coverPaddingMm: 0,
		ground: PLAIN_GROUND,
		heading: PLAIN_HEADING,
		motifs: [],
		panel: NO_PANEL,
		rule: "solid",
	}),
	decorSet("wave-margins", {
		coverPaddingMm: 0,
		ground: PLAIN_GROUND,
		heading: DISPLAY_HEADING,
		motifs: [
			{
				anchor: "content-edge",
				color: "accent",
				count: 24,
				motif: "wave",
				opacity: 0.6,
				rotateDeg: [0, 0],
				sizeMm: [2.5, 2.5],
				slot: "band-top",
			},
			{
				anchor: "content-edge",
				color: "accent",
				count: 24,
				motif: "wave",
				opacity: 0.6,
				rotateDeg: [0, 0],
				sizeMm: [2.5, 2.5],
				slot: "band-bottom",
			},
		],
		panel: NO_PANEL,
		rule: "wavy",
	}),
	decorSet("confetti-corners", {
		coverPaddingMm: 0,
		ground: PLAIN_GROUND,
		heading: { font: "display", outline: false, shadow: "offset" },
		motifs: [
			{
				anchor: "content-edge",
				color: "accent",
				count: 1,
				motif: "star",
				opacity: 0.9,
				rotateDeg: [-20, 20],
				sizeMm: [3, 5],
				slot: "corner-nw",
			},
			{
				anchor: "content-edge",
				color: "border",
				count: 1,
				motif: "ring",
				opacity: 0.9,
				rotateDeg: [0, 0],
				sizeMm: [3, 5],
				slot: "corner-ne",
			},
			{
				anchor: "content-edge",
				color: "accent",
				count: 1,
				motif: "sparkle",
				opacity: 0.9,
				rotateDeg: [-30, 30],
				sizeMm: [3, 5],
				slot: "corner-sw",
			},
			{
				anchor: "content-edge",
				color: "muted",
				count: 1,
				motif: "triangle",
				opacity: 0.8,
				rotateDeg: [-45, 45],
				sizeMm: [3, 5],
				slot: "corner-se",
			},
		],
		panel: NO_PANEL,
		rule: "dotted",
	}),
	decorSet("bold-frame", {
		coverPaddingMm: 0,
		ground: {
			color: "accent",
			edgeMm: 3,
			kind: "frame",
			opacity: 1,
			stroke: "solid",
			widthMm: 3,
		},
		heading: { font: "display", outline: true, shadow: "none" },
		motifs: [],
		panel: NO_PANEL,
		rule: "solid",
	}),
	decorSet("sheet-on-dots", {
		coverPaddingMm: 0,
		ground: {
			color: "accent",
			kind: "pattern",
			motif: "dot",
			opacity: 0.45,
			sizeMm: 1.2,
			tileMm: 3.5,
		},
		heading: PLAIN_HEADING,
		motifs: [],
		panel: { insetMm: 6, kind: "sheet", opacity: 0.94, radiusMm: 2 },
		rule: "solid",
	}),
	decorSet("ring-binder", {
		coverPaddingMm: 0,
		ground: PLAIN_GROUND,
		heading: PLAIN_HEADING,
		motifs: [
			{
				anchor: "content-edge",
				color: "border",
				count: 9,
				motif: "binder-hole",
				opacity: 0.8,
				rotateDeg: [0, 0],
				sizeMm: [4, 4],
				slot: "margin-left",
			},
		],
		panel: NO_PANEL,
		rule: "dashed",
	}),
	decorSet("photo-wash", {
		coverPaddingMm: 0,
		ground: {
			kind: "image",
			opacity: 0.35,
			source: "cover",
			treatment: "blur",
		},
		heading: DISPLAY_HEADING,
		motifs: [],
		panel: { insetMm: 7, kind: "sheet", opacity: 0.95, radiusMm: 1 },
		rule: "solid",
	}),
	decorSet("ticket-notches", {
		coverPaddingMm: 0,
		ground: PLAIN_GROUND,
		heading: DISPLAY_HEADING,
		motifs: [
			{
				anchor: "content-edge",
				color: "border",
				count: 14,
				motif: "notch",
				opacity: 0.7,
				rotateDeg: [0, 0],
				sizeMm: [3, 3],
				slot: "margin-left",
			},
			{
				anchor: "content-edge",
				color: "border",
				count: 14,
				motif: "notch",
				opacity: 0.7,
				rotateDeg: [180, 180],
				sizeMm: [3, 3],
				slot: "margin-right",
			},
		],
		panel: NO_PANEL,
		rule: "dashed",
	}),
]);

export const THEME_CATALOG_REFERENCES: ThemeCatalogReferences = {
	compositions: COMPOSITIONS,
	coverLayouts: COVER_LAYOUTS,
	decors: DECORS,
	densities: DENSITIES,
	displayFonts: DISPLAY_FONTS,
	emphasis: EMPHASIS,
	fonts: FONT_PAIRS,
	inkStyles: INK_STYLES,
	itineraries: ITINERARY_LAYOUTS,
	motifs: MOTIFS,
	palettes: PALETTES,
	unitForms: UNIT_FORMS,
};

export function getDecorDefinition(id: DecorDefinition["id"]): DecorDefinition {
	const decor = DECORS.get(id);
	if (!decor) {
		throw new ThemeRecipeValidationError(`未登録の装飾語彙「${id}」です。`);
	}
	return decor;
}

/** Body inset on each side: the decor set's derived inset plus the composition's. */
export function getBodyContentInset(
	theme: Pick<BookletThemeCandidate, "compositionId" | "decorId">,
): ContentInsetMm {
	const composition = getCompositionDefinition(theme.compositionId);
	const decorInset = decorContentInset(
		getDecorDefinition(theme.decorId),
		MOTIFS,
	);
	return {
		bottom: decorInset.bottom + composition.contentInsetMm.bottom,
		left: decorInset.left + composition.contentInsetMm.left,
		right: decorInset.right + composition.contentInsetMm.right,
		top: decorInset.top + composition.contentInsetMm.top,
	};
}

export function getCompositionDefinition(
	id: CompositionDefinition["id"],
): CompositionDefinition {
	const composition = COMPOSITIONS.get(id);
	if (!composition) {
		throw new ThemeRecipeValidationError(`未登録のページ構図「${id}」です。`);
	}
	return composition;
}

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
	const composition = getCompositionDefinition(theme.compositionId);
	const decor = getDecorDefinition(theme.decorId);
	const contentInset = getBodyContentInset(theme);
	const coverTitleSizePt =
		coverLayout.titleSizePt ?? theme.typography.coverTitle.fontSizePt;
	const coverTitleFamily = displayFont.family ?? font.headingFamily;
	const dayTitleUsesDisplay =
		decor.heading.font === "display" && displayFont.family !== null;
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
		"--booklet-cover-text-padding": `${textBox.paddingMm + decor.coverPaddingMm}mm`,
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
		"--booklet-column-gap": `${composition.columnGapMm}mm`,
		"--booklet-columns": `${composition.columns}`,
		"--booklet-content-inset-bottom": `${contentInset.bottom}mm`,
		"--booklet-content-inset-left": `${contentInset.left}mm`,
		"--booklet-content-inset-right": `${contentInset.right}mm`,
		"--booklet-content-inset-top": `${contentInset.top}mm`,
		"--booklet-side-band-width": `${composition.header.bandWidthMm ?? 0}mm`,
		"--booklet-cover-title-size-long": formatPoints(
			Math.max(22, coverTitleSizePt * 0.8),
		),
		"--booklet-cover-title-size-very-long": formatPoints(
			Math.max(22, coverTitleSizePt * 0.6),
		),
		"--booklet-day-title-family": dayTitleUsesDisplay
			? coverTitleFamily
			: font.headingFamily,
		"--booklet-day-title-letter-spacing": `${theme.typography.dayTitle.letterSpacingEm}em`,
		"--booklet-day-title-line-height": `${theme.typography.dayTitle.lineHeight}`,
		"--booklet-day-title-shadow":
			decor.heading.shadow === "offset"
				? "0.5mm 0.5mm 0 color-mix(in srgb, var(--booklet-itinerary-accent) 35%, transparent)"
				: "none",
		"--booklet-day-title-size": formatPoints(
			theme.typography.dayTitle.fontSizePt,
		),
		"--booklet-day-title-stroke": decor.heading.outline ? "0.4mm" : "0",
		"--booklet-day-title-weight": dayTitleUsesDisplay
			? `${displayFont.weight}`
			: "700",
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
		"--booklet-rule-style": decor.rule === "wavy" ? "solid" : decor.rule,
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
