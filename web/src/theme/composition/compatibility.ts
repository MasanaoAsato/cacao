import { MODULE_CAPABILITIES } from "../../booklet/program/moduleCapabilities";
import { programIssues } from "../../booklet/program/validateProgram";
import { STYLE_BUNDLES } from "../directions/styleBundles";
import type { DirectionDefinition } from "../directions/types";
import { bindingCandidates, paperColorFor, sectionsOf } from "./baseline";
import { applyContribution } from "./contributions";
import {
	type ArtworkPresence,
	draftScenes,
	effectiveDirectionIds,
	type ProgramMeta,
	toProgram,
} from "./emitProgram";
import {
	type AppliedContribution,
	type CompileContext,
	type CompileFailureCode,
	type CompositionCatalog,
	type CompositionScope,
	type DirectionContribution,
	type DraftScene,
	type DraftState,
	OPERATION_KINDS,
	REGION_ORDER,
	type RegionId,
	type ResourceKey,
	type ScopeKind,
} from "./types";

/** Equal, ancestor or descendant keys write the same resource. */
export function keysConflict(a: ResourceKey, b: ResourceKey): boolean {
	const length = Math.min(a.length, b.length);
	for (let index = 0; index < length; index += 1) {
		if (a[index] !== b[index]) return false;
	}
	return true;
}

export type CatalogFailure = {
	readonly code: CompileFailureCode;
	readonly message: string;
};

const SCOPE_KINDS: readonly ScopeKind[] = [
	"book",
	"scene",
	"unit-range",
	"region",
];

function contributionFailure(
	definition: DirectionDefinition,
	contribution: DirectionContribution,
): CatalogFailure | null {
	if (contribution.operations.length === 0)
		return {
			code: "invalid-catalog",
			message: `contribution「${contribution.id}」に操作がありません。`,
		};
	for (const operation of contribution.operations) {
		if (!OPERATION_KINDS.includes(operation.kind))
			return {
				code: "unknown-operation",
				message: `方向「${definition.id}」に未知の操作「${String(operation.kind)}」があります。`,
			};
	}
	if (
		contribution.targetScope.length === 0 ||
		contribution.targetScope.some((kind) => !SCOPE_KINDS.includes(kind))
	)
		return {
			code: "invalid-catalog",
			message: `contribution「${contribution.id}」のscopeが不正です。`,
		};
	if (
		contribution.requires.regions.some(
			(region) => !REGION_ORDER.includes(region),
		)
	)
		return {
			code: "invalid-catalog",
			message: `contribution「${contribution.id}」のregionが不正です。`,
		};
	return null;
}

/** Runs once per compile. A definition error is never hidden as an incompatible candidate. */
export function catalogFailure(
	catalog: CompositionCatalog,
): CatalogFailure | null {
	if (!catalog.revision.trim())
		return { code: "invalid-catalog", message: "カタログ版がありません。" };
	if (catalog.directions.length === 0)
		return { code: "empty-catalog", message: "方向が登録されていません。" };
	const seen = new Set<string>();
	for (const definition of catalog.directions) {
		if (seen.has(definition.id))
			return {
				code: "invalid-catalog",
				message: `方向「${definition.id}」が重複しています。`,
			};
		seen.add(definition.id);
		const baseline = definition.baseline();
		const module = MODULE_CAPABILITIES[baseline.module];
		const coverModule = MODULE_CAPABILITIES[baseline.coverModule];
		if (!module || !coverModule)
			return {
				code: "invalid-catalog",
				message: `方向「${definition.id}」のmoduleが未登録です。`,
			};
		if (coverModule.cover === null)
			return {
				code: "invalid-catalog",
				message: `方向「${definition.id}」のcover moduleは表紙を描けません。`,
			};
		if (!STYLE_BUNDLES[baseline.styleBundleId])
			return {
				code: "invalid-catalog",
				message: `方向「${definition.id}」の束が未登録です。`,
			};
		const contributionIds = new Set<string>();
		for (const contribution of definition.contributions) {
			if (contributionIds.has(contribution.id))
				return {
					code: "invalid-catalog",
					message: `contribution「${contribution.id}」が重複しています。`,
				};
			contributionIds.add(contribution.id);
			const failure = contributionFailure(definition, contribution);
			if (failure) return failure;
		}
	}
	return null;
}

function sceneById(state: DraftState, sceneId: string): DraftScene | null {
	return draftScenes(state).find((scene) => scene.sceneId === sceneId) ?? null;
}

function sceneHasRegion(scene: DraftScene, region: RegionId): boolean {
	const capability = MODULE_CAPABILITIES[scene.config.moduleId];
	if (scene.kind === "cover") {
		const cover = capability.cover;
		if (!cover) return false;
		if (region === "heading" || region === "image") return true;
		return region === "hero" && cover.heroSlot !== null;
	}
	if (scene.kind !== "day") return false;
	switch (region) {
		case "heading":
		case "body":
			return true;
		case "image":
			return capability.day.image !== null;
		case "hero":
			return (
				capability.day.heroSlot !== null || capability.day.splitHero !== null
			);
	}
}

