import type { ArtworkRole, ArtworkTouchId } from "../../theme/artwork/types";
import type { LocalePackId } from "../../theme/directions/localePacks";
import type {
	DirectionBaselineConfig,
	DirectionId,
	DirectionModuleId,
	DirectionTouchId,
	StyleBundleId,
} from "../../theme/directions/types";
import type { TimeOfDay } from "./deriveFacts";

export type SceneKind = "cover" | "day" | "divider" | "memo" | "endcap";

export type ImageTreatmentId =
	| "film"
	| "polaroid"
	| "post"
	| "collage"
	| "caption-margin"
	| "sketch-note"
	| "gallery-margin";

export type ParticipationId =
	| "stamp"
	| "checklist"
	| "mission"
	| "memory-album";

/** quest-board reserves these lanes inside its own body (25.4). */
export type ParticipationLaneId = "stamp" | "checklist";

export type HeadingSystemId =
	| "note"
	| "station-sign"
	| "boarding-pass"
	| "chalkboard"
	| "masthead"
	| "literary"
	| "vertical-title";

export type HeadingOrientation = "horizontal" | "vertical";

export type ContentStructureId =
	| "concept-route"
	| "route-line"
	| "timeline"
	| "cards"
	| "stage-panels"
	| "board-squares"
	| "data-columns"
	| "fixed-columns"
	| "category-bands";

export type LedgerHeadingId = NonNullable<
	DirectionBaselineConfig["ledgerHeading"]
>;
export type DayHeaderLabel = NonNullable<DirectionBaselineConfig["dayHeader"]>;

/** Paper, body text and accent always move together as one bundle. */
export type SceneSurface = {
	readonly directionId: DirectionId;
	readonly localePackId: LocalePackId | null;
	readonly styleBundleId: StyleBundleId;
	readonly touch: DirectionTouchId;
};

export type HeadingAssignment = {
	readonly directionId: DirectionId;
	readonly orientation: HeadingOrientation;
	readonly styleBundleId: StyleBundleId;
	readonly system: HeadingSystemId | null;
};

export type ImageTreatmentAssignment = {
	readonly directionId: DirectionId;
	readonly treatment: ImageTreatmentId;
};

export type ContentStructureAssignment = {
	readonly directionId: DirectionId;
	readonly sourceModuleId: DirectionModuleId;
	readonly structure: ContentStructureId;
};

export type ParticipationLaneAssignment = {
	readonly directionId: DirectionId;
	readonly lane: ParticipationLaneId;
};

/** A frozen artwork choice. `assetId` is null only for an optional slot. */
export type ArtworkBinding = {
	readonly assetId: string | null;
	readonly directionId: DirectionId;
	readonly role: ArtworkRole;
	readonly slotId: string;
	readonly touchId: ArtworkTouchId;
	readonly viewId: string | null;
};

export type CommonSceneConfig = {
	readonly bindings: readonly ArtworkBinding[];
	readonly compositionId: string;
	readonly contentStructure: ContentStructureAssignment | null;
	readonly heading: HeadingAssignment;
	readonly imageTreatment: ImageTreatmentAssignment | null;
	readonly numberedEntries: boolean;
	readonly surface: SceneSurface;
};

export type ModuleConfigById = {
	readonly "atlas-grid": CommonSceneConfig;
	readonly "editorial-magazine": CommonSceneConfig;
	readonly ledger: CommonSceneConfig & {
		readonly ledgerHeading: LedgerHeadingId | null;
	};
	readonly "paper-collage": CommonSceneConfig;
	readonly "photo-essay": CommonSceneConfig & { readonly heroSplit: boolean };
	readonly "playful-route": CommonSceneConfig & {
		readonly dayHeader: DayHeaderLabel | null;
	};
	readonly "quest-board": CommonSceneConfig & {
		readonly dayHeader: DayHeaderLabel | null;
		readonly participationLane: ParticipationLaneAssignment | null;
	};
	readonly "schematic-map": CommonSceneConfig;
	readonly "specimen-board": CommonSceneConfig;
	readonly "travel-newspaper": CommonSceneConfig;
	readonly "vertical-poster": CommonSceneConfig;
	readonly "woodcut-folio": CommonSceneConfig & {
		readonly minimalDecoration: boolean;
	};
};

export type EffectKind =
	| "body-structure"
	| "chapter"
	| "heading"
	| "hero-art"
	| "image-treatment"
	| "participation";

/** A visible contribution that 25.4 must find in the final DOM at this size. */
export type EffectClaim = {
	readonly directionId: DirectionId;
	readonly kind: EffectKind;
	readonly minimumHeightMm: number;
	readonly minimumWidthMm: number;
	readonly regionId: string;
	readonly sceneId: string;
};

/** A module ID paired with exactly its own config type. */
export type ModuleSceneBinding = {
	[M in DirectionModuleId]: {
		readonly config: ModuleConfigById[M];
		readonly moduleId: M;
	};
}[DirectionModuleId];

type SceneOf<K extends SceneKind, M extends DirectionModuleId, Extra> = {
	readonly config: ModuleConfigById[M];
	readonly effects: readonly EffectClaim[];
	readonly kind: K;
	readonly moduleId: M;
	readonly sceneId: string;
} & Extra;

type AnyModuleScene<K extends SceneKind, Extra> = {
	[M in DirectionModuleId]: SceneOf<K, M, Extra>;
}[DirectionModuleId];

export type DaySection = {
	readonly directionId: DirectionId;
	readonly timeOfDay: TimeOfDay;
};

export type CoverScene = AnyModuleScene<"cover", object>;

export type DayScene = AnyModuleScene<
	"day",
	{
		readonly dayId: string;
		/** Only the first scene of a day places the day illustration. */
		readonly showIllustration: boolean;
		readonly section: DaySection | null;
		readonly unitIds: readonly string[];
	}
>;

export type ChapterRole = "departure" | "day" | "return";

/** Extras are drawn by woodcut-folio with the contributing direction's style. */
export type DividerScene = SceneOf<
	"divider",
	"woodcut-folio",
	{
		readonly chapterRole: ChapterRole;
		readonly dayRef: string;
		readonly directionId: DirectionId;
	}
>;

export type MemoScene = SceneOf<
	"memo",
	"woodcut-folio",
	{
		readonly dayRef: string;
		readonly directionId: DirectionId;
		readonly participation: ParticipationId;
		readonly unitRefs: readonly string[];
	}
>;

export type EndcapScene = SceneOf<
	"endcap",
	"woodcut-folio",
	{ readonly directionId: DirectionId }
>;

export type ProgramScene =
	| CoverScene
	| DayScene
	| DividerScene
	| MemoScene
	| EndcapScene;

export type BookletProgram = {
	readonly baseDirectionId: DirectionId;
	readonly catalogRevision: string;
	readonly scenes: readonly ProgramScene[];
	/** The normalized v2 seed token; a transport format, not a look version. */
	readonly seed: string;
};
