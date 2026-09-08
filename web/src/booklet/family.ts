import type { RequestedBookletTheme } from "../theme/types";
import type { PolicyId } from "./editorialModel";
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
	readonly decorAssetIds: readonly string[];
	readonly familyId: BookletFamilyId;
	readonly fontFamilies: readonly string[];
	readonly paletteId: string;
	readonly policyId: PolicyId;
	readonly renderKey: string;
	readonly requestedTheme: RequestedBookletTheme;
	readonly seedToken: string;
};

/** The legacy pagination contract is deliberately kept separate from family plans. */
export type BookletRenderPagePlan = {
	readonly familyId: "legacy";
	readonly pagePlan: readonly BookletPagePlan[];
};

export type FamilyMeasurement = {
	readonly caseId: string;
	readonly heightPx: number;
	readonly widthPx: number;
};

export type FamilyMeasurements = ReadonlyMap<string, FamilyMeasurement>;
