import { validateFamilyTextSafety } from "./decorPlacement";

export const EDITORIAL_MAGAZINE_PALETTES = {
	"quiet-photo": {
		accent: "#71827D",
		ink: "#272522",
		paper: "#F7F5EF",
		secondary: "#D7DED8",
		soft: "#E9E6DC",
	},
	"bold-culture": {
		accent: "#C84B36",
		ink: "#151515",
		paper: "#F1EFE8",
		secondary: "#E1C9BD",
		soft: "#DDD8CC",
	},
} as const;

export type EditorialMagazinePaletteId =
	keyof typeof EDITORIAL_MAGAZINE_PALETTES;

export const EDITORIAL_MAGAZINE_COMPOSITIONS = {
	"magazine-feature": {
		articleStartYmm: 80,
		continuationStartYmm: 30,
		coverTitle: { heightMm: 24, widthMm: 128, xMm: 10, yMm: 10 },
		quietCoverImage: { heightMm: 92, widthMm: 128, xMm: 10, yMm: 40 },
		boldCoverImage: { heightMm: 72, widthMm: 78, xMm: 60, yMm: 40 },
		pageWidthMm: 128,
	},
} as const;

export type EditorialMagazineCompositionId =
	keyof typeof EDITORIAL_MAGAZINE_COMPOSITIONS;

export function editorialMagazinePaletteFor(paletteId: string) {
	const palette =
		EDITORIAL_MAGAZINE_PALETTES[paletteId as EditorialMagazinePaletteId];
	if (!palette) {
		throw new Error(`editorial-magazineの配色「${paletteId}」がありません。`);
	}
	return palette;
}

export function editorialMagazineCompositionFor(compositionId: string) {
	const composition =
		EDITORIAL_MAGAZINE_COMPOSITIONS[
			compositionId as EditorialMagazineCompositionId
		];
	if (!composition) {
		throw new Error(
			`editorial-magazineの構図「${compositionId}」がありません。`,
		);
	}
	return composition;
}

for (const palette of Object.values(EDITORIAL_MAGAZINE_PALETTES)) {
	validateFamilyTextSafety("editorial-magazine", palette.paper, [
		{ colorHex: palette.ink, fontSizePt: 32, role: "display" },
		{ colorHex: palette.ink, fontSizePt: 10, role: "body" },
		{ colorHex: palette.ink, fontSizePt: 8.5, role: "utility" },
	]);
}
