import type { BookletModel } from "../../booklet/model";
import type { DirectionId } from "../directions/types";
import { compileBooklet } from "./compileBooklet";
import type { CompositionCatalog, CompositionStopReason } from "./types";

export type DistributionReport = {
	readonly buckets: Readonly<Record<"1" | "2" | "3" | "4+", number>>;
	readonly byBase: Readonly<Partial<Record<DirectionId, number>>>;
	readonly failures: readonly { seed: number; code: string }[];
	readonly stopReasons: Readonly<Record<CompositionStopReason, number>>;
};

/** Samples the real compiler and catalog, including eligibility and missing artwork. */
export function sampleDistribution(
	model: BookletModel,
	catalog: CompositionCatalog,
	count = 1000,
): DistributionReport {
	const buckets = { "1": 0, "2": 0, "3": 0, "4+": 0 };
	const byBase: Partial<Record<DirectionId, number>> = {};
	const stopReasons: Record<CompositionStopReason, number> = {
		"max-directions": 0,
		"no-compatible-contribution": 0,
		"random-stop": 0,
	};
	const failures: { seed: number; code: string }[] = [];
	for (let seed = 0; seed < count; seed += 1) {
		const result = compileBooklet(
			model,
			{ seed: { value: seed, version: "v2" } },
			catalog,
		);
		if (result.status === "failed") {
			failures.push({ seed, code: result.code });
			continue;
		}
		const size = result.trace.effectiveDirectionIds.length;
		const bucket = size >= 4 ? "4+" : (String(size) as "1" | "2" | "3");
		buckets[bucket] += 1;
		byBase[result.trace.baseDirectionId] =
			(byBase[result.trace.baseDirectionId] ?? 0) + 1;
		stopReasons[result.trace.stopReason] += 1;
	}
	return { buckets, byBase, failures, stopReasons };
}

export function distributionIssues(report: DistributionReport): string[] {
	const errors = report.failures.map(
		({ seed, code }) => `seed ${seed}: ${code}`,
	);
	for (const [bucket, count] of Object.entries(report.buckets)) {
		if (count < 50) errors.push(`${bucket}方向は${count}件（最低50件）`);
	}
	return errors;
}
