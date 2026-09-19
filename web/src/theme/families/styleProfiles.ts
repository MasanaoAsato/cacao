import type { PolicyId } from "../../booklet/editorialModel";
import type { BookletFamilyId } from "../../booklet/family";
import type { MotifAssetId } from "../motifAssets";

export type StyleFontRoles = {
	readonly body: string;
	readonly display: string;
	readonly utility: string;
};

export type StyleFontWeights = {
	readonly body: 400 | 700;
	readonly display: 400 | 700;
	readonly utility: 400 | 700;
};

export type StyleFontSizesPt = {
	readonly body: number;
	readonly title: number;
	readonly utility: number;
};

export type DecorMode = "css" | "motif";

/**
 * A reviewed visual set. Its fields deliberately are not independently
 * sampled: a profile is the only selectable style unit within a family.
 */
type BookletStyleProfileBase = {
	readonly compositionIds: readonly string[];
	readonly decorAssetIds: readonly MotifAssetId[];
	readonly decorMode: DecorMode;
	readonly decorVariantId: string | null;
	readonly fontFamilies: StyleFontRoles;
	readonly fontSizesPt: StyleFontSizesPt;
	readonly fontWeights: StyleFontWeights;
	readonly id: string;
	readonly paletteId: string;
	readonly photoTreatment: string;
	readonly ruleTreatment: string;
};

export type BookletStyleProfile = {
	readonly [FamilyId in Exclude<
		BookletFamilyId,
		"legacy"
	>]: BookletStyleProfileBase & { readonly familyId: FamilyId };
}[Exclude<BookletFamilyId, "legacy">];

const ATLAS_DECOR_ASSET_IDS = [
	"atlas-compass",
	"atlas-route-mark",
	"atlas-perforation",
] as const;

const PAPER_DECOR_ASSET_IDS = [
	"paper-torn-sheet",
	"paper-tape",
	"paper-leaf",
	"paper-postage",
] as const;

