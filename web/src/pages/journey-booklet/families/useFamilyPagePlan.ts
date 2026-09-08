import type {
	BookletRenderPagePlan,
	ResolvedBookletDesign,
} from "../../../booklet/family";
import type { BookletModel } from "../../../booklet/model";
import type { BookletPagePlanResult } from "../useBookletPagePlan";
import { familyAdapterFor } from "./registry";

export type FamilyPagePlanResult = BookletPagePlanResult & {
	readonly design: ResolvedBookletDesign | null;
	readonly renderPagePlan: BookletRenderPagePlan | null;
};

export function isCurrentFamilyPagePlan(
	result: Pick<FamilyPagePlanResult, "preparedModel" | "preparedRenderKey">,
	model: BookletModel | null,
	design: ResolvedBookletDesign | null,
): boolean {
	return (
		model !== null &&
		design !== null &&
		result.preparedModel === model &&
		result.preparedRenderKey === design.renderKey
	);
}

/**
 * Delegates planning to the selected family, including its measurement and
 * document-fit validation. The current registry contains only legacy.
 */
export function useFamilyPagePlan(
	model: BookletModel | null,
	design: ResolvedBookletDesign | null,
): FamilyPagePlanResult {
	return familyAdapterFor(design?.familyId ?? "legacy").usePagePlan(
		model,
		design,
	);
}
