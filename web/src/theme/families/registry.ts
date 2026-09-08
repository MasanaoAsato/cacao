import type { PolicyId } from "../../booklet/editorialModel";
import type { BookletFamilyId } from "../../booklet/family";
import type { MoodId } from "../types";

type LegacyFamilyDefinition = {
	readonly id: "legacy";
	readonly moodIds: readonly MoodId[];
	readonly policyId: "legacy-full";
};

export type VisualFamilyDefinition = {
	readonly compositionIds: readonly string[];
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
				definition.compositionIds.length === 0)
		) {
			throw new Error(
				`系統「${definition.id}」の配色または構図候補がありません。`,
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
	moodIds: ALL_MOODS,
	policyId: "legacy-full",
};

export const BOOKLET_FAMILY_REGISTRY = createFamilyRegistry([LEGACY_FAMILY]);

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
