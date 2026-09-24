import type { BookletDay } from "../../booklet/model";
import type { TimeOfDay } from "../../booklet/program/deriveFacts";
import type {
	ContentStructureId,
	HeadingOrientation,
	HeadingSystemId,
	ImageTreatmentId,
	ParticipationId,
	ParticipationLaneId,
} from "../../booklet/program/model";
import {
	coversPrincipalArt,
	MODULE_CAPABILITIES,
	type RegionSize,
} from "../../booklet/program/moduleCapabilities";
import { canonicalArtworkTouchId } from "../artwork/types";
import type {
	DirectionBaseline,
	DirectionDefinition,
	DirectionId,
} from "../directions/types";
import {
	baselineSceneConfig,
	bindingCandidates,
	bindingForPool,
	chapterRoleFor,
	daySceneId,
	extrasConfig,
	paperColorFor,
	requiredBindingsAvailable,
	sectionsOf,
} from "./baseline";
import type {
	AppliedContribution,
	CompileContext,
	CompositionOperation,
	CompositionScope,
	DirectionContribution,
	DraftBinding,
	DraftDay,
	DraftDayScene,
	DraftSceneConfig,
	DraftState,
	HeroSubjectPool,
	RegionId,
	ResourceKey,
} from "./types";

/**
 * The standard exports of 25.3. Colors, fonts and touches are read from each
 * direction's own baseline instead of being copied into a second table.
 */
const HEADING_SYSTEMS: Partial<
	Record<
		DirectionId,
		{
			readonly orientation: HeadingOrientation;
			readonly system: HeadingSystemId;
		}
	>
> = {
	cafe: { orientation: "horizontal", system: "chalkboard" },
	flight: { orientation: "horizontal", system: "boarding-pass" },
	"japan-poster": { orientation: "vertical", system: "vertical-title" },
	literature: { orientation: "horizontal", system: "literary" },
	newspaper: { orientation: "horizontal", system: "masthead" },
	rail: { orientation: "horizontal", system: "station-sign" },
	"travel-note": { orientation: "horizontal", system: "note" },
};

/** woodcut-touch directions are added from the baseline touch. */
const HERO_ART_DIRECTIONS: ReadonlySet<DirectionId> = new Set<DirectionId>([
	"anime-background",
	"encyclopedia",
	"gourmet",
	"local-motif",
	"nordic",
	"onsen",
	"rpg",
]);

/**
 * Image treatments exported by directions whose baseline does not already
 * apply one (25.1 only puts film / polaroid / social / scrapbook in config).
 */
const EXPORT_ONLY_IMAGE_TREATMENTS: Partial<
	Record<DirectionId, ImageTreatmentId>
> = {
	"luxury-magazine": "gallery-margin",
	"photo-book": "caption-margin",
	youth: "sketch-note",
};

const CONTENT_STRUCTURES: Partial<Record<DirectionId, ContentStructureId>> = {
	"board-game": "board-squares",
	cards: "cards",
	"category-color": "category-bands",
	"data-book": "data-columns",
	"game-ui": "stage-panels",
	map: "concept-route",
	practical: "fixed-columns",
	timeline: "timeline",
	transit: "route-line",
};

/** screenprint-touch directions are added from the baseline touch. */
const SURFACE_ART_DIRECTIONS: ReadonlySet<DirectionId> = new Set<DirectionId>([
	"local-color",
	"pastel-pop",
	"retro-tourism",
	"season",
	"wa-modern",
]);

function heroPool(id: DirectionId): HeroSubjectPool {
	if (id === "local-motif") return { kind: "locale-subject" };
	if (id === "season") return { kind: "season-view" };
	return { kind: "hero-subjects" };
}

