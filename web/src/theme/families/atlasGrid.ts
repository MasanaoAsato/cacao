import { validateFamilyTextSafety } from "./decorPlacement";

export const ATLAS_GRID_PALETTES = {
	blueprint: {
		accent: "#1D4ED8",
		ink: "#142D4E",
		paper: "#F4F7FB",
		secondary: "#A7BFDA",
		soft: "#DDE7F3",
	},
	"forest-atlas": {
		accent: "#2A6945",
		ink: "#213B2A",
		paper: "#F2F5F1",
		secondary: "#9DB8A6",
		soft: "#D0E2D4",
	},
} as const;

export type AtlasGridPaletteId = keyof typeof ATLAS_GRID_PALETTES;

export const ATLAS_GRID_COMPOSITIONS = {
	"side-index": {
		columnWidthsMm: [26, 78, 24],
		coverImage: { heightMm: 98, widthMm: 88, xMm: 10, yMm: 70 },
		coverPeriod: { heightMm: 98, widthMm: 34, xMm: 104, yMm: 70 },
		coverTitle: { heightMm: 44, widthMm: 128, xMm: 10, yMm: 10 },
		timeFontSizePt: 12,
	},
	"wide-image": {
		columnWidthsMm: [19, 75, 34],
		coverImage: { heightMm: 75, widthMm: 128, xMm: 10, yMm: 80 },
		coverPeriod: { heightMm: 24, widthMm: 128, xMm: 10, yMm: 166 },
		coverTitle: { heightMm: 50, widthMm: 100, xMm: 10, yMm: 10 },
		timeFontSizePt: 10,
	},
} as const;

export type AtlasGridCompositionId = keyof typeof ATLAS_GRID_COMPOSITIONS;

export function atlasGridPaletteFor(paletteId: string) {
	const palette = ATLAS_GRID_PALETTES[paletteId as AtlasGridPaletteId];
	if (!palette) {
		throw new Error(`atlas-gridの配色「${paletteId}」がありません。`);
	}
	return palette;
}

export function atlasGridCompositionFor(compositionId: string) {
	const composition =
		ATLAS_GRID_COMPOSITIONS[compositionId as AtlasGridCompositionId];
	if (!composition) {
		throw new Error(`atlas-gridの構図「${compositionId}」がありません。`);
	}
	return composition;
}

for (const palette of Object.values(ATLAS_GRID_PALETTES)) {
	for (const surface of [palette.paper, palette.soft]) {
		validateFamilyTextSafety("atlas-grid", surface, [
			{ colorHex: palette.ink, fontSizePt: 20, role: "display" },
			{ colorHex: palette.ink, fontSizePt: 10, role: "body" },
			{ colorHex: palette.ink, fontSizePt: 8.5, role: "utility" },
		]);
	}
}
