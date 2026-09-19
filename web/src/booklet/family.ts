import type { BookletStyleProfile } from "../theme/families/styleProfiles";
import type { MotifAssetId } from "../theme/motifAssets";
import type { RequestedBookletTheme } from "../theme/types";
import type { PolicyId } from "./editorialModel";
import type { AtlasGridPagePlan } from "./families/atlasGrid";
import type { EditorialMagazinePagePlan } from "./families/editorialMagazine";
import type { PaperCollagePagePlan } from "./families/paperCollage";
import type { PlayfulRoutePagePlan } from "./families/playfulRoute";
import type { BookletPagePlan } from "./model";

export type BookletFamilyId =
	| "legacy"
	| "atlas-grid"
	| "paper-collage"
	| "playful-route"
	| "editorial-magazine";

/**
 * The design selected from a v2 theme seed. This remains independent of React
 * so page planners and renderers share one reproducible input.
 */
export type ResolvedBookletDesign = {
	readonly comparisonKey: string;
	readonly compositionId: string;
	readonly decorAssetIds: readonly MotifAssetId[];
	/**
	 * The decor variant the seed selected, for families that publish more than
	 * one. `null` for every family that does not (20.11).
	 */
	readonly decorVariantId: string | null;
	readonly familyId: BookletFamilyId;
	readonly fontFamilies: readonly string[];
	readonly paletteId: string;
	readonly policyId: PolicyId;
	readonly renderKey: string;
	readonly requestedTheme: RequestedBookletTheme;
	readonly seedToken: string;
	/** `null` only for the internal legacy renderer. */
	readonly styleProfile: BookletStyleProfile | null;
	readonly styleProfileId: string | null;
};

export type BookletRenderPagePlan =
	| {
			readonly actualCompositionId: string;
			readonly familyId: "legacy";
			readonly pagePlan: readonly BookletPagePlan[];
	  }
	| {
			readonly actualCompositionId: string;
			readonly coverTitleSizePt: number;
			readonly familyId: "atlas-grid";
			readonly pagePlan: readonly AtlasGridPagePlan[];
	  }
	| {
			readonly actualCompositionId: string;
			readonly coverTitleSizePt: number;
			readonly familyId: "paper-collage";
			readonly pagePlan: readonly PaperCollagePagePlan[];
	  }
	| {
			readonly actualCompositionId: string;
			readonly coverTitleSizePt: number;
			readonly familyId: "playful-route";
			readonly pagePlan: readonly PlayfulRoutePagePlan[];
	  }
	| {
			readonly actualCompositionId: "magazine-feature";
			readonly familyId: "editorial-magazine";
			readonly pagePlan: readonly EditorialMagazinePagePlan[];
	  };

export type FamilyMeasurement = {
	readonly caseId: string;
	readonly heightPx: number;
	readonly widthPx: number;
};

export type FamilyMeasurements = ReadonlyMap<string, FamilyMeasurement>;