export const BOOKLET_STYLE_PROFILES: readonly BookletStyleProfile[] =
	Object.freeze([
		{
			compositionIds: ["side-index", "wide-image"],
			decorAssetIds: ATLAS_DECOR_ASSET_IDS,
			decorMode: "motif",
			decorVariantId: null,
			familyId: "atlas-grid",
			fontFamilies: {
				body: "Zen Kaku Gothic New",
				display: "Zen Kaku Gothic New",
				utility: "Noto Sans JP",
			},
			fontSizesPt: { body: 10, title: 28, utility: 8.5 },
			fontWeights: { body: 400, display: 700, utility: 700 },
			id: "atlas-grid.atlas-wayfinder",
			paletteId: "blueprint",
			photoTreatment: "wide-image-crop",
			ruleTreatment: "fine-blueprint",
		},
		{
			compositionIds: ["side-index", "wide-image"],
			decorAssetIds: ATLAS_DECOR_ASSET_IDS,
			decorMode: "motif",
			decorVariantId: null,
			familyId: "atlas-grid",
			fontFamilies: {
				body: "Zen Kaku Gothic New",
				display: "Zen Kaku Gothic New",
				utility: "Noto Sans JP",
			},
			fontSizesPt: { body: 10, title: 26, utility: 8.5 },
			fontWeights: { body: 400, display: 700, utility: 700 },
			id: "atlas-grid.atlas-field-record",
			paletteId: "forest-atlas",
			photoTreatment: "record-field",
			ruleTreatment: "forest-rule",
		},
		{
			compositionIds: ["photo-left", "photo-right"],
			decorAssetIds: PAPER_DECOR_ASSET_IDS,
			decorMode: "motif",
			decorVariantId: null,
			familyId: "paper-collage",
			fontFamilies: {
				body: "Noto Serif JP",
				display: "Kaisei Decol",
				utility: "Noto Sans JP",
			},
			fontSizesPt: { body: 10, title: 30, utility: 8.5 },
			fontWeights: { body: 400, display: 700, utility: 700 },
			id: "paper-collage.paper-cut",
			paletteId: "sage-paper",
			photoTreatment: "straight-paper",
			ruleTreatment: "cut-line",
		},
		{
			compositionIds: ["photo-left", "photo-right"],
			decorAssetIds: PAPER_DECOR_ASSET_IDS,
			decorMode: "motif",
			decorVariantId: null,
			familyId: "paper-collage",
			fontFamilies: {
				body: "Noto Serif JP",
				display: "Kaisei Decol",
				utility: "Noto Sans JP",
			},
			fontSizesPt: { body: 10, title: 28, utility: 8.5 },
			fontWeights: { body: 400, display: 700, utility: 700 },
			id: "paper-collage.paper-scrapbook",
			paletteId: "lilac-paper",
			photoTreatment: "rotated-paper",
			ruleTreatment: "hand-pasted",
		},
		{
			compositionIds: ["zigzag", "ribbon"],
			decorAssetIds: [
				"playful-bag",
				"playful-sun",
				"playful-squiggle",
				"playful-burst",
			],
			decorMode: "motif",
			decorVariantId: "sunny",
			familyId: "playful-route",
			fontFamilies: {
				body: "M PLUS Rounded 1c",
				display: "Dela Gothic One",
				utility: "Noto Sans JP",
			},
			fontSizesPt: { body: 10, title: 32, utility: 8.5 },
			fontWeights: { body: 700, display: 400, utility: 400 },
			id: "playful-route.playful-pop",
			paletteId: "berry-sun",
			photoTreatment: "rounded-photo",
			ruleTreatment: "rounded-route",
		},
		{
			compositionIds: ["zigzag", "ribbon"],
			decorAssetIds: [
				"playful-sun",
				"playful-footprints",
				"playful-curved-arrow",
			],
			decorMode: "motif",
			decorVariantId: "walking",
			familyId: "playful-route",
			fontFamilies: {
				body: "Noto Sans JP",
				display: "Dela Gothic One",
				utility: "Noto Sans JP",
			},
			fontSizesPt: { body: 10, title: 28, utility: 8.5 },
			fontWeights: { body: 400, display: 400, utility: 700 },
			id: "playful-route.playful-travel-diary",
			paletteId: "harbor-play",
			photoTreatment: "diary-photo",
			ruleTreatment: "hand-drawn-route",
		},
	] as const satisfies readonly BookletStyleProfile[]);

/** Editorial magazine profiles are CSS-only and intentionally share no motif assets. */
export const EDITORIAL_MAGAZINE_STYLE_PROFILES: readonly BookletStyleProfile[] =
	Object.freeze([
		{
			compositionIds: ["magazine-feature"],
			decorAssetIds: [],
			decorMode: "css",
			decorVariantId: null,
			familyId: "editorial-magazine",
			fontFamilies: {
				body: "Noto Serif JP",
				display: "Shippori Mincho",
				utility: "Noto Sans JP",
			},
			fontSizesPt: { body: 10, title: 30, utility: 8.5 },
			fontWeights: { body: 400, display: 700, utility: 700 },
			id: "editorial-magazine.quiet-photo",
			paletteId: "quiet-photo",
			photoTreatment: "rectangular-crop",
			ruleTreatment: "accent-hairline",
		},
		{
			compositionIds: ["magazine-feature"],
			decorAssetIds: [],
			decorMode: "css",
			decorVariantId: null,
			familyId: "editorial-magazine",
			fontFamilies: {
				body: "Noto Sans JP",
				display: "Zen Kaku Gothic New",
				utility: "Noto Sans JP",
			},
			fontSizesPt: { body: 10, title: 32, utility: 8.5 },
			fontWeights: { body: 400, display: 700, utility: 700 },
			id: "editorial-magazine.bold-culture",
			paletteId: "bold-culture",
			photoTreatment: "right-aligned-crop",
			ruleTreatment: "ink-and-accent-short-rule",
		},
	] as const satisfies readonly BookletStyleProfile[]);

