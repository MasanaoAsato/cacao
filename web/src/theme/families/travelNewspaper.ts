import { validateFamilyTextSafety } from "./decorPlacement";
import type { VisualFamilyDefinition } from "./registry";
import {
	derivedStyleProfileFields,
	TRAVEL_NEWSPAPER_STYLE_PROFILES,
} from "./styleProfiles";

export const TRAVEL_NEWSPAPER_PALETTES = {
	"classic-travel": {
		accent: "#9A3E2E",
		ink: "#252A35",
		paper: "#F6F1E6",
		secondary: "#D9C7A9",
		soft: "#E9DDC8",
	},
	"city-walk": {
		accent: "#D56A32",
		ink: "#183A3A",
		paper: "#EEF4F0",
		secondary: "#B8D0C8",
		soft: "#DCE9E2",
	},
} as const;

export type TravelNewspaperPaletteId = keyof typeof TRAVEL_NEWSPAPER_PALETTES;

export const TRAVEL_NEWSPAPER_COMPOSITIONS = {
	"newspaper-columns": {
		articleStartYmm: 68,
		columnGapMm: 10,
		continuationStartYmm: 30,
		coverImage: {
			heightMm: 74,
			widthMm: 78,
			classicXmm: 10,
			cityXmm: 60,
			yMm: 42,
		},
		coverPeriod: { heightMm: 10, widthMm: 128, xMm: 10, yMm: 150 },
		coverTitle: { heightMm: 24, widthMm: 128, xMm: 10, yMm: 10 },
		dayImage: { heightMm: 28, widthMm: 58, xMm: 10, yMm: 26 },
		pageWidthMm: 128,
	},
} as const;

export type TravelNewspaperCompositionId =
	keyof typeof TRAVEL_NEWSPAPER_COMPOSITIONS;

const PROFILE_FIELDS = derivedStyleProfileFields(
	TRAVEL_NEWSPAPER_STYLE_PROFILES,
);

export const TRAVEL_NEWSPAPER_DECOR_ASSET_IDS = PROFILE_FIELDS.decorAssetIds;
export const TRAVEL_NEWSPAPER_FONT_FAMILIES = PROFILE_FIELDS.fontFamilies;

/** Family selection is owned by 21.5; this family has no mood aliases. */
export const TRAVEL_NEWSPAPER_FAMILY = {
	...PROFILE_FIELDS,
	id: "travel-newspaper",
	moodIds: [],
	policyId: "timetable",
	styleProfiles: TRAVEL_NEWSPAPER_STYLE_PROFILES,
} as const satisfies VisualFamilyDefinition;

export function travelNewspaperPaletteFor(paletteId: string) {
	const palette =
		TRAVEL_NEWSPAPER_PALETTES[paletteId as TravelNewspaperPaletteId];
	if (!palette) {
		throw new Error(`travel-newspaperの配色「${paletteId}」がありません。`);
	}
	return palette;
}

export function travelNewspaperCompositionFor(compositionId: string) {
	const composition =
		TRAVEL_NEWSPAPER_COMPOSITIONS[
			compositionId as TravelNewspaperCompositionId
		];
	if (!composition) {
		throw new Error(`travel-newspaperの構図「${compositionId}」がありません。`);
	}
	return composition;
}

for (const palette of Object.values(TRAVEL_NEWSPAPER_PALETTES)) {
	validateFamilyTextSafety("travel-newspaper", palette.paper, [
		{ colorHex: palette.ink, fontSizePt: 32, role: "display" },
		{ colorHex: palette.ink, fontSizePt: 10, role: "body" },
		{ colorHex: palette.ink, fontSizePt: 8.5, role: "utility" },
	]);
}
