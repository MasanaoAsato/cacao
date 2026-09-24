import type { MotifAssetId } from "../theme/motifAssets";

/** The five families extracted as drawing modules (25.4). */
export type BookletFamilyId =
	| "atlas-grid"
	| "paper-collage"
	| "playful-route"
	| "editorial-magazine"
	| "travel-newspaper";

/** What a family scene needs to place and check its decor reproducibly. */
export type FamilyDecorDesign = {
	readonly compositionId: string;
	readonly decorAssetIds: readonly MotifAssetId[];
	readonly familyId: BookletFamilyId;
	readonly seedToken: string;
};
