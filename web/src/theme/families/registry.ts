import type { PolicyId } from "../../booklet/editorialModel";
import type { BookletFamilyId } from "../../booklet/family";
import type { MotifAssetId } from "../motifAssets";
import type { MoodId } from "../types";
import { ATLAS_GRID_FAMILY } from "./atlasGrid";
import { EDITORIAL_MAGAZINE_FAMILY } from "./editorialMagazine";
import { PAPER_COLLAGE_FAMILY } from "./paperCollage";
import { PLAYFUL_ROUTE_FAMILY } from "./playfulRoute";
import type { BookletStyleProfile } from "./styleProfiles";
import { TRAVEL_NEWSPAPER_FAMILY } from "./travelNewspaper";

/** Fixed order of selectable visual families for booklet generation. */
export const ACTIVE_BOOKLET_FAMILY_IDS = [
	"atlas-grid",
	"paper-collage",
	"playful-route",
	"editorial-magazine",
	"travel-newspaper",
] as const satisfies readonly Exclude<BookletFamilyId, "legacy">[];

type LegacyFamilyDefinition = {
	readonly id: "legacy";
	readonly moodIds?: readonly MoodId[];
	readonly policyId: "legacy-full";
};

export type VisualFamilyDefinition = {
	readonly compositionIds: readonly string[];
	readonly decorAssetIds: readonly MotifAssetId[];
	readonly fontFamilies: readonly string[];
	readonly id: Exclude<BookletFamilyId, "legacy">;
	/** Optional v2 metadata; family selection never reads mood IDs. */
	readonly moodIds?: readonly MoodId[];
	readonly paletteIds: readonly string[];
	readonly policyId: PolicyId;
	readonly styleProfiles: readonly BookletStyleProfile[];
};

export type BookletFamilyDefinition =
	| LegacyFamilyDefinition
	| VisualFamilyDefinition;

const ALL_MOODS: readonly MoodId[] = [
	"field-notes",
	"wayfinder",
	"postcard",
	"night-train",
	"quiet-gallery",
	"festival-ticket",
];

function validateDefinition(definition: BookletFamilyDefinition): void {
	if (definition.id === "legacy") {
		return;
	}
	if (
		definition.paletteIds.length === 0 ||
		definition.compositionIds.length === 0 ||
		definition.fontFamilies.length === 0 ||
		definition.styleProfiles.length === 0
	) {
		throw new Error(
			`系統「${definition.id}」の配色・構図・素材・書体が不足しています。`,
		);
	}
	const profileIds = new Set<string>();
	for (const profile of definition.styleProfiles) {
		if (profile.familyId !== definition.id || profileIds.has(profile.id)) {
			throw new Error(
				`系統「${definition.id}」の作風プロファイル定義が不正です。`,
			);
		}
		if (
			profile.compositionIds.length === 0 ||
			(profile.decorMode === "motif" && profile.decorAssetIds.length === 0) ||
			(profile.decorMode === "css" && profile.decorAssetIds.length !== 0)
		) {
			throw new Error(
				`系統「${definition.id}」の作風プロファイルの構図または装飾が不正です。`,
			);
		}
		profileIds.add(profile.id);
	}
}

/** Build an ID-keyed catalog; mood metadata is validated but never a key. */
export function createFamilyRegistry(
	definitions: readonly BookletFamilyDefinition[],
): ReadonlyMap<BookletFamilyId, BookletFamilyDefinition> {
	const byId = new Map<BookletFamilyId, BookletFamilyDefinition>();
	for (const definition of definitions) {
		if (byId.has(definition.id)) {
			throw new Error(`系統「${definition.id}」が重複しています。`);
		}
		validateDefinition(definition);
		byId.set(definition.id, definition);
	}
	return byId;
}

const LEGACY_FAMILY: LegacyFamilyDefinition = {
	id: "legacy",
	moodIds: ALL_MOODS.filter(
		(moodId) =>
			![ATLAS_GRID_FAMILY, PAPER_COLLAGE_FAMILY, PLAYFUL_ROUTE_FAMILY].some(
				(family) =>
					family.moodIds?.some((familyMoodId) => familyMoodId === moodId),
			),
	),
	policyId: "legacy-full",
};

/** Legacy is registered for compatibility but excluded from active IDs. */
export const BOOKLET_FAMILY_REGISTRY = createFamilyRegistry([
	LEGACY_FAMILY,
	ATLAS_GRID_FAMILY,
	PAPER_COLLAGE_FAMILY,
	PLAYFUL_ROUTE_FAMILY,
	EDITORIAL_MAGAZINE_FAMILY,
	TRAVEL_NEWSPAPER_FAMILY,
]);

export const BOOKLET_FAMILY_CATALOG: ReadonlyMap<
	BookletFamilyId,
	BookletFamilyDefinition
> = BOOKLET_FAMILY_REGISTRY;

export const REGISTERED_BOOKLET_FAMILY_IDS = Object.freeze([
	...BOOKLET_FAMILY_CATALOG.keys(),
]);

export function familyDefinitionById(
	familyId: BookletFamilyId,
): BookletFamilyDefinition {
	const definition = BOOKLET_FAMILY_CATALOG.get(familyId);
	if (!definition) {
		throw new Error(`系統「${familyId}」が登録されていません。`);
	}
	return definition;
}
