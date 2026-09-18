import type { BookletFamilyId } from "./family";

export type FamilyPageKind = "cover" | "itinerary";

export type FamilyPageSection = {
	readonly columnUnitIds: readonly (readonly string[])[];
	readonly continuation: boolean;
	readonly dayId: string;
};

/**
 * A page plan owned by a non-legacy family. The legacy plan is intentionally
 * represented by BookletRenderPagePlan instead of being coerced into this shape.
 */
export type FamilyPagePlan = {
	readonly compositionId: string;
	readonly familyId: Exclude<BookletFamilyId, "legacy">;
	readonly kind: FamilyPageKind;
	readonly pageId: string;
	readonly sections: readonly FamilyPageSection[];
};
