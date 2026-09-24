import type { BookletModel } from "../../booklet/model";
import type { BookletFacts } from "../../booklet/program/deriveFacts";
import type {
	BookletProgram,
	ChapterRole,
	ContentStructureAssignment,
	ContentStructureId,
	DayHeaderLabel,
	DaySection,
	EffectKind,
	HeadingAssignment,
	HeadingOrientation,
	HeadingSystemId,
	ImageTreatmentAssignment,
	ImageTreatmentId,
	LedgerHeadingId,
	ParticipationId,
	ParticipationLaneAssignment,
	SceneSurface,
} from "../../booklet/program/model";
import type {
	ArtworkAsset,
	ArtworkRole,
	ArtworkTouchId,
} from "../artwork/types";
import type { LocalePack } from "../directions/localePacks";
import type {
	DirectionDefinition,
	DirectionId,
	DirectionModuleId,
	StyleBundleId,
} from "../directions/types";

/** `heading` is the cover title on a cover and the day heading on a day. */
export type RegionId = "heading" | "image" | "hero" | "body";

/** Scope enumeration order is book → scene order → region ID order. */
export const REGION_ORDER: readonly RegionId[] = [
	"heading",
	"image",
	"hero",
	"body",
];

export type CompositionScope =
	| { readonly kind: "book" }
	| { readonly kind: "scene"; readonly sceneId: string }
	/** A day-story time section of one day; never an arbitrary sub-range. */
	| {
			readonly dayId: string;
			readonly kind: "unit-range";
			readonly unitIds: readonly string[];
	  }
	| {
			readonly kind: "region";
			readonly regionId: RegionId;
			readonly sceneId: string;
	  };

export type ScopeKind = CompositionScope["kind"];

/** Which artwork a hero operation may place. The compiler never draws it. */
export type HeroSubjectPool =
	| { readonly kind: "hero-subjects" }
	| { readonly kind: "locale-subject" }
	| { readonly kind: "season-view" };

/**
 * Typed transformations published by the drawing modules. There is no CSS
 * string or generic patch; an unknown `kind` is a catalog definition error.
 */
export type CompositionOperation =
	/** Replace a day scene (or a day-story section) with the direction's baseline module and style. */
	| { readonly kind: "chapter-style" }
	| {
			readonly kind: "heading-system";
			readonly orientation: HeadingOrientation;
			readonly styleBundleId: StyleBundleId;
			readonly system: HeadingSystemId;
	  }
	| {
			readonly kind: "hero-art";
			readonly pool: HeroSubjectPool;
			readonly touchId: ArtworkTouchId;
	  }
	| { readonly kind: "image-treatment"; readonly treatment: ImageTreatmentId }
	| { readonly kind: "participation"; readonly participation: ParticipationId }
	| {
			readonly flow: "chapters" | "continuous-story" | "time-sections";
			readonly kind: "sequence";
	  }
	| {
			readonly kind: "content-structure";
			readonly sourceModuleId: DirectionModuleId;
			readonly structure: ContentStructureId;
	  }
	/** The paper/body/accent bundle; only ever paired with hero-art. */
	| { readonly kind: "surface-bundle"; readonly styleBundleId: StyleBundleId };

export type OperationKind = CompositionOperation["kind"];

export const OPERATION_KINDS: readonly OperationKind[] = [
	"chapter-style",
	"heading-system",
	"hero-art",
	"image-treatment",
	"participation",
	"sequence",
	"content-structure",
	"surface-bundle",
];

export type ContributionDataRequirement =
	/** At least one input day. */
	| "day"
	/** The targeted scene shows an existing itinerary image. */
	| "image"
	/** Some day has two or more consecutive time sections. */
	| "multiple-time-sections"
	/** The targeted day has at least one unit. */
	| "units";

export type ContributionRequirement = {
	readonly data: readonly ContributionDataRequirement[];
	/** null accepts every module that exposes the regions. */
	readonly modules: readonly DirectionModuleId[] | null;
	readonly regions: readonly RegionId[];
	readonly sceneKinds: readonly ("cover" | "day")[];
};

export type DirectionContribution = {
	readonly id: string;
	readonly operations: readonly CompositionOperation[];
	readonly requires: ContributionRequirement;
	readonly targetScope: readonly ScopeKind[];
	readonly visibleEffect: EffectKind;
};

/** Directions are listed in publication order; selection never uses object key order. */
export type CompositionCatalog = {
	readonly artwork: readonly ArtworkAsset[];
	readonly directions: readonly DirectionDefinition[];
	/** Deployment limit; an omitted limit keeps injected test catalogs unrestricted. */
	readonly maxDirections?: number;
	readonly revision: string;
};

export type ContributionTrace = {
	readonly contributionId: string;
	readonly directionId: DirectionId;
	readonly scope: CompositionScope;
	readonly step: number;
};

export type AssetTrace = {
	readonly assetId: string | null;
	readonly sceneId: string;
	readonly slotId: string;
};