export function standardContributions(
	id: DirectionId,
	baseline: DirectionBaseline,
): readonly DirectionContribution[] {
	const contributions: DirectionContribution[] = [
		{
			id: `${id}:chapter-style`,
			operations: [{ kind: "chapter-style" }],
			requires: {
				data: ["day"],
				modules: null,
				regions: [],
				sceneKinds: ["day"],
			},
			targetScope: ["scene", "unit-range"],
			visibleEffect: "chapter",
		},
	];
	const touchId = canonicalArtworkTouchId(baseline.touch);

	const heading = HEADING_SYSTEMS[id];
	if (heading) {
		contributions.push({
			id: `${id}:heading-system`,
			operations: [
				{
					kind: "heading-system",
					orientation: heading.orientation,
					styleBundleId: baseline.styleBundleId,
					system: heading.system,
				},
			],
			requires: {
				data: [],
				// A vertical system is only offered to the module that draws vertical headings.
				modules:
					heading.orientation === "vertical" ? ["vertical-poster"] : null,
				regions: ["heading"],
				sceneKinds: ["cover", "day"],
			},
			targetScope: ["region"],
			visibleEffect: "heading",
		});
	}

	if (
		touchId &&
		(HERO_ART_DIRECTIONS.has(id) || baseline.touch === "woodcut")
	) {
		contributions.push({
			id: `${id}:hero-art`,
			operations: [{ kind: "hero-art", pool: heroPool(id), touchId }],
			requires: {
				data: [],
				modules: null,
				regions: ["hero"],
				sceneKinds: ["cover", "day"],
			},
			targetScope: ["region"],
			visibleEffect: "hero-art",
		});
	}

	const treatment =
		baseline.config.imageTreatment ?? EXPORT_ONLY_IMAGE_TREATMENTS[id];
	if (treatment) {
		contributions.push({
			id: `${id}:image-treatment`,
			operations: [{ kind: "image-treatment", treatment }],
			requires: {
				data: ["image"],
				modules: null,
				regions: ["image"],
				sceneKinds: ["cover", "day"],
			},
			targetScope: ["region"],
			visibleEffect: "image-treatment",
		});
	}

	const participation = baseline.config.participation;
	if (participation) {
		contributions.push({
			id: `${id}:participation`,
			operations: [{ kind: "participation", participation }],
			requires: {
				// A visit list, stamp or checkbox needs units; the album page does not.
				data: participation === "memory-album" ? ["day"] : ["day", "units"],
				modules: null,
				regions: [],
				sceneKinds: ["day"],
			},
			targetScope: ["book", "scene"],
			visibleEffect: "participation",
		});
	}

	const flow = baseline.config.storyFlow;
	if (flow) {
		contributions.push({
			id: `${id}:sequence`,
			operations: [{ flow, kind: "sequence" }],
			requires: {
				data:
					flow === "time-sections"
						? ["multiple-time-sections"]
						: flow === "chapters"
							? ["day"]
							: [],
				modules: null,
				regions: [],
				sceneKinds: [],
			},
			targetScope: ["book"],
			visibleEffect: "chapter",
		});
	}

	const structure = CONTENT_STRUCTURES[id];
	if (structure) {
		contributions.push({
			id: `${id}:content-structure`,
			operations: [
				{
					kind: "content-structure",
					sourceModuleId: baseline.module,
					structure,
				},
			],
			requires: {
				data: ["units"],
				modules: null,
				regions: ["body"],
				sceneKinds: ["day"],
			},
			targetScope: ["region"],
			visibleEffect: "body-structure",
		});
	}

	// Color alone never counts, so a touchless direction (local-color) has no surface art.
	if (
		touchId &&
		(SURFACE_ART_DIRECTIONS.has(id) || baseline.touch === "screenprint")
	) {
		const operations: CompositionOperation[] = [
			{ kind: "surface-bundle", styleBundleId: baseline.styleBundleId },
			{ kind: "hero-art", pool: heroPool(id), touchId },
		];
		contributions.push({
			id: `${id}:surface-art`,
			operations,
			requires: {
				data: [],
				modules: null,
				regions: ["hero"],
				sceneKinds: ["cover", "day"],
			},
			targetScope: ["scene"],
			visibleEffect: "hero-art",
		});
	}
	return contributions;
}

/* ---- Application: every operation is a typed, module-published transform ---- */

type Work = {
	readonly state: DraftState;
	readonly writes: readonly ResourceKey[];
};

