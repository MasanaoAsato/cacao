import type { PolicyId } from "../../src/booklet/editorialModel.js";
import type { BookletFamilyId } from "../../src/booklet/family.js";
import type { MoodId, ThemeRecipeDefinition } from "../../src/theme/types.js";

export type MoodSample = {
	readonly decorId: ThemeRecipeDefinition["decorId"] | null;
	readonly familyId: BookletFamilyId;
	readonly policyId: PolicyId;
	readonly seed: number;
};

/**
 * Families introduced before the family-selection catalog is wired to a mood
 * keep an explicit comparison seed. The browser fixture remains the same
 * journey and image set; these records let the comparison gate validate their
 * profile and policy contract without assigning a new mood alias.
 */
export type FamilyComparisonSample = {
	readonly expectedCompositionId: string;
	readonly expectedPolicyId: PolicyId;
	readonly familyId: BookletFamilyId;
	readonly seed: number;
	readonly styleProfileIds: readonly string[];
};

export const FAMILY_COMPARISON_SAMPLES: readonly FamilyComparisonSample[] =
	Object.freeze([
		{
			expectedCompositionId: "magazine-feature",
			expectedPolicyId: "captions",
			familyId: "editorial-magazine",
			seed: 0x2103,
			styleProfileIds: [
				"editorial-magazine.quiet-photo",
				"editorial-magazine.bold-culture",
			],
		},
		{
			expectedCompositionId: "newspaper-columns",
			expectedPolicyId: "timetable",
			familyId: "travel-newspaper",
			seed: 0x2104,
			styleProfileIds: [
				"travel-newspaper.classic-travel",
				"travel-newspaper.city-walk",
			],
		},
	]);

/**
 * One fixed seed per mood for pixel snapshots and cross-theme comparisons.
 * Keep these values stable: changing them invalidates the comparison baseline.
 */
export const MOOD_SAMPLE_SEEDS: Readonly<Record<MoodId, MoodSample>> = {
	"festival-ticket": {
		decorId: null,
		familyId: "playful-route",
		policyId: "route",
		seed: 2,
	},
	"field-notes": {
		decorId: "sheet-on-dots",
		familyId: "paper-collage",
		policyId: "captions",
		seed: 25,
	},
	"night-train": {
		decorId: null,
		familyId: "atlas-grid",
		policyId: "timetable",
		seed: 10,
	},
	postcard: {
		decorId: null,
		familyId: "playful-route",
		policyId: "route",
		seed: 28,
	},
	"quiet-gallery": {
		decorId: "photo-wash",
		familyId: "paper-collage",
		policyId: "captions",
		seed: 46,
	},
	wayfinder: {
		decorId: null,
		familyId: "atlas-grid",
		policyId: "timetable",
		seed: 0,
	},
};