export type CompositionStopReason =
	| "random-stop"
	| "max-directions"
	| "no-compatible-contribution";

/** Comparison record. It never carries names, places or reservation data. */
export type RecipeTrace = {
	readonly assets: readonly AssetTrace[];
	readonly baseDirectionId: DirectionId;
	readonly catalogRevision: string;
	readonly contributions: readonly ContributionTrace[];
	readonly effectiveDirectionIds: readonly DirectionId[];
	readonly seed: string;
	readonly stopReason: CompositionStopReason;
};

export type CompileFailureCode =
	| "empty-catalog"
	| "invalid-catalog"
	| "unknown-operation"
	| "no-eligible-direction"
	| "artwork-unavailable"
	| "invalid-program";

export type CompileResult =
	| {
			readonly program: BookletProgram;
			readonly status: "compiled";
			readonly trace: RecipeTrace;
	  }
	| {
			readonly code: CompileFailureCode;
			readonly message: string;
			readonly status: "failed";
	  };

/** Injected in tests; production reads `axisRandom(seedToken, axis)`. */
export type AxisRandom = (axis: string) => number;

/* ---- Compiler-internal draft state (not part of the 25.4 program contract) ---- */

/** Path segments such as ["scene", id, "heading", "system"]; compared by segment. */
export type ResourceKey = readonly string[];

export type WriteRecord = {
	readonly directionId: DirectionId;
	readonly key: ResourceKey;
};

export type DraftBinding = {
	readonly directionId: DirectionId;
	readonly heightMm: number;
	readonly required: boolean;
	readonly role: ArtworkRole;
	readonly slotId: string;
	readonly subjectIds: readonly string[];
	readonly touchId: ArtworkTouchId;
	readonly viewId: string | null;
	readonly widthMm: number;
};

export type DraftSceneConfig = {
	readonly bindings: readonly DraftBinding[];
	readonly chapterStyled: boolean;
	readonly compositionId: string;
	readonly contentStructure: ContentStructureAssignment | null;
	readonly dayHeader: DayHeaderLabel | null;
	readonly heading: HeadingAssignment;
	readonly heroSplit: boolean;
	readonly imageTreatment: ImageTreatmentAssignment | null;
	readonly ledgerHeading: LedgerHeadingId | null;
	readonly minimalDecoration: boolean;
	readonly moduleId: DirectionModuleId;
	readonly numberedEntries: boolean;
	/** The direction whose module and composition draw this scene. */
	readonly ownerDirectionId: DirectionId;
	readonly participationLane: ParticipationLaneAssignment | null;
	readonly surface: SceneSurface;
};

export type DraftCover = {
	readonly config: DraftSceneConfig;
	readonly kind: "cover";
	readonly sceneId: string;
};

export type DraftDayScene = {
	readonly config: DraftSceneConfig;
	readonly dayId: string;
	readonly kind: "day";
	readonly sceneId: string;
	readonly section: DaySection | null;
	readonly showIllustration: boolean;
	readonly unitIds: readonly string[];
};

export type DraftDivider = {
	readonly chapterRole: ChapterRole;
	readonly config: DraftSceneConfig;
	readonly dayRef: string;
	readonly directionId: DirectionId;
	readonly kind: "divider";
	readonly sceneId: string;
};

export type DraftMemo = {
	readonly config: DraftSceneConfig;
	readonly dayRef: string;
	readonly directionId: DirectionId;
	readonly kind: "memo";
	readonly participation: ParticipationId;
	readonly sceneId: string;
	readonly unitRefs: readonly string[];
};

export type DraftEndcap = {
	readonly config: DraftSceneConfig;
	readonly directionId: DirectionId;
	readonly kind: "endcap";
	readonly sceneId: string;
};

export type DraftScene =
	| DraftCover
	| DraftDayScene
	| DraftDivider
	| DraftMemo
	| DraftEndcap;

export type DraftDay = {
	readonly dayId: string;
	readonly divider: DraftDivider | null;
	readonly memo: DraftMemo | null;
	readonly segments: readonly DraftDayScene[];
};

export type DraftState = {
	/** Base first, then every adopted direction in adoption order. */
	readonly adopted: readonly DirectionId[];
	readonly baseDirectionId: DirectionId;
	readonly cover: DraftCover;
	readonly days: readonly DraftDay[];
	readonly endcap: DraftEndcap | null;
	/** Protected baseline writes and every adopted contribution write. */
	readonly writes: readonly WriteRecord[];
};

export type CompileContext = {
	readonly artwork: readonly ArtworkAsset[];
	readonly facts: BookletFacts;
	readonly localePack: LocalePack | null;
	readonly model: BookletModel;
};

/** An applicable contribution: the whole next state plus the keys it wrote. */
export type AppliedContribution = {
	readonly state: DraftState;
	readonly writes: readonly ResourceKey[];
};