type SceneLocation =
	| { readonly kind: "cover" }
	| {
			readonly dayIndex: number;
			readonly kind: "day";
			readonly segmentIndex: number;
	  };

function locate(state: DraftState, sceneId: string): SceneLocation | null {
	if (state.cover.sceneId === sceneId) return { kind: "cover" };
	for (const [dayIndex, day] of state.days.entries()) {
		const segmentIndex = day.segments.findIndex(
			(segment) => segment.sceneId === sceneId,
		);
		if (segmentIndex >= 0) return { dayIndex, kind: "day", segmentIndex };
	}
	return null;
}

function configAt(
	state: DraftState,
	location: SceneLocation,
): DraftSceneConfig {
	return location.kind === "cover"
		? state.cover.config
		: (state.days[location.dayIndex]?.segments[location.segmentIndex]?.config ??
				state.cover.config);
}

function withConfig(
	state: DraftState,
	location: SceneLocation,
	config: DraftSceneConfig,
): DraftState {
	if (location.kind === "cover")
		return { ...state, cover: { ...state.cover, config } };
	return withDay(state, location.dayIndex, (day) => ({
		...day,
		segments: day.segments.map((segment, index) =>
			index === location.segmentIndex ? { ...segment, config } : segment,
		),
	}));
}

function withDay(
	state: DraftState,
	dayIndex: number,
	update: (day: DraftDay) => DraftDay,
): DraftState {
	return {
		...state,
		days: state.days.map((day, index) =>
			index === dayIndex ? update(day) : day,
		),
	};
}

function sceneKey(sceneId: string, ...rest: string[]): ResourceKey {
	return ["scene", sceneId, ...rest];
}

function samePool(a: DraftBinding, b: DraftBinding): boolean {
	return (
		a.role === b.role &&
		a.touchId === b.touchId &&
		a.viewId === b.viewId &&
		a.subjectIds.length === b.subjectIds.length &&
		a.subjectIds.every((subject, index) => subject === b.subjectIds[index])
	);
}

/** What a reader can see; owners are excluded so identical looks compare equal. */
function lookSignature(config: DraftSceneConfig): string {
	return JSON.stringify([
		config.moduleId,
		config.compositionId,
		config.surface.styleBundleId,
		config.surface.touch,
		config.surface.localePackId,
		config.heading.system,
		config.heading.styleBundleId,
		config.imageTreatment?.treatment ?? null,
		config.contentStructure?.structure ?? null,
		config.dayHeader,
		config.ledgerHeading,
		config.minimalDecoration,
		config.numberedEntries,
		config.heroSplit,
		config.participationLane?.lane ?? null,
		config.bindings.map((binding) => [
			binding.slotId,
			binding.role,
			binding.touchId,
			binding.viewId,
			binding.subjectIds,
		]),
	]);
}

function modelDay(context: CompileContext, dayId: string) {
	return context.model.days.find((day) => day.id === dayId) ?? null;
}

/** A day split: pieces keep the original look except the image, which stays on the first. */
function splitPieces(
	context: CompileContext,
	original: DraftDayScene,
	groups: readonly {
		readonly timeOfDay: TimeOfDay;
		readonly unitIds: readonly string[];
	}[],
	piece: (index: number, base: DraftDayScene) => DraftDayScene | null,
): readonly DraftDayScene[] | null {
	const day = modelDay(context, original.dayId);
	if (!day) return null;
	const pieces: DraftDayScene[] = [];
	for (const [index, group] of groups.entries()) {
		const showIllustration = index === 0 && original.showIllustration;
		const base: DraftDayScene = {
			...original,
			config: showIllustration
				? original.config
				: { ...original.config, imageTreatment: null },
			sceneId: daySceneId(day, group.unitIds),
			section: null,
			showIllustration,
			unitIds: group.unitIds,
		};
		const next = piece(index, base);
		if (!next) return null;
		pieces.push(next);
	}
	return pieces;
}

