import type { PolicyId } from "../../booklet/editorialModel";
import type { BookletFamilyId } from "../../booklet/family";
import type { MotifAssetId } from "../motifAssets";
import type { MoodId } from "../types";
import { ATLAS_GRID_FAMILY } from "./atlasGrid";
import { PAPER_COLLAGE_FAMILY } from "./paperCollage";

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
				definition.decorAssetIds.length === 0 ||
				definition.fontFamilies.length === 0)
		) {
			throw new Error(
				`系統「${definition.id}」の配色・構図・素材・書体が不足しています。`,
			);
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
			![ATLAS_GRID_FAMILY, PAPER_COLLAGE_FAMILY].some((family) =>
				family.moodIds.some((familyMoodId) => familyMoodId === moodId),
			),
	),
	policyId: "legacy-full",
};

export const BOOKLET_FAMILY_REGISTRY = createFamilyRegistry([
	LEGACY_FAMILY,
	ATLAS_GRID_FAMILY,
	PAPER_COLLAGE_FAMILY,
]);

export const REGISTERED_BOOKLET_FAMILY_IDS = Object.freeze([
	...new Set(
		Array.from(BOOKLET_FAMILY_REGISTRY.values(), (definition) => definition.id),
	),
]);

export function familyDefinitionFor(moodId: MoodId): BookletFamilyDefinition {
	const definition = BOOKLET_FAMILY_REGISTRY.get(moodId);
	if (!definition) {
		throw new Error(`mood「${moodId}」の系統が登録されていません。`);
	}
	return definition;
}
