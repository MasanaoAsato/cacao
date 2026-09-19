import type { MoodId, ThemeRecipeDefinition } from "../../src/theme/types.js";
import type { BookletFamilyId } from "../../src/booklet/family.js";
import type { PolicyId } from "../../src/booklet/editorialModel.js";

export type MoodSample = {
	readonly decorId: ThemeRecipeDefinition["decorId"] | null;
	readonly familyId: BookletFamilyId;
	readonly policyId: PolicyId;
	readonly seed: number;
};

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