function chapterConfig(
	definition: DirectionDefinition,
	day: BookletDay,
	showIllustration: boolean,
	context: CompileContext,
): DraftSceneConfig | null {
	const config = baselineSceneConfig(
		definition,
		definition.baseline().module,
		{ day, kind: "day", showIllustration },
		context,
	);
	if (!config || !requiredBindingsAvailable(config, context)) return null;
	return { ...config, chapterStyled: true };
}

function applyChapterStyle(
	work: Work,
	definition: DirectionDefinition,
	scope: CompositionScope,
	context: CompileContext,
): Work | null {
	if (scope.kind === "scene") {
		const location = locate(work.state, scope.sceneId);
		if (location?.kind !== "day") return null;
		const segment =
			work.state.days[location.dayIndex]?.segments[location.segmentIndex];
		const day = segment ? modelDay(context, segment.dayId) : null;
		if (!segment || !day) return null;
		const config = chapterConfig(
			definition,
			day,
			segment.showIllustration,
			context,
		);
		if (!config || lookSignature(config) === lookSignature(segment.config))
			return null;
		return {
			state: withConfig(work.state, location, config),
			writes: [...work.writes, sceneKey(segment.sceneId)],
		};
	}
	if (scope.kind !== "unit-range") return null;
	const dayIndex = work.state.days.findIndex(
		(day) => day.dayId === scope.dayId,
	);
	const draftDay = work.state.days[dayIndex];
	const day = modelDay(context, scope.dayId);
	const original = draftDay?.segments[0];
	if (!draftDay || !day || !original || draftDay.segments.length !== 1)
		return null;
	const sections = sectionsOf(context, scope.dayId);
	const target = sections.findIndex(
		(section) =>
			section.unitIds.length === scope.unitIds.length &&
			section.unitIds.every((id, index) => id === scope.unitIds[index]),
	);
	if (sections.length < 2 || target < 0) return null;
	const pieces = splitPieces(context, original, sections, (index, base) => {
		if (index !== target) return base;
		const config = chapterConfig(
			definition,
			day,
			base.showIllustration,
			context,
		);
		if (!config || lookSignature(config) === lookSignature(base.config))
			return null;
		return { ...base, config };
	});
	if (!pieces) return null;
	return {
		state: withDay(work.state, dayIndex, (current) => ({
			...current,
			segments: pieces,
		})),
		writes: [
			...work.writes,
			sceneKey(original.sceneId),
			...pieces.map((piece) => sceneKey(piece.sceneId)),
		],
	};
}

function targetSceneId(
	scope: CompositionScope,
	regionId: RegionId | null,
): string | null {
	if (scope.kind === "scene") return scope.sceneId;
	if (scope.kind === "region" && scope.regionId === regionId)
		return scope.sceneId;
	return null;
}

function applyHeading(
	work: Work,
	definition: DirectionDefinition,
	operation: Extract<CompositionOperation, { kind: "heading-system" }>,
	sceneId: string,
): Work | null {
	const location = locate(work.state, sceneId);
	if (!location) return null;
	const config = configAt(work.state, location);
	const capability = MODULE_CAPABILITIES[config.moduleId];
	const orientation =
		location.kind === "cover"
			? capability.cover?.titleOrientation
			: capability.day.headingOrientation;
	if (orientation !== operation.orientation) return null;
	if (config.heading.system === operation.system) return null;
	return {
		state: withConfig(work.state, location, {
			...config,
			heading: {
				directionId: definition.id,
				orientation: operation.orientation,
				styleBundleId: operation.styleBundleId,
				system: operation.system,
			},
		}),
		writes: [...work.writes, sceneKey(sceneId, "heading", "system")],
	};
}

