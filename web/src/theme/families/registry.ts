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

type LegacyFamilyDefinition = {
	readonly id: "legacy";
	readonly moodIds: readonly MoodId[];
	readonly policyId: "legacy-full";
};

export type VisualFamilyDefinition = {
	readonly compositionIds: readonly string[];
	readonly decorAssetIds: readonly MotifAssetId[];
	readonly fontFamilies: readonly string[];
	readonly id: Exclude<BookletFamilyId, "legacy">;
	readonly moodIds: readonly MoodId[];
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

export function createFamilyRegistry(
	definitions: readonly BookletFamilyDefinition[],
): ReadonlyMap<MoodId, BookletFamilyDefinition> {
	const byMood = new Map<MoodId, BookletFamilyDefinition>();
	for (const definition of definitions) {
		if (definition.moodIds.length === 0) {
			throw new Error(`系統「${definition.id}」にmoodがありません。`);
		}
		if (
			definition.id !== "legacy" &&
			(definition.paletteIds.length === 0 ||
				definition.compositionIds.length === 0 ||
				definition.fontFamilies.length === 0 ||
				definition.styleProfiles.length === 0)
		) {
			throw new Error(
				`系統「${definition.id}」の配色・構図・素材・書体が不足しています。`,
			);
		}
		if (definition.id !== "legacy") {
			const profileIds = new Set<string>();
			for (const profile of definition.styleProfiles) {
				if (profile.familyId !== definition.id || profileIds.has(profile.id)) {
					throw new Error(
						`系統「${definition.id}」の作風プロファイル定義が不正です。`,
					);
				}
				if (
					profile.compositionIds.length === 0 ||
					(profile.decorMode === "motif" &&
						profile.decorAssetIds.length === 0) ||
					(profile.decorMode === "css" && profile.decorAssetIds.length !== 0)
				) {
					throw new Error(
						`系統「${definition.id}」の作風プロファイルの構図または装飾が不正です。`,
					);
				}
				profileIds.add(profile.id);
			}
		}
		for (const moodId of definition.moodIds) {
			if (byMood.has(moodId)) {
				throw new Error(`mood「${moodId}」に複数の系統が登録されています。`);
			}
			byMood.set(moodId, definition);
		}
	}
	for (const moodId of ALL_MOODS) {
		if (!byMood.has(moodId)) {
			throw new Error(`mood「${moodId}」の系統が登録されていません。`);
		}
	}
	return byMood;
}

const LEGACY_FAMILY: LegacyFamilyDefinition = {
	id: "legacy",
	moodIds: ALL_MOODS.filter(
		(moodId) =>
			![ATLAS_GRID_FAMILY, PAPER_COLLAGE_FAMILY, PLAYFUL_ROUTE_FAMILY].some(
				(family) =>
					family.moodIds.some((familyMoodId) => familyMoodId === moodId),
			),
	),
	policyId: "legacy-full",
};

export const BOOKLET_FAMILY_REGISTRY = createFamilyRegistry([
	...(LEGACY_FAMILY.moodIds.length === 0 ? [] : [LEGACY_FAMILY]),
	ATLAS_GRID_FAMILY,
	PAPER_COLLAGE_FAMILY,
	PLAYFUL_ROUTE_FAMILY,
]);

/** ID catalog used by family adapters; mood lookup remains compatible with 21.2. */
export const BOOKLET_FAMILY_CATALOG: ReadonlyMap<
	BookletFamilyId,
	BookletFamilyDefinition
> = new Map([
	...Array.from(
		BOOKLET_FAMILY_REGISTRY.values(),
		(definition) => [definition.id, definition] as const,
	),
	[EDITORIAL_MAGAZINE_FAMILY.id, EDITORIAL_MAGAZINE_FAMILY],
	[TRAVEL_NEWSPAPER_FAMILY.id, TRAVEL_NEWSPAPER_FAMILY],
]);

export const REGISTERED_BOOKLET_FAMILY_IDS = Object.freeze([
	...new Set(Array.from(BOOKLET_FAMILY_CATALOG.keys())),
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

export function familyDefinitionFor(moodId: MoodId): BookletFamilyDefinition {
	const definition = BOOKLET_FAMILY_REGISTRY.get(moodId);
	if (!definition) {
		throw new Error(`mood「${moodId}」の系統が登録されていません。`);
	}
	return definition;
}
