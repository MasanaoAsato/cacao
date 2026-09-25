import { standardContributions } from "../composition/contributions";
import type {
	DirectionBaseline,
	DirectionContribution,
	DirectionDefinition,
	DirectionEligibility,
	DirectionId,
	DirectionModuleId,
	DirectionSignature,
	DirectionStyleBundleId,
	DirectionTouchId,
} from "./types";

const COVERAGE = Object.freeze({
	continuationPage: true,
	cover: true,
	emptyDay: true,
	fullItinerary: true,
} as const);

type DirectionDefinitionInput<Id extends DirectionId> = {
	readonly config?: import("./types").DirectionBaselineConfig;
	readonly contributions?: readonly DirectionContribution[];
	readonly coverModule?: DirectionModuleId;
	readonly eligibility?: DirectionEligibility;
	readonly id: Id;
	readonly module: DirectionModuleId;
	readonly revision?: number;
	readonly signature: DirectionSignature;
	readonly styleBundleId: DirectionStyleBundleId;
	readonly touch: DirectionTouchId;
};

export function defineDirection<Id extends DirectionId>(
	input: DirectionDefinitionInput<Id>,
): DirectionDefinition<Id> {
	const revision = input.revision ?? 1;
	if (!Number.isSafeInteger(revision) || revision < 1)
		throw new RangeError(
			`方向「${input.id}」のrevisionは正の安全な整数が必要です。`,
		);
	const config = Object.freeze({ ...input.config });
	const eligibility = input.eligibility
		? Object.freeze({
				...input.eligibility,
				...(input.eligibility.kind === "locale-pack"
					? {
							localePackIds: Object.freeze([
								...input.eligibility.localePackIds,
							]),
						}
					: {}),
			})
		: { kind: "always" as const };
	const baseline: DirectionBaseline = Object.freeze({
		config,
		coverModule: input.coverModule ?? input.module,
		coverage: COVERAGE,
		module: input.module,
		signature: Object.freeze({ ...input.signature }),
		styleBundleId: input.styleBundleId,
		touch: input.touch,
	});
	return Object.freeze({
		baseline: () => baseline,
		contributions: Object.freeze(
			[
				...standardContributions(input.id, baseline),
				...(input.contributions ?? []),
			].map((contribution) => Object.freeze({ ...contribution })),
		),
		eligibility,
		id: input.id,
		revision,
		reviewId: `direction:${input.id}:v${revision}` as const,
	});
}
