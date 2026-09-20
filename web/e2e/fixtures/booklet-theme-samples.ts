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
			expectedCompositionId: "wide-image",
			expectedPolicyId: "timetable",
			familyId: "atlas-grid",
			seed: 12,
			styleProfileIds: ["atlas-grid.atlas-wayfinder"],
		},
		{
			expectedCompositionId: "wide-image",
			expectedPolicyId: "timetable",
			familyId: "atlas-grid",
			seed: 13,
			styleProfileIds: ["atlas-grid.atlas-field-record"],
		},
		{
			expectedCompositionId: "photo-left",
			expectedPolicyId: "captions",
			familyId: "paper-collage",
			seed: 2,
			styleProfileIds: ["paper-collage.paper-cut"],
		},
		{
			expectedCompositionId: "photo-left",
			expectedPolicyId: "captions",
			familyId: "paper-collage",
			seed: 6,
			styleProfileIds: ["paper-collage.paper-scrapbook"],
		},
		{
			expectedCompositionId: "ribbon",
			expectedPolicyId: "route",
			familyId: "playful-route",
			seed: 1,
			styleProfileIds: ["playful-route.playful-pop"],
		},
		{
			expectedCompositionId: "ribbon",
			expectedPolicyId: "route",
			familyId: "playful-route",
			seed: 3,
			styleProfileIds: ["playful-route.playful-travel-diary"],
		},
		{
			expectedCompositionId: "magazine-feature",
			expectedPolicyId: "captions",
			familyId: "editorial-magazine",
			seed: 75,
			styleProfileIds: ["editorial-magazine.bold-culture"],
		},
		{
			expectedCompositionId: "magazine-feature",
			expectedPolicyId: "captions",
			familyId: "editorial-magazine",
			seed: 92,
			styleProfileIds: ["editorial-magazine.quiet-photo"],
		},
		{
			expectedCompositionId: "newspaper-columns",
			expectedPolicyId: "timetable",
			familyId: "travel-newspaper",
			seed: 0,
			styleProfileIds: ["travel-newspaper.classic-travel"],
		},
		{
			expectedCompositionId: "newspaper-columns",
			expectedPolicyId: "timetable",
			familyId: "travel-newspaper",
			seed: 5,
			styleProfileIds: ["travel-newspaper.city-walk"],
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