function dayUnitCount(context: CompileContext, dayId: string): number {
	return context.model.days.find((day) => day.id === dayId)?.units.length ?? 0;
}

/**
 * `requires` of a contribution against the target module, regions and input
 * data. Unmet requirements only exclude the candidate.
 */
export function meetsRequirements(
	contribution: DirectionContribution,
	scope: CompositionScope,
	state: DraftState,
	context: CompileContext,
): boolean {
	const { requires } = contribution;
	const scene =
		scope.kind === "scene" || scope.kind === "region"
			? sceneById(state, scope.sceneId)
			: null;
	if (scene) {
		if (scene.kind !== "cover" && scene.kind !== "day") return false;
		if (!requires.sceneKinds.includes(scene.kind)) return false;
		if (requires.modules && !requires.modules.includes(scene.config.moduleId))
			return false;
		if (!requires.regions.every((region) => sceneHasRegion(scene, region)))
			return false;
	}
	const targetDayId =
		scope.kind === "unit-range"
			? scope.dayId
			: scene?.kind === "day"
				? scene.dayId
				: null;
	for (const need of requires.data) {
		switch (need) {
			case "day":
				if (context.model.days.length === 0) return false;
				break;
			case "units":
				if (targetDayId !== null) {
					if (dayUnitCount(context, targetDayId) === 0) return false;
				} else if (!context.model.days.some((day) => day.units.length > 0)) {
					return false;
				}
				break;
			case "image":
				if (scene?.kind === "day") {
					const day = context.model.days.find(
						(item) => item.id === scene.dayId,
					);
					if (!scene.showIllustration || !day?.illustration) return false;
				}
				break;
			case "multiple-time-sections":
				if (
					!context.model.days.some(
						(day) => sectionsOf(context, day.id).length >= 2,
					)
				)
					return false;
				break;
		}
	}
	return true;
}

/** book → scene order → region ID order; unit ranges are day-story sections only. */
export function enumerateScopes(
	contribution: DirectionContribution,
	state: DraftState,
	context: CompileContext,
): readonly CompositionScope[] {
	const kinds = new Set(contribution.targetScope);
	const scopes: CompositionScope[] = [];
	if (kinds.has("book")) scopes.push({ kind: "book" });
	for (const scene of draftScenes(state)) {
		if (scene.kind !== "cover" && scene.kind !== "day") continue;
		if (kinds.has("scene"))
			scopes.push({ kind: "scene", sceneId: scene.sceneId });
		if (kinds.has("unit-range") && scene.kind === "day") {
			const sections = sectionsOf(context, scene.dayId);
			const day = state.days.find((item) => item.dayId === scene.dayId);
			if (day?.segments.length === 1 && sections.length >= 2) {
				for (const section of sections)
					scopes.push({
						dayId: scene.dayId,
						kind: "unit-range",
						unitIds: section.unitIds,
					});
			}
		}
		if (kinds.has("region")) {
			for (const regionId of REGION_ORDER) {
				if (contribution.requires.regions.includes(regionId))
					scopes.push({ kind: "region", regionId, sceneId: scene.sceneId });
			}
		}
	}
	return scopes;
}

/** Before freezing, a binding shows artwork when a reviewed candidate exists. */
export function candidatePresence(context: CompileContext): ArtworkPresence {
	return (scene, binding) =>
		bindingCandidates(context.artwork, binding, paperColorFor(scene.config))
			.length > 0;
}

/**
 * A candidate passes when it meets `requires`, applies every operation,
 * writes no key an earlier contribution (or a protected baseline part) owns,
 * leaves every adopted direction a visible effect, and keeps coverage.
 */
export function evaluateCandidate(input: {
	readonly context: CompileContext;
	readonly contribution: DirectionContribution;
	readonly definition: DirectionDefinition;
	readonly meta: ProgramMeta;
	readonly scope: CompositionScope;
	readonly state: DraftState;
}): AppliedContribution | null {
	const { context, contribution, definition, scope, state } = input;
	if (!meetsRequirements(contribution, scope, state, context)) return null;
	const applied = applyContribution(
		state,
		definition,
		contribution,
		scope,
		context,
	);
	if (!applied) return null;
	if (
		applied.writes.some((key) =>
			state.writes.some((record) => keysConflict(record.key, key)),
		)
	)
		return null;
	const presence = candidatePresence(context);
	const effective = new Set(effectiveDirectionIds(applied.state, presence));
	if (!applied.state.adopted.every((id) => effective.has(id))) return null;
	const program = toProgram(applied.state, input.meta, () => null, presence);
	if (programIssues(program, context.model).length > 0) return null;
	return applied;
}
