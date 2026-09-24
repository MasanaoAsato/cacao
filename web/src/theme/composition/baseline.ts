import type { BookletDay } from "../../booklet/model";
import type {
	SeasonalMotif,
	TimeOfDay,
} from "../../booklet/program/deriveFacts";
import type { HeadingOrientation } from "../../booklet/program/model";
import {
	type ArtworkSlotSpec,
	MODULE_CAPABILITIES,
} from "../../booklet/program/moduleCapabilities";
import { eligibleArtworkForSlot } from "../artwork/selectArtwork";
import {
	type ArtworkAsset,
	type ArtworkTouchId,
	canonicalArtworkTouchId,
} from "../artwork/types";
import type { LocalePackId } from "../directions/localePacks";
import { STYLE_BUNDLES } from "../directions/styleBundles";
import type {
	DirectionDefinition,
	DirectionId,
	DirectionModuleId,
} from "../directions/types";
import type {
	CompileContext,
	DraftBinding,
	DraftDay,
	DraftDayScene,
	DraftSceneConfig,
	DraftState,
	HeroSubjectPool,
	WriteRecord,
} from "./types";

/** 25.2 subjects. The compiler selects among them and never draws artwork. */
export const HERO_SUBJECT_IDS: readonly string[] = [
	"mountain",
	"sea",
	"street",
	"machiya-grid",
	"urban-window-railway",
	"roof-arch",
];

export const MEDIUM_SUBJECT_IDS: readonly string[] = [
	"train",
	"airplane",
	"car",
	"bag",
	"tableware",
	"leaf",
	"flower",
	"shell",
];

/** A locale motif only uses the one fixed principal subject of its pack. */
export const LOCALE_SUBJECT_IDS: Readonly<Record<LocalePackId, string>> = {
	kyoto: "machiya-grid",
	paris: "roof-arch",
	tokyo: "urban-window-railway",
};

const ARTWORK_CLEARANCE_MM = 1;

export function dayScenePrefix(dayId: string): string {
	return `day:${dayId}`;
}

/** Scene IDs come from the day ID and the first unit of a split, never from randomness. */
export function daySceneId(
	day: BookletDay,
	unitIds: readonly string[],
): string {
	const first = unitIds[0];
	return first === undefined || first === day.units[0]?.id
		? dayScenePrefix(day.id)
		: `${dayScenePrefix(day.id)}:${first}`;
}

export function seasonForDay(
	context: CompileContext,
	dayId: string | null,
): SeasonalMotif | null {
	const index =
		dayId === null
			? 0
			: context.model.days.findIndex((day) => day.id === dayId);
	return context.facts.days[index]?.season ?? null;
}

/**
 * Resolves which artwork a slot may hold. Returns null when the pool does not
 * exist for this input (for example a locale motif without a locale pack).
 */
export function bindingForPool(input: {
	readonly context: CompileContext;
	readonly dayId: string | null;
	readonly directionId: DirectionId;
	readonly pool: HeroSubjectPool | { readonly kind: "medium-subjects" };
	readonly required: boolean;
	readonly slot: ArtworkSlotSpec;
	readonly touchId: ArtworkTouchId;
}): DraftBinding | null {
	const common = {
		directionId: input.directionId,
		heightMm: input.slot.heightMm,
		required: input.required,
		slotId: input.slot.slotId,
		touchId: input.touchId,
		widthMm: input.slot.widthMm,
	};
	switch (input.pool.kind) {
		case "hero-subjects":
			return {
				...common,
				role: "hero",
				subjectIds: HERO_SUBJECT_IDS,
				viewId: null,
			};
		case "medium-subjects":
			return {
				...common,
				role: "medium",
				subjectIds: MEDIUM_SUBJECT_IDS,
				viewId: null,
			};
		case "locale-subject": {
			const pack = input.context.localePack;
			if (!pack) return null;
			return {
				...common,
				role: "hero",
				subjectIds: [LOCALE_SUBJECT_IDS[pack.id]],
				viewId: null,
			};
		}
		case "season-view": {
			const season = seasonForDay(input.context, input.dayId);
			if (!season) return null;
			return {
				...common,
				role: "season-pattern",
				subjectIds: ["season-pattern"],
				viewId: season,
			};
		}
	}
}