/** Travel newspaper profiles are CSS-only and intentionally share no motif assets. */
export const TRAVEL_NEWSPAPER_STYLE_PROFILES: readonly BookletStyleProfile[] =
	Object.freeze([
		{
			compositionIds: ["newspaper-columns"],
			decorAssetIds: [],
			decorMode: "css",
			decorVariantId: null,
			familyId: "travel-newspaper",
			fontFamilies: {
				body: "Noto Serif JP",
				display: "Shippori Mincho",
				utility: "Noto Sans JP",
			},
			fontSizesPt: { body: 10, title: 28, utility: 8.5 },
			fontWeights: { body: 400, display: 700, utility: 700 },
			id: "travel-newspaper.classic-travel",
			paletteId: "classic-travel",
			photoTreatment: "left-aligned-crop",
			ruleTreatment: "double-rule",
		},
		{
			compositionIds: ["newspaper-columns"],
			decorAssetIds: [],
			decorMode: "css",
			decorVariantId: null,
			familyId: "travel-newspaper",
			fontFamilies: {
				body: "Noto Sans JP",
				display: "Zen Kaku Gothic New",
				utility: "Noto Sans JP",
			},
			fontSizesPt: { body: 10, title: 30, utility: 8.5 },
			fontWeights: { body: 400, display: 700, utility: 700 },
			id: "travel-newspaper.city-walk",
			paletteId: "city-walk",
			photoTreatment: "right-aligned-crop",
			ruleTreatment: "accent-band",
		},
	] as const satisfies readonly BookletStyleProfile[]);

export const ALL_BOOKLET_STYLE_PROFILES: readonly BookletStyleProfile[] =
	Object.freeze([
		...BOOKLET_STYLE_PROFILES,
		...EDITORIAL_MAGAZINE_STYLE_PROFILES,
		...TRAVEL_NEWSPAPER_STYLE_PROFILES,
	]);

export function styleProfilesForFamily<
	FamilyId extends Exclude<BookletFamilyId, "legacy">,
>(
	familyId: FamilyId,
): readonly Extract<BookletStyleProfile, { familyId: FamilyId }>[] {
	return ALL_BOOKLET_STYLE_PROFILES.filter(
		(
			profile,
		): profile is Extract<BookletStyleProfile, { familyId: FamilyId }> =>
			profile.familyId === familyId,
	);
}

export function styleProfileFor(styleProfileId: string): BookletStyleProfile {
	const profile = ALL_BOOKLET_STYLE_PROFILES.find(
		(candidate) => candidate.id === styleProfileId,
	);
	if (!profile) {
		throw new Error(`作風プロファイル「${styleProfileId}」がありません。`);
	}
	return profile;
}

export function fontStack(family: string): string {
	const generic =
		family === "Kaisei Decol" ||
		family === "Noto Serif JP" ||
		family === "Shippori Mincho"
			? "serif"
			: "sans-serif";
	return `"${family}", ${generic}`;
}

export function derivedStyleProfileFields(
	profiles: readonly BookletStyleProfile[],
): Pick<BookletStyleProfile, "compositionIds" | "decorAssetIds"> & {
	readonly fontFamilies: readonly string[];
	readonly paletteIds: readonly string[];
} {
	if (profiles.length === 0) {
		throw new Error("系統に作風プロファイルがありません。");
	}
	return Object.freeze({
		compositionIds: Object.freeze([
			...new Set(profiles.flatMap((profile) => profile.compositionIds)),
		]),
		decorAssetIds: Object.freeze([
			...new Set(profiles.flatMap((profile) => profile.decorAssetIds)),
		]),
		fontFamilies: Object.freeze([
			...new Set(
				profiles.flatMap((profile) => [
					profile.fontFamilies.display,
					profile.fontFamilies.body,
					profile.fontFamilies.utility,
				]),
			),
		]),
		paletteIds: Object.freeze([
			...new Set(profiles.map((profile) => profile.paletteId)),
		]),
	});
}

export type FamilyStyleProfileDefinition = {
	readonly id: Exclude<BookletFamilyId, "legacy">;
	readonly moodIds: readonly import("../types").MoodId[];
	readonly policyId: PolicyId;
	readonly styleProfiles: readonly BookletStyleProfile[];
};
