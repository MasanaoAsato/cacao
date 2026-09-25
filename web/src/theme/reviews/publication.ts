import type { ArtworkAsset, ArtworkDefinition } from "../artwork/types";
import { isDirectionArtworkReady } from "../composition/activeDirections";
import type { DirectionDefinition } from "../directions/types";
import {
	type ArtworkReview,
	DIFFERENCE_AXES,
	type DirectionReview,
	type ProvisionalReview,
	type SampleReview,
} from "./types";

type Selection<T> = {
	readonly selected: readonly T[];
	readonly issues: readonly string[];
};

const MAJOR_AXES = new Set([
	"material",
	"typography",
	"imagery",
	"readingOrder",
]);

function validProvisional(review: ProvisionalReview): boolean {
	return Boolean(review.evidence?.trim() && review.reason?.trim());
}

function realReviewId(id: string | null | undefined): boolean {
	const value = id?.trim() ?? "";
	return (
		value.length > 0 &&
		value !== "preview-only" &&
		!value.startsWith("test-review:") &&
		value !== "structure-check-only"
	);
}

function duplicateIds<T extends { readonly id: string }>(
	records: readonly T[],
	kind: string,
): string[] {
	const seen = new Set<string>();
	const issues: string[] = [];
	for (const record of records) {
		if (!record.id || seen.has(record.id))
			issues.push(`${kind} ${record.id}: duplicate or empty ID`);
		seen.add(record.id);
	}
	return issues;
}

/** A partial publication checks only declared active work. Missing and draft records are expected. */
function selectArtwork(
	manifest: readonly ArtworkDefinition[],
	reviews: readonly ArtworkReview[],
	allowedStatuses: ReadonlySet<string>,
): Selection<ArtworkDefinition> {
	const issues = duplicateIds(reviews, "artwork review");
	const definitions = new Map(manifest.map((asset) => [asset.id, asset]));
	const active = new Map<string, ArtworkReview>();
	const reviewIds = new Set<string>();
	for (const review of reviews) {
		if (!allowedStatuses.has(review.status)) continue;
		const asset = definitions.get(review.id);
		if (
			!asset ||
			!Number.isSafeInteger(asset.revision) ||
			asset.revision < 1 ||
			!realReviewId(asset.reviewId) ||
			!realReviewId(review.reviewId) ||
			asset.revision !== review.revision ||
			asset.reviewId !== review.reviewId ||
			reviewIds.has(review.reviewId) ||
			!review.reviewer?.trim() ||
			(review.provisional !== undefined &&
				!validProvisional(review.provisional))
		) {
			issues.push(`artwork ${review.id}: active review/revision mismatch`);
			continue;
		}
		active.set(review.id, review);
		reviewIds.add(review.reviewId);
	}
	return {
		selected: manifest.filter((asset) => active.has(asset.id)),
		issues,
	};
}

export function selectPublishedArtwork(
	manifest: readonly ArtworkDefinition[],
	reviews: readonly ArtworkReview[],
): Selection<ArtworkDefinition> {
	return selectArtwork(manifest, reviews, new Set(["active"]));
}

/** E2E comparison may use human-reviewed material before activation. */
export function selectPlannedArtwork(
	manifest: readonly ArtworkDefinition[],
	reviews: readonly ArtworkReview[],
): Selection<ArtworkDefinition> {
	return selectArtwork(manifest, reviews, new Set(["reviewed", "active"]));
}

/** Checked again for the selected sample, so an unaccepted or stale work cannot authorize a direction. */
export function sampleComparisonIssues(
	sample: SampleReview,
	priorAccepted: ReadonlyMap<string, SampleReview>,
	catalogRevision: string,
	firstSample: boolean,
): string[] {
	const issues: string[] = [];
	const count = sample.effectiveDirectionIds.length;
	if (
		!Number.isInteger(sample.seed) ||
		sample.seed < 0 ||
		sample.seed > 65535 ||
		sample.catalogRevision !== catalogRevision ||
		!Number.isSafeInteger(sample.pageCount) ||
		sample.pageCount < 1 ||
		!sample.reviewer?.trim() ||
		!sample.perceptualGroupId?.trim() ||
		count === 0 ||
		sample.effectiveDirectionIds[0] !== sample.baseDirectionId ||
		new Set(sample.effectiveDirectionIds).size !== count ||
		!sample.moduleIds.length ||
		!sample.fixture
	)
		issues.push(`sample ${sample.sampleId}: invalid recipe or revision`);
	if (sample.decision !== "accept") {
		issues.push(`sample ${sample.sampleId}: comparison not accepted`);
		return issues;
	}
	const axes = DIFFERENCE_AXES.filter((axis) => sample.judgments[axis]?.trim());
	if (
		axes.length < 2 ||
		!axes.some((axis) => MAJOR_AXES.has(axis)) ||
		(!firstSample &&
			(!sample.nearestSampleId ||
				!priorAccepted.has(sample.nearestSampleId))) ||
		(firstSample && sample.nearestSampleId !== null)
	)
		issues.push(
			`sample ${sample.sampleId}: comparison to nearest accepted work is missing`,
		);
	return issues;
}

export function selectPublishedDirections(
	registered: readonly DirectionDefinition[],
	reviews: readonly DirectionReview[],
	samples: readonly SampleReview[],
	artwork: readonly ArtworkAsset[],
	catalogRevision: string,
	maxDirections = 1,
): Selection<DirectionDefinition> {
	const issues = duplicateIds(reviews, "direction review");
	const definitions = new Map(
		registered.map((definition) => [definition.id, definition]),
	);
	const sampleById = new Map<string, SampleReview>();
	const accepted = new Map<string, SampleReview>();
	const validSamples = new Set<string>();
	for (const sample of samples) {
		if (!sample.sampleId || sampleById.has(sample.sampleId)) {
			issues.push(`sample ${sample.sampleId}: duplicate or empty ID`);
			validSamples.delete(sample.sampleId);
			continue;
		}
		const sampleIssues = sampleComparisonIssues(
			sample,
			accepted,
			catalogRevision,
			sampleById.size === 0,
		);
		if (sampleIssues.length === 0) {
			validSamples.add(sample.sampleId);
			accepted.set(sample.sampleId, sample);
		}
		sampleById.set(sample.sampleId, sample);
	}
	const active = new Set<string>();
	for (const review of reviews) {
		if (review.status !== "active") continue;
		const definition = definitions.get(review.id);
		const sample = review.sampleId
			? sampleById.get(review.sampleId)
			: undefined;
		const hasApproval = review.provisional
			? review.sampleId === null &&
				validProvisional(review.provisional) &&
				review.provisional.catalogRevision === catalogRevision &&
				maxDirections === 1
			: Boolean(
					sample &&
						review.sampleId &&
						validSamples.has(review.sampleId) &&
						sample.baseDirectionId === definition?.id,
				);
		if (
			!definition ||
			!Number.isSafeInteger(definition.revision) ||
			definition.revision < 1 ||
			!realReviewId(definition.reviewId) ||
			!realReviewId(review.reviewId) ||
			review.revision !== definition.revision ||
			review.reviewId !== definition.reviewId ||
			!review.reviewer?.trim() ||
			!hasApproval
		) {
			issues.push(
				`direction ${review.id}: active review/revision/sample mismatch`,
			);
			continue;
		}
		if (!isDirectionArtworkReady(definition, artwork)) {
			issues.push(`direction ${review.id}: required active artwork missing`);
			continue;
		}
		active.add(review.id);
	}
	return {
		selected: registered.filter((definition) => active.has(definition.id)),
		issues,
	};
}