function applyHeroArt(
	work: Work,
	definition: DirectionDefinition,
	operation: Extract<CompositionOperation, { kind: "hero-art" }>,
	sceneId: string,
	context: CompileContext,
): Work | null {
	const location = locate(work.state, sceneId);
	if (!location) return null;
	const config = configAt(work.state, location);
	const capability = MODULE_CAPABILITIES[config.moduleId];
	const nativeSlot =
		location.kind === "cover"
			? (capability.cover?.heroSlot ?? null)
			: capability.day.heroSlot;
	const split =
		!nativeSlot && location.kind === "day" ? capability.day.splitHero : null;
	const slot = nativeSlot ?? split?.slot ?? null;
	if (!slot || !coversPrincipalArt(slot)) return null;
	const segment =
		location.kind === "day"
			? work.state.days[location.dayIndex]?.segments[location.segmentIndex]
			: null;
	const binding = bindingForPool({
		context,
		dayId: segment?.dayId ?? null,
		directionId: definition.id,
		pool: operation.pool,
		required: true,
		slot,
		touchId: operation.touchId,
	});
	if (
		!binding ||
		bindingCandidates(context.artwork, binding, paperColorFor(config))
			.length === 0
	)
		return null;
	const existing = config.bindings.find((item) => item.slotId === slot.slotId);
	if (existing && samePool(existing, binding)) return null;
	const bindings = existing
		? config.bindings.map((item) =>
				item.slotId === slot.slotId ? binding : item,
			)
		: [...config.bindings, binding];
	const next: DraftSceneConfig = split
		? {
				...config,
				bindings,
				compositionId: split.compositionId,
				heroSplit: true,
			}
		: { ...config, bindings };
	return {
		state: withConfig(work.state, location, next),
		writes: [
			...work.writes,
			...(split ? [sceneKey(sceneId, "image", "composition")] : []),
			sceneKey(sceneId, "hero", "artwork"),
		],
	};
}

function applySurface(
	work: Work,
	definition: DirectionDefinition,
	operation: Extract<CompositionOperation, { kind: "surface-bundle" }>,
	sceneId: string,
): Work | null {
	const location = locate(work.state, sceneId);
	if (!location) return null;
	const config = configAt(work.state, location);
	return {
		state: withConfig(work.state, location, {
			...config,
			surface: {
				directionId: definition.id,
				localePackId: null,
				styleBundleId: operation.styleBundleId,
				touch: definition.baseline().touch,
			},
		}),
		writes: [...work.writes, sceneKey(sceneId, "surface")],
	};
}

function applyImageTreatment(
	work: Work,
	definition: DirectionDefinition,
	operation: Extract<CompositionOperation, { kind: "image-treatment" }>,
	sceneId: string,
	context: CompileContext,
): Work | null {
	const location = locate(work.state, sceneId);
	if (!location) return null;
	const config = configAt(work.state, location);
	const capability = MODULE_CAPABILITIES[config.moduleId];
	let region: RegionSize | null;
	if (location.kind === "cover") {
		region = capability.cover?.image ?? null;
	} else {
		const segment =
			work.state.days[location.dayIndex]?.segments[location.segmentIndex];
		const day = segment ? modelDay(context, segment.dayId) : null;
		if (!segment?.showIllustration || !day?.illustration) return null;
		region =
			config.heroSplit && capability.day.splitHero
				? capability.day.splitHero.image
				: capability.day.image;
	}
	if (!coversPrincipalArt(region)) return null;
	if (config.imageTreatment?.treatment === operation.treatment) return null;
	return {
		state: withConfig(work.state, location, {
			...config,
			imageTreatment: {
				directionId: definition.id,
				treatment: operation.treatment,
			},
		}),
		writes: [...work.writes, sceneKey(sceneId, "image", "treatment")],
	};
}

function laneFor(participation: ParticipationId): ParticipationLaneId | null {
	return participation === "stamp" || participation === "checklist"
		? participation
		: null;
}

