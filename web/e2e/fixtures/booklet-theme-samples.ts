import type { MoodId, ThemeRecipeDefinition } from "../../src/theme/types.js";

export type MoodSample = {
	readonly decorId: ThemeRecipeDefinition["decorId"] | null;
	readonly seed: number;
};

/**
 * One fixed seed per mood for pixel snapshots and cross-theme comparisons.
 * Keep these values stable: changing them invalidates the comparison baseline.
 */
export const MOOD_SAMPLE_SEEDS: Readonly<Record<MoodId, MoodSample>> = {
	"festival-ticket": { decorId: null, seed: 2 },
	"field-notes": { decorId: "sheet-on-dots", seed: 25 },
	"night-train": { decorId: null, seed: 10 },
	postcard: { decorId: null, seed: 28 },
	"quiet-gallery": { decorId: "photo-wash", seed: 46 },
	wayfinder: { decorId: null, seed: 0 },
};