const candidateCache = new WeakMap<
	readonly ArtworkAsset[],
	Map<string, readonly ArtworkAsset[]>
>();

/** Reviewed artwork that fits this binding, in catalog order. */
export function bindingCandidates(
	artwork: readonly ArtworkAsset[],
	binding: DraftBinding,
	backgroundColor: string,
): readonly ArtworkAsset[] {
	const key = JSON.stringify([
		binding.role,
		binding.touchId,
		binding.subjectIds,
		binding.viewId,
		binding.widthMm,
		binding.heightMm,
		backgroundColor,
	]);
	let cache = candidateCache.get(artwork);
	if (!cache) {
		cache = new Map();
		candidateCache.set(artwork, cache);
	}
	const cached = cache.get(key);
	if (cached) return cached;
	const result = findBindingCandidates(artwork, binding, backgroundColor);
	cache.set(key, result);
	return result;
}

function findBindingCandidates(
	artwork: readonly ArtworkAsset[],
	binding: DraftBinding,
	backgroundColor: string,
): readonly ArtworkAsset[] {
	const subjects = new Set(binding.subjectIds);
	return eligibleArtworkForSlot(
		artwork.filter((asset) => subjects.has(asset.subjectId)),
		{
			allowMask: true,
			aspect: binding.widthMm / binding.heightMm,
			backgroundColor,
			heightMm: binding.heightMm,
			id: binding.slotId,
			minClearanceMm: ARTWORK_CLEARANCE_MM,
			required: binding.required,
			role: binding.role,
			touchIds: [binding.touchId],
			viewId: binding.viewId ?? undefined,
			widthMm: binding.widthMm,
		},
	).map((selection) => selection.artwork);
}

export function paperColorFor(config: DraftSceneConfig): string {
	return STYLE_BUNDLES[config.surface.styleBundleId].paperColor;
}

function baselinePool(
	id: DirectionId,
	slot: ArtworkSlotSpec,
): HeroSubjectPool | { readonly kind: "medium-subjects" } {
	if (id === "local-motif") return { kind: "locale-subject" };
	// A cover hero slot is wider than a season view may print, so the cover keeps a principal subject.
	if (id === "season" && slot.baselineRole === "medium")
		return { kind: "season-view" };
	return slot.baselineRole === "hero"
		? { kind: "hero-subjects" }
		: { kind: "medium-subjects" };
}

type SceneTarget =
	| { readonly kind: "cover" }
	| {
			readonly day: BookletDay;
			readonly kind: "day";
			readonly showIllustration: boolean;
	  };

/**
 * The direction's own look for one scene of `moduleId`: composition, surface
 * bundle, heading, image treatment, module-internal features and art slots.
 * Participation and sequence scenes are placed by the book builder, not here.
 */