function participateDay(
	work: Work,
	definition: DirectionDefinition,
	participation: ParticipationId,
	dayIndex: number,
	segmentIndexes: readonly number[] | "all",
	context: CompileContext,
): Work | null {
	const draftDay = work.state.days[dayIndex];
	const day = draftDay ? modelDay(context, draftDay.dayId) : null;
	if (!draftDay || !day || draftDay.memo) return null;
	if (participation !== "memory-album" && day.units.length === 0) return null;
	const lane = laneFor(participation);
	const targets =
		segmentIndexes === "all"
			? draftDay.segments.map((_, index) => index)
			: segmentIndexes;
	const laneTargets = targets.filter((index) => {
		const segment = draftDay.segments[index];
		return (
			lane !== null &&
			segment !== undefined &&
			segment.unitIds.length > 0 &&
			MODULE_CAPABILITIES[
				segment.config.moduleId
			].day.participationLanes.includes(lane)
		);
	});
	const allLanes =
		lane !== null &&
		laneTargets.length > 0 &&
		(segmentIndexes !== "all" ||
			laneTargets.length === draftDay.segments.length);
	const participationKey: ResourceKey = [
		"day",
		draftDay.dayId,
		"participation",
	];
	if (allLanes && lane) {
		return {
			state: withDay(work.state, dayIndex, (current) => ({
				...current,
				segments: current.segments.map((segment, index) =>
					laneTargets.includes(index)
						? {
								...segment,
								config: {
									...segment.config,
									participationLane: { directionId: definition.id, lane },
								},
							}
						: segment,
				),
			})),
			writes: [
				...work.writes,
				participationKey,
				...laneTargets.map((index) =>
					sceneKey(draftDay.segments[index]?.sceneId ?? "", "body", "lane"),
				),
			],
		};
	}
	// A memo sits after the day's last scene, so only that scene (or the book) targets it.
	const lastIndex = draftDay.segments.length - 1;
	if (segmentIndexes !== "all" && !segmentIndexes.includes(lastIndex))
		return null;
	const memoId = `memo:${draftDay.dayId}`;
	return {
		state: withDay(work.state, dayIndex, (current) => ({
			...current,
			memo: {
				config: extrasConfig(definition, "memo"),
				dayRef: current.dayId,
				directionId: definition.id,
				kind: "memo",
				participation,
				sceneId: memoId,
				unitRefs: day.units.map((unit) => unit.id),
			},
		})),
		writes: [...work.writes, participationKey, sceneKey(memoId)],
	};
}

function applyParticipation(
	work: Work,
	definition: DirectionDefinition,
	operation: Extract<CompositionOperation, { kind: "participation" }>,
	scope: CompositionScope,
	context: CompileContext,
): Work | null {
	if (scope.kind === "scene") {
		const location = locate(work.state, scope.sceneId);
		if (location?.kind !== "day") return null;
		return participateDay(
			work,
			definition,
			operation.participation,
			location.dayIndex,
			[location.segmentIndex],
			context,
		);
	}
	if (scope.kind !== "book") return null;
	let next = work;
	let changed = false;
	for (const dayIndex of work.state.days.keys()) {
		const result = participateDay(
			next,
			definition,
			operation.participation,
			dayIndex,
			"all",
			context,
		);
		if (result) {
			next = result;
			changed = true;
		}
	}
	return changed ? next : null;
}

function applySequence(
	work: Work,
	definition: DirectionDefinition,
	operation: Extract<CompositionOperation, { kind: "sequence" }>,
	context: CompileContext,
): Work | null {
	if (operation.flow === "time-sections") {
		let state = work.state;
		const writes: ResourceKey[] = [...work.writes, ["book", "day-split"]];
		for (const [dayIndex, draftDay] of work.state.days.entries()) {
			const original = draftDay.segments[0];
			const sections = sectionsOf(context, draftDay.dayId);
			if (draftDay.segments.length !== 1 || !original || sections.length < 2)
				continue;
			const pieces = splitPieces(context, original, sections, (index, base) => {
				const section = sections[index];
				return section
					? {
							...base,
							section: {
								directionId: definition.id,
								timeOfDay: section.timeOfDay,
							},
						}
					: null;
			});
			if (!pieces) return null;
			state = withDay(state, dayIndex, (current) => ({
				...current,
				segments: pieces,
			}));
			writes.push(
				sceneKey(original.sceneId),
				...pieces.map((piece) => sceneKey(piece.sceneId)),
			);
		}
		return state === work.state ? null : { state, writes };
	}
	const days = work.state.days;
	if (operation.flow === "chapters" && days.length === 0) return null;
	if (days.some((day) => day.divider)) return null;
	const writes: ResourceKey[] = [...work.writes];
	let state: DraftState = work.state;
	if (days.length > 0) {
		writes.push(["book", "dividers"]);
		state = {
			...state,
			days: days.map((day, index) => {
				const divider = {
					chapterRole: chapterRoleFor(index, days.length),
					config: extrasConfig(definition, "divider"),
					dayRef: day.dayId,
					directionId: definition.id,
					kind: "divider" as const,
					sceneId: `divider:${day.dayId}`,
				};
				writes.push(sceneKey(divider.sceneId));
				return { ...day, divider };
			}),
		};
	}
	if (operation.flow === "continuous-story") {
		if (state.endcap) return null;
		writes.push(["book", "endcap"], sceneKey("endcap"));
		state = {
			...state,
			endcap: {
				config: extrasConfig(definition, "endcap"),
				directionId: definition.id,
				kind: "endcap",
				sceneId: "endcap",
			},
		};
	}
	return { state, writes };
}

