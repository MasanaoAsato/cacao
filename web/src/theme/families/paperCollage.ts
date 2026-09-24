import { validateFamilyTextSafety } from "./decorPlacement";

const PAPER_COLLAGE_PALETTES = {
	"lilac-paper": {
		accent: "#584792",
		ink: "#343049",
		paper: "#F3F0F6",
		secondary: "#C6D8D0",
		soft: "#DCD6E9",
	},
	"sage-paper": {
		accent: "#6D3856",
		ink: "#26362D",
		paper: "#EFF4F2",
		secondary: "#DDD4B2",
		soft: "#D8C6D0",
	},
} as const;

type PaperCollagePaletteId = keyof typeof PAPER_COLLAGE_PALETTES;

const PAPER_COLLAGE_COMPOSITIONS = {
	"photo-left": {
		coverImage: { heightMm: 84, widthMm: 112, xMm: 10, yMm: 64 },
		coverPeriod: { heightMm: 20, widthMm: 100, xMm: 10, yMm: 180 },
		coverTitle: { heightMm: 42, widthMm: 128, xMm: 10, yMm: 10 },
		dayHeading: { heightMm: 36, widthMm: 80, xMm: 58, yMm: 10 },
		dayImage: { heightMm: 36, widthMm: 42, xMm: 10, yMm: 10 },
	},
	"photo-right": {
		coverImage: { heightMm: 84, widthMm: 112, xMm: 26, yMm: 64 },
		coverPeriod: { heightMm: 20, widthMm: 100, xMm: 10, yMm: 180 },
		coverTitle: { heightMm: 42, widthMm: 128, xMm: 10, yMm: 10 },
		dayHeading: { heightMm: 36, widthMm: 80, xMm: 10, yMm: 10 },
		dayImage: { heightMm: 36, widthMm: 42, xMm: 96, yMm: 10 },
	},
} as const;

type PaperCollageCompositionId = keyof typeof PAPER_COLLAGE_COMPOSITIONS;

export function paperCollagePaletteFor(paletteId: string) {
	const palette = PAPER_COLLAGE_PALETTES[paletteId as PaperCollagePaletteId];
	if (!palette) {
		throw new Error(`paper-collageの配色「${paletteId}」がありません。`);
	}
	return palette;
}

export function paperCollageCompositionFor(compositionId: string) {
	const composition =
		PAPER_COLLAGE_COMPOSITIONS[compositionId as PaperCollageCompositionId];
	if (!composition) {
		throw new Error(`paper-collageの構図「${compositionId}」がありません。`);
	}
	return composition;
}

for (const palette of Object.values(PAPER_COLLAGE_PALETTES)) {
	validateFamilyTextSafety("paper-collage", palette.paper, [
		{ colorHex: palette.ink, fontSizePt: 36, role: "display" },
		{ colorHex: palette.ink, fontSizePt: 10, role: "body" },
		{ colorHex: palette.ink, fontSizePt: 8.5, role: "utility" },
	]);
	validateFamilyTextSafety("paper-collage", "#FFFFFF", [
		{ colorHex: palette.ink, fontSizePt: 14, role: "body" },
		{ colorHex: palette.ink, fontSizePt: 10, role: "body" },
		{ colorHex: palette.ink, fontSizePt: 8.5, role: "utility" },
	]);
}
