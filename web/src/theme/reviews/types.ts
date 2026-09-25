import type { DirectionId } from "../directions/types";

export type ReviewStatus = "draft" | "reviewed" | "active";
/** Explicit permission to use unfinished work during the artwork revision phase. */
export type ProvisionalReview = {
	readonly evidence: string;
	readonly reason: string;
};
export type DirectionReview = {
	readonly id: DirectionId;
	readonly revision: number;
	readonly reviewId: string;
	readonly sampleId: string | null;
	readonly provisional?: ProvisionalReview & {
		readonly catalogRevision: string;
	};
	readonly reviewer: string;
	readonly status: ReviewStatus;
};
export type ArtworkReview = {
	readonly id: string;
	readonly revision: number;
	readonly reviewId: string;
	readonly reviewer: string;
	readonly status: ReviewStatus;
	readonly provisional?: ProvisionalReview;
};
export const DIFFERENCE_AXES = [
	"material",
	"typography",
	"imagery",
	"readingOrder",
	"density",
	"chapterFlow",
] as const;
export type DifferenceAxis = (typeof DIFFERENCE_AXES)[number];
export type SampleReview = {
	readonly sampleId: string;
	readonly seed: number;
	readonly catalogRevision: string;
	readonly baseDirectionId: DirectionId;
	readonly effectiveDirectionIds: readonly DirectionId[];
	readonly contributionIds: readonly string[];
	readonly assets: readonly string[];
	readonly moduleIds: readonly string[];
	readonly pageCount: number;
	readonly nearestSampleId: string | null;
	readonly perceptualGroupId: string;
	readonly judgments: Partial<Record<DifferenceAxis, string>>;
	readonly decision: "accept" | "revise";
	readonly reviewer: string;
	/** The locale fixture must be specified for a locale-only direction. */
	readonly fixture: "standard" | "kyoto" | "tokyo" | "paris";
	readonly samePageTriple: boolean;
	readonly chapterChange: boolean;
};

export type ReviewRecords = {
	readonly directions: readonly DirectionReview[];
	readonly artwork: readonly ArtworkReview[];
	readonly samples: readonly SampleReview[];
};