export function baselineSceneConfig(
	definition: DirectionDefinition,
	moduleId: DirectionModuleId,
	target: SceneTarget,
	context: CompileContext,
): DraftSceneConfig | null {
	const baseline = definition.baseline();
	const capability = MODULE_CAPABILITIES[moduleId];
	const cover = capability.cover;
	if (target.kind === "cover" && cover === null) return null;
	const orientation: HeadingOrientation =
		target.kind === "cover" && cover
			? cover.titleOrientation
			: capability.day.headingOrientation;
	const imageRegion =
		target.kind === "cover" ? (cover?.image ?? null) : capability.day.image;
	const showsImage =
		target.kind === "cover" ||
		(target.showIllustration && target.day.illustration !== null);
	const treatment = baseline.config.imageTreatment;
	const slot =
		target.kind === "cover"
			? (cover?.heroSlot ?? null)
			: capability.day.heroSlot;
	const touchId = canonicalArtworkTouchId(baseline.touch);
	const bindings: DraftBinding[] = [];
	if (slot && touchId) {
		const binding = bindingForPool({
			context,
			dayId: target.kind === "day" ? target.day.id : null,
			directionId: definition.id,
			pool: baselinePool(definition.id, slot),
			required: true,
			slot,
			touchId,
		});
		if (!binding) return null;
		bindings.push(binding);
	}
	return {
		bindings,
		chapterStyled: false,
		compositionId: capability.standardCompositionId,
		contentStructure: null,
		dayHeader: baseline.config.dayHeader ?? null,
		heading: {
			directionId: definition.id,
			orientation,
			styleBundleId: baseline.styleBundleId,
			system: null,
		},
		heroSplit: false,
		imageTreatment:
			treatment &&
			showsImage &&
			imageRegion &&
			imageRegion.widthMm >= 40 &&
			imageRegion.heightMm >= 30
				? { directionId: definition.id, treatment }
				: null,
		ledgerHeading: baseline.config.ledgerHeading ?? null,
		minimalDecoration: baseline.config.minimalDecoration ?? false,
		moduleId,
		numberedEntries: baseline.config.numberedEntries ?? false,
		ownerDirectionId: definition.id,
		participationLane: null,
		surface: {
			directionId: definition.id,
			localePackId:
				definition.id === "local-color"
					? (context.localePack?.id ?? null)
					: null,
			styleBundleId: baseline.styleBundleId,
			touch: baseline.touch,
		},
	};
}

/** Divider, memo and endcap pages: drawn by woodcut-folio extras in the direction's style. */
export function extrasConfig(
	definition: DirectionDefinition,
	compositionId: "divider" | "endcap" | "memo",
): DraftSceneConfig {
	const baseline = definition.baseline();
	return {
		bindings: [],
		chapterStyled: false,
		compositionId,
		contentStructure: null,
		dayHeader: null,
		heading: {
			directionId: definition.id,
			orientation: "horizontal",
			styleBundleId: baseline.styleBundleId,
			system: null,
		},
		heroSplit: false,
		imageTreatment: null,
		ledgerHeading: null,
		minimalDecoration: false,
		moduleId: "woodcut-folio",
		numberedEntries: false,
		ownerDirectionId: definition.id,
		participationLane: null,
		surface: {
			directionId: definition.id,
			localePackId: null,
			styleBundleId: baseline.styleBundleId,
			touch: baseline.touch,
		},
	};
}

export function requiredBindingsAvailable(
	config: DraftSceneConfig,
	context: CompileContext,
): boolean {
	return config.bindings.every(
		(binding) =>
			!binding.required ||
			bindingCandidates(context.artwork, binding, paperColorFor(config))
				.length > 0,
	);
}

export function chapterRoleFor(
	dayIndex: number,
	dayCount: number,
): "day" | "departure" | "return" {
	if (dayIndex === 0) return "departure";
	return dayIndex === dayCount - 1 ? "return" : "day";
}

/** Consecutive time-of-day groups; a split is only offered with two or more. */
export function sectionsOf(
	context: CompileContext,
	dayId: string,
): readonly {
	readonly timeOfDay: TimeOfDay;
	readonly unitIds: readonly string[];
}[] {
	const index = context.model.days.findIndex((day) => day.id === dayId);
	return (context.facts.days[index]?.timeSections ?? []).map((section) => ({
		timeOfDay: section.timeOfDay,
		unitIds: section.units.map((unit) => unit.id),
	}));
}

export function participationWrites(
	directionId: DirectionId,
	dayId: string,
	sceneKey: readonly string[],
): readonly WriteRecord[] {
	return [
		{ directionId, key: ["day", dayId, "participation"] },
		{ directionId, key: sceneKey },
	];
}

/**
 * The single-direction booklet. Every baseline must stand alone with a
 * cover, the full itinerary, continuation pages and empty days.
 */