function applyContentStructure(
	work: Work,
	definition: DirectionDefinition,
	operation: Extract<CompositionOperation, { kind: "content-structure" }>,
	sceneId: string,
): Work | null {
	const location = locate(work.state, sceneId);
	if (location?.kind !== "day") return null;
	const segment =
		work.state.days[location.dayIndex]?.segments[location.segmentIndex];
	if (!segment || segment.unitIds.length === 0) return null;
	const config = segment.config;
	if (config.moduleId === operation.sourceModuleId) return null;
	if (config.contentStructure?.structure === operation.structure) return null;
	return {
		state: withConfig(work.state, location, {
			...config,
			contentStructure: {
				directionId: definition.id,
				sourceModuleId: operation.sourceModuleId,
				structure: operation.structure,
			},
		}),
		writes: [...work.writes, sceneKey(sceneId, "body")],
	};
}

function applyOperation(
	work: Work,
	definition: DirectionDefinition,
	operation: CompositionOperation,
	scope: CompositionScope,
	context: CompileContext,
): Work | null {
	switch (operation.kind) {
		case "chapter-style":
			return applyChapterStyle(work, definition, scope, context);
		case "heading-system": {
			const sceneId = targetSceneId(scope, "heading");
			return sceneId
				? applyHeading(work, definition, operation, sceneId)
				: null;
		}
		case "hero-art": {
			const sceneId = targetSceneId(scope, "hero");
			return sceneId
				? applyHeroArt(work, definition, operation, sceneId, context)
				: null;
		}
		case "surface-bundle":
			return scope.kind === "scene"
				? applySurface(work, definition, operation, scope.sceneId)
				: null;
		case "image-treatment": {
			const sceneId = targetSceneId(scope, "image");
			return sceneId
				? applyImageTreatment(work, definition, operation, sceneId, context)
				: null;
		}
		case "participation":
			return applyParticipation(work, definition, operation, scope, context);
		case "sequence":
			return scope.kind === "book"
				? applySequence(work, definition, operation, context)
				: null;
		case "content-structure": {
			const sceneId = targetSceneId(scope, "body");
			return sceneId
				? applyContentStructure(work, definition, operation, sceneId)
				: null;
		}
	}
}

/**
 * Applies every operation of one contribution atomically: either all apply
 * to `scope` or the contribution is not a candidate there.
 */
export function applyContribution(
	state: DraftState,
	definition: DirectionDefinition,
	contribution: DirectionContribution,
	scope: CompositionScope,
	context: CompileContext,
): AppliedContribution | null {
	let work: Work | null = { state, writes: [] };
	for (const operation of contribution.operations) {
		work = applyOperation(work, definition, operation, scope, context);
		if (!work) return null;
	}
	return {
		state: {
			...work.state,
			adopted: [...work.state.adopted, definition.id],
			writes: [
				...work.state.writes,
				...work.writes.map((key) => ({ directionId: definition.id, key })),
			],
		},
		writes: work.writes,
	};
}
