import type { BookletModel } from "../../booklet/model";
import { deriveFacts } from "../../booklet/program/deriveFacts";
import { programIssues } from "../../booklet/program/validateProgram";
import { ARTWORK_CATALOG } from "../artwork/catalog";
import { localePackFor } from "../directions/localePacks";
import {
	ACTIVE_DIRECTION_DEFINITIONS,
	isDirectionEligible,
} from "../directions/registry";
import type { DirectionDefinition } from "../directions/types";
import { axisRandom, formatThemeSeed } from "../seed";
import type { RequestedBookletTheme } from "../types";
import {
	bindingCandidates,
	buildBaselineState,
	paperColorFor,
} from "./baseline";
import { CATALOG_REVISION } from "./catalogRevision";
import {
	candidatePresence,
	catalogFailure,
	enumerateScopes,
	evaluateCandidate,
} from "./compatibility";
import {
	draftScenes,
	effectiveDirectionIds,
	type ProgramMeta,
	toProgram,
} from "./emitProgram";
import type {
	AppliedContribution,
	AssetTrace,
	AxisRandom,
	CompileContext,
	CompileResult,
	CompositionCatalog,
	CompositionScope,
	CompositionStopReason,
	ContributionTrace,
	DirectionContribution,
	DraftBinding,
	DraftScene,
	DraftState,
} from "./types";

/** The catalog delivered with this build. Draft artwork is never part of it. */
export function productionCompositionCatalog(): CompositionCatalog {
	return {
		artwork: ARTWORK_CATALOG,
		directions: ACTIVE_DIRECTION_DEFINITIONS,
		revision: CATALOG_REVISION,
	};
}

/** Each step stops with this probability, so 1/2/3/4+ directions tend to 50/25/12.5/12.5%. */
const STOP_BELOW = 0.5;

function pick<T>(items: readonly T[], random: number, axis: string): T {
	if (!Number.isFinite(random) || random < 0 || random >= 1)
		throw new RangeError(`乱数軸「${axis}」の値が[0, 1)の範囲外です。`);
	const item = items[Math.floor(random * items.length)];
	if (item === undefined)
		throw new RangeError(`乱数軸「${axis}」の候補がありません。`);
	return item;
}

type ScopedCandidate = {
	readonly applied: AppliedContribution;
	readonly scope: CompositionScope;
};

type ContributionOption = {
	readonly candidates: readonly ScopedCandidate[];
	readonly contribution: DirectionContribution;
};

type DirectionOption = {
	readonly definition: DirectionDefinition;
	readonly options: readonly ContributionOption[];
};

function directionOptions(
	eligible: readonly DirectionDefinition[],
	state: DraftState,
	context: CompileContext,
	meta: ProgramMeta,
): readonly DirectionOption[] {
	const result: DirectionOption[] = [];
	for (const definition of eligible) {
		// The same direction is never selected twice.
		if (state.adopted.includes(definition.id)) continue;
		const options: ContributionOption[] = [];
		for (const contribution of definition.contributions) {
			const candidates = enumerateScopes(contribution, state, context).flatMap(
				(scope): ScopedCandidate[] => {
					const applied = evaluateCandidate({
						context,
						contribution,
						definition,
						meta,
						scope,
						state,
					});
					return applied ? [{ applied, scope }] : [];
				},
			);
			if (candidates.length > 0) options.push({ candidates, contribution });
		}
		if (options.length > 0) result.push({ definition, options });
	}
	return result;
}

function failed(
	code: Extract<CompileResult, { status: "failed" }>["code"],
	message: string,
): CompileResult {
	return { code, message, status: "failed" };
}

export type CompileOptions = {
	/** Test injection. Production derives every axis from the seed token. */
	readonly random?: AxisRandom;
};

/**
 * Builds a booklet program from the model, the normalized seed and the
 * catalog only; it reads no clock, DOM, network or global randomness.
 *
 * One base direction is chosen, then each step either stops with
 * probability 1/2 or adds one contribution from an unused direction:
 * direction, contribution and scope are each chosen uniformly, so a
 * direction with more artwork or scopes is not favored. There is no fixed
 * upper bound; the published direction count ends the loop.
 */