export function buildBaselineState(
	definition: DirectionDefinition,
	context: CompileContext,
): DraftState | null {
	const baseline = definition.baseline();
	const coverConfig = baselineSceneConfig(
		definition,
		baseline.coverModule,
		{ kind: "cover" },
		context,
	);
	if (!coverConfig) return null;
	const writes: WriteRecord[] = [];
	const flow = baseline.config.storyFlow;
	const participation = baseline.config.participation;
	const days: DraftDay[] = [];
	const dayCount = context.model.days.length;
	for (const [dayIndex, day] of context.model.days.entries()) {
		const sections = sectionsOf(context, day.id);
		const groups =
			flow === "time-sections" && sections.length > 0
				? sections
				: [{ timeOfDay: null, unitIds: day.units.map((unit) => unit.id) }];
		const segments: DraftDayScene[] = [];
		for (const [index, group] of groups.entries()) {
			const showIllustration = index === 0;
			const config = baselineSceneConfig(
				definition,
				baseline.module,
				{ day, kind: "day", showIllustration },
				context,
			);
			if (!config) return null;
			const lane =
				participation &&
				(participation === "stamp" || participation === "checklist") &&
				MODULE_CAPABILITIES[config.moduleId].day.participationLanes.includes(
					participation,
				) &&
				group.unitIds.length > 0
					? { directionId: definition.id, lane: participation }
					: null;
			const sceneId = daySceneId(day, group.unitIds);
			segments.push({
				config: { ...config, participationLane: lane },
				dayId: day.id,
				kind: "day",
				sceneId,
				section:
					group.timeOfDay === null
						? null
						: { directionId: definition.id, timeOfDay: group.timeOfDay },
				showIllustration,
				unitIds: group.unitIds,
			});
			if (lane)
				writes.push(
					...participationWrites(definition.id, day.id, [
						"scene",
						sceneId,
						"body",
						"lane",
					]),
				);
		}
		const hasLane = segments.some(
			(segment) => segment.config.participationLane,
		);
		const needsUnits = participation !== "memory-album";
		const memo =
			participation && !hasLane && (!needsUnits || day.units.length > 0)
				? {
						config: extrasConfig(definition, "memo"),
						dayRef: day.id,
						directionId: definition.id,
						kind: "memo" as const,
						participation,
						sceneId: `memo:${day.id}`,
						unitRefs: day.units.map((unit) => unit.id),
					}
				: null;
		if (memo)
			writes.push(
				...participationWrites(definition.id, day.id, ["scene", memo.sceneId]),
			);
		const divider =
			flow === "chapters" || flow === "continuous-story"
				? {
						chapterRole: chapterRoleFor(dayIndex, dayCount),
						config: extrasConfig(definition, "divider"),
						dayRef: day.id,
						directionId: definition.id,
						kind: "divider" as const,
						sceneId: `divider:${day.id}`,
					}
				: null;
		if (divider)
			writes.push({
				directionId: definition.id,
				key: ["scene", divider.sceneId],
			});
		days.push({ dayId: day.id, divider, memo, segments });
	}
	if (flow === "chapters" || flow === "continuous-story")
		writes.push({ directionId: definition.id, key: ["book", "dividers"] });
	if (flow === "time-sections")
		writes.push({ directionId: definition.id, key: ["book", "day-split"] });
	const endcap =
		flow === "continuous-story"
			? {
					config: extrasConfig(definition, "endcap"),
					directionId: definition.id,
					kind: "endcap" as const,
					sceneId: "endcap",
				}
			: null;
	if (endcap) {
		writes.push({ directionId: definition.id, key: ["book", "endcap"] });
		writes.push({ directionId: definition.id, key: ["scene", endcap.sceneId] });
	}
	return {
		adopted: [definition.id],
		baseDirectionId: definition.id,
		cover: { config: coverConfig, kind: "cover", sceneId: "cover" },
		days,
		endcap,
		writes,
	};
}
