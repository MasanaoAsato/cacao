import type { SeasonalMotif } from "../../booklet/program/deriveFacts";
import {
	type ArtworkSlotSpec,
	MODULE_CAPABILITIES,
} from "../../booklet/program/moduleCapabilities";
import { type ArtworkAsset, canonicalArtworkTouchId } from "../artwork/types";
import { LOCALE_PACKS, type LocalePackId } from "../directions/localePacks";
import { STYLE_BUNDLES } from "../directions/styleBundles";
import type { DirectionDefinition } from "../directions/types";
import {
	baselinePool,
	bindingCandidates,
	HERO_SUBJECT_IDS,
	LOCALE_SUBJECT_IDS,
	MEDIUM_SUBJECT_IDS,
} from "./baseline";
import type { DraftBinding } from "./types";

const SEASONS: readonly SeasonalMotif[] = [
	"spring",
	"summer",
	"autumn",
	"winter",
];

/**
 * Every binding a baseline slot can ask for, over all inputs: each season
 * view and each locale pack the direction is eligible for.
 */
function possibleBindings(
	definition: DirectionDefinition,
	slot: ArtworkSlotSpec,
): readonly DraftBinding[] {
	const touchId = canonicalArtworkTouchId(definition.baseline().touch);
	if (!touchId) return [];
	const common = {
		directionId: definition.id,
		heightMm: slot.heightMm,
		required: true,
		slotId: slot.slotId,
		touchId,
		widthMm: slot.widthMm,
	};
	const pool = baselinePool(definition.id, slot);
	switch (pool.kind) {
		case "hero-subjects":
			return [
				{ ...common, role: "hero", subjectIds: HERO_SUBJECT_IDS, viewId: null },
			];
		case "medium-subjects":
			return [
				{
					...common,
					role: "medium",
					subjectIds: MEDIUM_SUBJECT_IDS,
					viewId: null,
				},
			];
		case "locale-subject": {
			const packIds: readonly string[] =
				definition.eligibility.kind === "locale-pack"
					? definition.eligibility.localePackIds
					: LOCALE_PACKS.map((pack) => pack.id);
			return LOCALE_PACKS.filter((pack) => packIds.includes(pack.id)).map(
				(pack) => ({
					...common,
					role: "hero" as const,
					subjectIds: [LOCALE_SUBJECT_IDS[pack.id as LocalePackId]],
					viewId: null,
				}),
			);
		}
		case "season-view":
			return SEASONS.map((season) => ({
				...common,
				role: "season-pattern" as const,
				subjectIds: ["season-pattern"],
				viewId: season,
			}));
	}
}

/**
 * A direction is active only when every required baseline slot has reviewed
 * artwork for every input it can meet (25.5: a direction depending on draft
 * artwork is never active). It uses the compiler's own candidate rule, so an
 * active direction cannot fail with `artwork-unavailable`.
 */
export function isDirectionArtworkReady(
	definition: DirectionDefinition,
	artwork: readonly ArtworkAsset[],
): boolean {
	const baseline = definition.baseline();
	const paper = STYLE_BUNDLES[baseline.styleBundleId].paperColor;
	const slots = [
		MODULE_CAPABILITIES[baseline.coverModule].cover?.heroSlot ?? null,
		MODULE_CAPABILITIES[baseline.module].day.heroSlot,
	].filter((slot) => slot !== null);
	return slots.every((slot) =>
		possibleBindings(definition, slot).every(
			(binding) => bindingCandidates(artwork, binding, paper).length > 0,
		),
	);
}

/** The registered directions that reviewed artwork can draw, in publication order. */
export function activeDirectionDefinitions(
	registered: readonly DirectionDefinition[],
	artwork: readonly ArtworkAsset[],
): readonly DirectionDefinition[] {
	return Object.freeze(
		registered.filter((definition) =>
			isDirectionArtworkReady(definition, artwork),
		),
	);
}
