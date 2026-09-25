import type { BookletModel } from "../../booklet/model";
import type { ArtworkDefinition } from "../artwork/types";
import { compileBooklet } from "../composition/compileBooklet";
import type { CompositionCatalog } from "../composition/types";
import type { DirectionDefinition } from "../directions/types";
import {
	sampleComparisonIssues,
	selectPublishedArtwork,
	selectPublishedDirections,
} from "./publication";
import type { ReviewRecords, SampleReview } from "./types";

export type {
	ArtworkReview,
	DifferenceAxis,
	DirectionReview,
	ReviewRecords,
	ReviewStatus,
	SampleReview,
} from "./types";
export { DIFFERENCE_AXES } from "./types";

/** Publication checks never invent a review or turn a draft into an active work. */
export function reviewIssues(
	records: ReviewRecords,
	directions: readonly DirectionDefinition[],
	artwork: readonly ArtworkDefinition[],
	catalogRevision: string,
): string[] {
	const issues: string[] = [];
	const samples = new Map<string, SampleReview>();
	const accepted = new Map<string, SampleReview>();
	const groups = new Map<string, number>();
	const sampleCounts = new Map<string, number>();
	let fivePlus = 0;
	let samePageTriple = 0;
	let chapter = 0;
	for (const sample of records.samples) {
		if (!sample.sampleId || samples.has(sample.sampleId)) {
			issues.push(`sample ${sample.sampleId}: duplicate or empty ID`);
			continue;
		}
		const count = sample.effectiveDirectionIds.length;
		const key = `${sample.baseDirectionId}/${Math.min(count, 4)}`;
		if (sample.decision === "accept") {
			sampleCounts.set(key, (sampleCounts.get(key) ?? 0) + 1);
			groups.set(
				sample.perceptualGroupId,
				(groups.get(sample.perceptualGroupId) ?? 0) + 1,
			);
			if (count >= 5) fivePlus += 1;
			if (sample.samePageTriple) samePageTriple += 1;
			if (sample.chapterChange) chapter += 1;
		}
		if (sample.decision === "accept") {
			const comparisonIssues = sampleComparisonIssues(
				sample,
				accepted,
				catalogRevision,
				samples.size === 0,
			);
			issues.push(...comparisonIssues);
			if (comparisonIssues.length === 0) accepted.set(sample.sampleId, sample);
		} else if (
			!Number.isInteger(sample.seed) ||
			sample.seed < 0 ||
			sample.seed > 65535 ||
			sample.catalogRevision !== catalogRevision ||
			!sample.reviewer?.trim()
		)
			issues.push(`sample ${sample.sampleId}: invalid recipe or revision`);
		samples.set(sample.sampleId, sample);
	}
	const directionReviews = new Map(
		records.directions.map((review) => [review.id, review]),
	);
	if (directionReviews.size !== records.directions.length)
		issues.push("duplicate direction review");
	for (const direction of directions) {
		const review = directionReviews.get(direction.id);
		const sample = review?.sampleId ? samples.get(review.sampleId) : undefined;
		if (review?.provisional)
			issues.push(
				`direction ${direction.id}: provisional approval is not final review`,
			);
		if (
			review?.status !== "active" ||
			review.revision !== direction.revision ||
			review.reviewId !== direction.reviewId ||
			!review.reviewer?.trim() ||
			sample?.baseDirectionId !== direction.id ||
			sample?.decision !== "accept"
		)
			issues.push(
				`direction ${direction.id}: active review/revision/sample missing`,
			);
		for (const count of [1, 2, 3, 4]) {
			if (sampleCounts.get(`${direction.id}/${count}`) !== 1)
				issues.push(
					`direction ${direction.id}: ${count === 4 ? "4+" : count} accepted sample required`,
				);
		}
	}
	const artworkReviews = new Map(
		records.artwork.map((review) => [review.id, review]),
	);
	if (artworkReviews.size !== records.artwork.length)
		issues.push("duplicate artwork review");
	for (const asset of artwork) {
		const review = artworkReviews.get(asset.id);
		if (review?.provisional)
			issues.push(
				`artwork ${asset.id}: provisional approval is not final review`,
			);
		if (
			review?.status !== "active" ||
			review.revision !== asset.revision ||
			!asset.reviewId ||
			review.reviewId !== asset.reviewId ||
			!review.reviewer?.trim()
		)
			issues.push(`artwork ${asset.id}: active review/revision missing`);
	}
	if (records.samples.length !== directions.length * 4)
		issues.push(
			`expected ${directions.length * 4} samples, got ${records.samples.length}`,
		);
	if (fivePlus < 12) issues.push(`5+ direction samples: ${fivePlus}/12`);
	if (samePageTriple < 12)
		issues.push(`same-page 3+ samples: ${samePageTriple}/12`);
	if (chapter < 12) issues.push(`chapter-change samples: ${chapter}/12`);
	if (
		records.samples.length > 0 &&
		Math.max(...groups.values(), 0) / records.samples.length >= 0.25
	)
		issues.push("largest perceptual group must be below 25%");
	const publishedArtwork = selectPublishedArtwork(artwork, records.artwork);
	issues.push(...publishedArtwork.issues);
	issues.push(
		...selectPublishedDirections(
			directions,
			records.directions,
			records.samples,
			publishedArtwork.selected.map((asset) => ({ ...asset, src: "" })),
			catalogRevision,
		).issues,
	);
	return issues;
}

/** A saved reference counts only if its seed reproduces its claims in the product compiler. */
export function sampleRecipeIssues(
	samples: readonly SampleReview[],
	catalog: CompositionCatalog,
	fixtures: Readonly<Record<SampleReview["fixture"], BookletModel>>,
): string[] {
	const issues: string[] = [];
	for (const sample of samples) {
		const result = compileBooklet(
			fixtures[sample.fixture],
			{ seed: { value: sample.seed, version: "v2" } },
			catalog,
		);
		if (result.status !== "compiled") {
			issues.push(`${sample.sampleId}: compile failed (${result.code})`);
			continue;
		}
		const { program, trace } = result;
		const moduleIds = [
			...new Set(program.scenes.map((scene) => scene.moduleId)),
		];
		const effectSets = program.scenes.map(
			(scene) => new Set(scene.effects.map((effect) => effect.directionId)),
		);
		const triple = effectSets.some((set) => set.size >= 3);
		const chapter =
			trace.contributions.some((item) =>
				["chapter-style", "sequence"].some((kind) =>
					item.contributionId.endsWith(`:${kind}`),
				),
			) &&
			program.scenes.some((scene) =>
				scene.effects.some(
					(effect) =>
						effect.kind === "chapter" &&
						effect.directionId !== trace.baseDirectionId,
				),
			);
		if (
			trace.baseDirectionId !== sample.baseDirectionId ||
			JSON.stringify(trace.effectiveDirectionIds) !==
				JSON.stringify(sample.effectiveDirectionIds) ||
			JSON.stringify(trace.contributions.map((item) => item.contributionId)) !==
				JSON.stringify(sample.contributionIds) ||
			JSON.stringify(
				trace.assets.flatMap((item) => (item.assetId ? [item.assetId] : [])),
			) !== JSON.stringify(sample.assets) ||
			JSON.stringify(moduleIds) !== JSON.stringify(sample.moduleIds) ||
			(sample.samePageTriple && !triple) ||
			(sample.chapterChange && !chapter)
		)
			issues.push(
				`${sample.sampleId}: saved recipe differs from compiler output`,
			);
	}
	return issues;
}
