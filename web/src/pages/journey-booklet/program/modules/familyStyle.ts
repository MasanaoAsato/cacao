import type { BookletFamilyId } from "../../../../booklet/family";
import type { StyleBundle } from "../../../../theme/directions/styleBundles";
import { validateFamilyTextSafety } from "../../../../theme/families/decorPlacement";
import {
	ALL_BOOKLET_STYLE_PROFILES,
	type BookletStyleProfile,
} from "../../../../theme/families/styleProfiles";

/** The five color roles every extracted family reads. */
export type FamilyPalette = {
	readonly accent: string;
	readonly ink: string;
	readonly paper: string;
	readonly secondary: string;
	readonly soft: string;
};

/** Fonts, sizes and weights in the shape the family renderers already use. */
export type FamilyTypography = Pick<
	BookletStyleProfile,
	"fontFamilies" | "fontSizesPt" | "fontWeights"
>;

function channels(hex: string): readonly [number, number, number] {
	const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
	if (!match) throw new Error(`色「${hex}」を解釈できません。`);
	return [
		Number.parseInt(match[1] ?? "0", 16),
		Number.parseInt(match[2] ?? "0", 16),
		Number.parseInt(match[3] ?? "0", 16),
	];
}

/** `base` moved toward `other` by `amount` (0..1), as a hex color. */
export function mixHex(base: string, other: string, amount: number): string {
	const a = channels(base);
	const b = channels(other);
	return `#${a
		.map((value, index) =>
			Math.round(value + ((b[index] ?? value) - value) * amount)
				.toString(16)
				.padStart(2, "0"),
		)
		.join("")
		.toUpperCase()}`;
}

/**
 * A direction bundle in the family's color roles. Paper, ink and accent move
 * together; the soft surface is a tint of the paper. Unlike a registered
 * profile, this palette is checked for the scene itself before drawing.
 */
export function familyPaletteFromBundle(
	familyId: BookletFamilyId,
	bundle: StyleBundle,
): FamilyPalette {
	const palette = {
		accent: bundle.accentColor,
		ink: bundle.bodyColor,
		paper: bundle.paperColor,
		secondary: mixHex(bundle.paperColor, bundle.bodyColor, 0.35),
		soft: mixHex(bundle.paperColor, bundle.accentColor, 0.14),
	};
	for (const surface of [palette.paper, palette.soft]) {
		validateFamilyTextSafety(familyId, surface, [
			{
				colorHex: palette.ink,
				fontSizePt: bundle.displayFontSizePt,
				role: "display",
			},
			{
				colorHex: palette.ink,
				fontSizePt: bundle.bodyFontSizePt,
				role: "body",
			},
			{
				colorHex: palette.ink,
				fontSizePt: bundle.utilityFontSizePt,
				role: "utility",
			},
		]);
	}
	return palette;
}

export function familyTypographyFromBundle(
	bundle: StyleBundle,
): FamilyTypography {
	return {
		fontFamilies: {
			body: bundle.bodyFontFamily,
			display: bundle.displayFontFamily,
			utility: bundle.utilityFontFamily,
		},
		fontSizesPt: {
			body: bundle.bodyFontSizePt,
			title: bundle.displayFontSizePt,
			utility: bundle.utilityFontSizePt,
		},
		fontWeights: {
			body: bundle.bodyFontWeight,
			display: bundle.displayFontWeight,
			utility: bundle.utilityFontWeight,
		},
	};
}

/** The regression path: a registered profile of exactly this family. */
export function familyProfileById<F extends BookletFamilyId>(
	familyId: F,
	profileId: string,
): Extract<BookletStyleProfile, { readonly familyId: F }> {
	const profile = ALL_BOOKLET_STYLE_PROFILES.find(
		(item): item is Extract<BookletStyleProfile, { readonly familyId: F }> =>
			item.id === profileId && item.familyId === familyId,
	);
	if (!profile)
		throw new Error(
			`${familyId}の作風プロファイル「${profileId}」がありません。`,
		);
	return profile;
}

export function typographyFonts(typography: FamilyTypography) {
	const fonts = new Map<string, { family: string; weight: 400 | 700 }>();
	for (const role of ["body", "display", "utility"] as const) {
		const font = {
			family: typography.fontFamilies[role],
			weight: typography.fontWeights[role],
		};
		fonts.set(`${font.weight} ${font.family}`, font);
	}
	return [...fonts.values()];
}
