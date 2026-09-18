import type { MotifAssetId } from "../theme/motifAssets";
import type { RequestedBookletTheme } from "../theme/types";
import type { PolicyId } from "./editorialModel";
import type { AtlasGridPagePlan } from "./families/atlasGrid";
import type { PaperCollagePagePlan } from "./families/paperCollage";
import type { PlayfulRoutePagePlan } from "./families/playfulRoute";
import type { BookletPagePlan } from "./model";

export type BookletFamilyId =
	| "legacy"
	| "atlas-grid"
	| "paper-collage"
	| "playful-route";

/**
 * The design selected from a v2 theme seed. This remains independent of React
 * so page planners and renderers share one reproducible input.
 */
export type ResolvedBookletDesign = {
	readonly comparisonKey: string;
	readonly compositionId: string;
	readonly decorAssetIds: readonly MotifAssetId[];
	readonly familyId: BookletFamilyId;
	readonly fontFamilies: readonly string[];
	readonly paletteId: string;
	readonly policyId: PolicyId;
	readonly renderKey: string;
	readonly requestedTheme: RequestedBookletTheme;
	readonly seedToken: string;
};

export type BookletRenderPagePlan =
	| {
			readonly familyId: "legacy";
			readonly pagePlan: readonly BookletPagePlan[];
	  }
	| {
			readonly coverTitleSizePt: number;
			readonly familyId: "atlas-grid";
			readonly pagePlan: readonly AtlasGridPagePlan[];
	  }
	| {
			readonly coverTitleSizePt: number;
			readonly familyId: "paper-collage";
			readonly pagePlan: readonly PaperCollagePagePlan[];
	  }
	| {
			readonly coverTitleSizePt: number;
			readonly familyId: "playful-route";
			readonly pagePlan: readonly PlayfulRoutePagePlan[];
	  };

export type FamilyMeasurement = {
	readonly caseId: string;
	readonly heightPx: number;
	readonly widthPx: number;
};

export type FamilyMeasurements = ReadonlyMap<string, FamilyMeasurement>;
