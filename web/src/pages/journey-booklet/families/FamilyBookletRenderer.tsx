import type { BookletModel } from "../../../booklet/model";
import { familyAdapterFor } from "./registry";
import type { FamilyPagePlanResult } from "./useFamilyPagePlan";

type FamilyBookletRendererProps = {
	readonly model: BookletModel;
	readonly pagePlanResult: FamilyPagePlanResult;
};

export function FamilyBookletRenderer({
	model,
	pagePlanResult,
}: FamilyBookletRendererProps) {
	const design = pagePlanResult.design;
	if (!design) {
		return null;
	}
	const Renderer = familyAdapterFor(design.familyId).renderer;
	return <Renderer model={model} pagePlanResult={pagePlanResult} />;
}
