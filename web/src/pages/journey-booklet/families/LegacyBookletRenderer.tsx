import type {
	BookletRenderPagePlan,
	ResolvedBookletDesign,
} from "../../../booklet/family";
import type { BookletModel } from "../../../booklet/model";
import { BookletDocument, BookletMeasurement } from "../BookletDocument";
import { useBookletPagePlan } from "../useBookletPagePlan";
import type { FamilyPagePlanResult } from "./useFamilyPagePlan";

type LegacyBookletRendererProps = {
	readonly model: BookletModel;
	readonly pagePlanResult: FamilyPagePlanResult;
};

/** Owns legacy measurement, pagination, and document-fit validation. */
export function useLegacyFamilyPagePlan(
	model: BookletModel | null,
	design: ResolvedBookletDesign | null,
): FamilyPagePlanResult {
	const legacyResult = useBookletPagePlan(
		model,
		design?.familyId === "legacy" ? design.requestedTheme : null,
		design?.familyId === "legacy" ? design.renderKey : null,
		design?.familyId === "legacy" ? design.decorAssetIds : [],
	);
	const renderPagePlan: BookletRenderPagePlan | null =
		design?.familyId === "legacy" && legacyResult.pagePlan
			? { familyId: "legacy", pagePlan: legacyResult.pagePlan }
			: null;

	return { ...legacyResult, design, renderPagePlan };
}

/** Preserves the existing DOM, CSS, pagination, and fallback behavior. */
export function LegacyBookletRenderer({
	model,
	pagePlanResult,
}: LegacyBookletRendererProps) {
	const {
		activeTheme,
		coverVeilBounds,
		design,
		documentRef,
		measurementRef,
		renderPagePlan,
	} = pagePlanResult;
	if (design?.familyId !== "legacy") {
		return null;
	}

	return (
		<>
			{activeTheme ? (
				<BookletMeasurement
					familyId={design.familyId}
					model={model}
					rootRef={measurementRef}
					theme={activeTheme}
				/>
			) : null}
			{renderPagePlan && activeTheme && coverVeilBounds ? (
				<BookletDocument
					coverVeilBounds={coverVeilBounds}
					familyId={design.familyId}
					model={model}
					pagePlan={renderPagePlan.pagePlan}
					rootRef={documentRef}
					theme={activeTheme}
				/>
			) : null}
		</>
	);
}
