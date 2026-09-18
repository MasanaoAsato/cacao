import { validateFamilyTextSafety } from "./decorPlacement";
import type { VisualFamilyDefinition } from "./registry";

export const PLAYFUL_ROUTE_PALETTES = {
	"berry-sun": {
		accent: "#A32949",
		ink: "#182A44",
		paper: "#FFFDF4",
		secondary: "#C4ECF2",
		soft: "#FFE475",
	},
	"harbor-play": {
		accent: "#185F86",
		ink: "#172F46",
		paper: "#F4FBFF",
		secondary: "#D4EFB0",
		soft: "#FFC4AF",
	},
} as const;

export type PlayfulRoutePaletteId = keyof typeof PLAYFUL_ROUTE_PALETTES;

export const PLAYFUL_ROUTE_COMPOSITIONS = {
	ribbon: {
		blockWidthMm: 128,
		coverImage: { heightMm: 104, widthMm: 62, xMm: 76, yMm: 78 },
		coverPeriod: { heightMm: 40, widthMm: 58, xMm: 10, yMm: 100 },
		coverTitle: { heightMm: 56, widthMm: 128, xMm: 10, yMm: 10 },
		imageShape: "rounded",
	},
	zigzag: {
		blockWidthMm: 104,
		coverImage: { heightMm: 90, widthMm: 90, xMm: 29, yMm: 80 },
		coverPeriod: { heightMm: 20, widthMm: 128, xMm: 10, yMm: 180 },
		coverTitle: { heightMm: 56, widthMm: 100, xMm: 10, yMm: 10 },
		imageShape: "circle",
	},
} as const;

export type PlayfulRouteCompositionId = keyof typeof PLAYFUL_ROUTE_COMPOSITIONS;

export const PLAYFUL_ROUTE_DECOR_ASSET_IDS = [
	"playful-bag",
	"playful-sun",
	"playful-squiggle",
	"playful-burst",
] as const;

export const PLAYFUL_ROUTE_FONT_FAMILIES = [
	"Dela Gothic One",
	"M PLUS Rounded 1c",
	"Noto Sans JP",
] as const;

export function playfulRoutePaletteFor(paletteId: string) {
	const palette = PLAYFUL_ROUTE_PALETTES[paletteId as PlayfulRoutePaletteId];
	if (!palette) {
		throw new Error(`playful-routeの配色「${paletteId}」がありません。`);
	}
	return palette;
}

export function playfulRouteCompositionFor(compositionId: string) {
	const composition =
		PLAYFUL_ROUTE_COMPOSITIONS[compositionId as PlayfulRouteCompositionId];
	if (!composition) {
		throw new Error(`playful-routeの構図「${compositionId}」がありません。`);
	}
	return composition;
}

for (const palette of Object.values(PLAYFUL_ROUTE_PALETTES)) {
	for (const surface of [palette.paper, palette.soft]) {
		validateFamilyTextSafety("playful-route", surface, [
			{ colorHex: palette.ink, fontSizePt: 40, role: "display" },
			{ colorHex: palette.ink, fontSizePt: 15, role: "body" },
			{ colorHex: palette.ink, fontSizePt: 8.5, role: "utility" },
		]);
	}
}

export const PLAYFUL_ROUTE_FAMILY = {
	compositionIds: ["zigzag", "ribbon"],
	decorAssetIds: PLAYFUL_ROUTE_DECOR_ASSET_IDS,
	fontFamilies: PLAYFUL_ROUTE_FONT_FAMILIES,
	id: "playful-route",
	moodIds: ["postcard", "festival-ticket"],
	paletteIds: ["berry-sun", "harbor-play"],
	policyId: "route",
} as const satisfies VisualFamilyDefinition;
