import type { ComponentType } from "react";
import type { BookletFamilyId } from "../../../booklet/family";
import { REGISTERED_BOOKLET_FAMILY_IDS } from "../../../theme/families/registry";
import {
	LegacyBookletRenderer,
	useLegacyFamilyPagePlan,
} from "./LegacyBookletRenderer";

export type BookletFamilyAdapter = {
	readonly familyId: BookletFamilyId;
	readonly renderer: ComponentType<{
		readonly model: import("../../../booklet/model").BookletModel;
		readonly pagePlanResult: import("./useFamilyPagePlan").FamilyPagePlanResult;
	}>;
	readonly usePagePlan: (
		model: import("../../../booklet/model").BookletModel | null,
		design: import("../../../booklet/family").ResolvedBookletDesign | null,
	) => import("./useFamilyPagePlan").FamilyPagePlanResult;
};

export function createFamilyAdapterRegistry(
	adapters: readonly BookletFamilyAdapter[],
	requiredFamilyIds: readonly BookletFamilyId[] = REGISTERED_BOOKLET_FAMILY_IDS,
): ReadonlyMap<BookletFamilyId, BookletFamilyAdapter> {
	const registry = new Map<BookletFamilyId, BookletFamilyAdapter>();
	for (const adapter of adapters) {
		if (registry.has(adapter.familyId)) {
			throw new Error(
				`系統「${adapter.familyId}」のアダプターが重複しています。`,
			);
		}
		registry.set(adapter.familyId, adapter);
	}
	for (const familyId of requiredFamilyIds) {
		if (!registry.has(familyId)) {
			throw new Error(`系統「${familyId}」のアダプターが登録されていません。`);
		}
	}
	return registry;
}

const FAMILY_ADAPTERS = createFamilyAdapterRegistry([
	{
		familyId: "legacy",
		renderer: LegacyBookletRenderer,
		usePagePlan: useLegacyFamilyPagePlan,
	},
]);

export function familyAdapterFor(
	familyId: BookletFamilyId,
): BookletFamilyAdapter {
	const adapter = FAMILY_ADAPTERS.get(familyId);
	if (!adapter) {
		throw new Error(`系統「${familyId}」のアダプターが登録されていません。`);
	}
	return adapter;
}