export function compileBooklet(
	model: BookletModel,
	requestedTheme: Pick<RequestedBookletTheme, "seed">,
	catalog: CompositionCatalog = productionCompositionCatalog(),
	options: CompileOptions = {},
): CompileResult {
	const seed = formatThemeSeed(requestedTheme.seed);
	const random: AxisRandom =
		options.random ?? ((axis) => axisRandom(seed, axis));
	const catalogError = catalogFailure(catalog);
	if (catalogError) return failed(catalogError.code, catalogError.message);

	const context: CompileContext = {
		artwork: catalog.artwork,
		facts: deriveFacts(model),
		localePack: localePackFor(model.cover.destinationPlace),
		model,
	};
	const meta: ProgramMeta = { catalogRevision: catalog.revision, seed };
	const eligible = catalog.directions.filter((definition) =>
		isDirectionEligible(definition, {
			destinationPlace: model.cover.destinationPlace,
		}),
	);
	if (eligible.length === 0)
		return failed(
			"no-eligible-direction",
			"この旅程で使える方向がありません。",
		);

	const base = pick(eligible, random("direction:base"), "direction:base");
	let state = buildBaselineState(base, context);
	if (!state)
		return failed(
			"invalid-program",
			`方向「${base.id}」の単独冊子を構築できません。`,
		);
	const presence = candidatePresence(context);
	const initialIssues = programIssues(
		toProgram(state, meta, () => null, presence),
		model,
	);
	if (initialIssues.length > 0)
		return failed("invalid-program", initialIssues.join(" / "));

	const contributions: ContributionTrace[] = [];
	let stopReason: CompositionStopReason;
	for (let step = 0; ; step += 1) {
		const continueAxis = `compose:${step}:continue`;
		const continueRandom = random(continueAxis);
		if (
			!Number.isFinite(continueRandom) ||
			continueRandom < 0 ||
			continueRandom >= 1
		)
			throw new RangeError(
				`乱数軸「${continueAxis}」の値が[0, 1)の範囲外です。`,
			);
		if (continueRandom < STOP_BELOW) {
			stopReason = "random-stop";
			break;
		}
		const directions = directionOptions(eligible, state, context, meta);
		if (directions.length === 0) {
			stopReason = "no-compatible-contribution";
			break;
		}
		const choice = `compose:${step}:choice`;
		const direction = pick(
			directions,
			random(`${choice}:direction`),
			`${choice}:direction`,
		);
		const option = pick(
			direction.options,
			random(`${choice}:operation`),
			`${choice}:operation`,
		);
		const candidate = pick(
			option.candidates,
			random(`${choice}:scope`),
			`${choice}:scope`,
		);
		state = candidate.applied.state;
		const issues = programIssues(
			toProgram(state, meta, () => null, presence),
			model,
		);
		if (issues.length > 0)
			return failed(
				"invalid-program",
				`適用後の検査に失敗しました: ${issues.join(" / ")}`,
			);
		contributions.push({
			contributionId: option.contribution.id,
			directionId: direction.definition.id,
			scope: candidate.scope,
			step,
		});
	}

	// Freeze artwork only after composition, in program order, one axis per slot.
	const frozen = new Map<string, string | null>();
	const assets: AssetTrace[] = [];
	const bindingKey = (scene: DraftScene, binding: DraftBinding) =>
		`${scene.sceneId}\u0000${binding.slotId}`;
	for (const scene of draftScenes(state)) {
		for (const binding of scene.config.bindings) {
			const candidates = bindingCandidates(
				context.artwork,
				binding,
				paperColorFor(scene.config),
			);
			const axis = `art:${scene.sceneId}:${binding.slotId}`;
			if (candidates.length === 0 && binding.required)
				return failed(
					"artwork-unavailable",
					`必須slot「${axis}」に審査済みの素材がありません。`,
				);
			const assetId =
				candidates.length === 0
					? null
					: pick(candidates, random(axis), axis).id;
			frozen.set(bindingKey(scene, binding), assetId);
			assets.push({ assetId, sceneId: scene.sceneId, slotId: binding.slotId });
		}
	}
	const resolveAsset = (scene: DraftScene, binding: DraftBinding) =>
		frozen.get(bindingKey(scene, binding)) ?? null;
	const frozenPresence = (scene: DraftScene, binding: DraftBinding) =>
		resolveAsset(scene, binding) !== null;
	const program = toProgram(state, meta, resolveAsset, frozenPresence);
	const finalIssues = programIssues(program, model);
	if (finalIssues.length > 0)
		return failed("invalid-program", finalIssues.join(" / "));
	return {
		program,
		status: "compiled",
		trace: {
			assets,
			baseDirectionId: state.baseDirectionId,
			catalogRevision: catalog.revision,
			contributions,
			effectiveDirectionIds: effectiveDirectionIds(state, frozenPresence),
			seed,
			stopReason,
		},
	};
}
