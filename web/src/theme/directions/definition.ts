import type {
	DirectionBaseline,
	DirectionContribution,
	DirectionDefinition,
	DirectionEligibility,
	DirectionId,
	DirectionModuleId,
	DirectionSignature,
	DirectionTouchId,
	StyleBundleId,
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
	readonly signature: DirectionSignature;
	readonly styleBundleId: StyleBundleId;
	readonly touch: DirectionTouchId;
};

export function defineDirection<Id extends DirectionId>(
	input: DirectionDefinitionInput<Id>,
): DirectionDefinition<Id> {
	const config = Object.freeze({
		...input.config,
		imageTreatments: input.config?.imageTreatments
			? Object.freeze([...input.config.imageTreatments])
			: undefined,
	});
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
				{
					kind: "visual-language" as const,
					signature: input.signature.description,
				},
				...(input.contributions ?? []),
			].map((contribution) => Object.freeze({ ...contribution })),
		),
		eligibility,
		id: input.id,
		revision: 1 as const,
		reviewId: `direction:${input.id}:v1` as const,
	});
}
