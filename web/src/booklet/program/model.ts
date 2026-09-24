import type { ArtworkRole, ArtworkTouchId } from "../../theme/artwork/types";
import type { LocalePackId } from "../../theme/directions/localePacks";
import type {
	DirectionBaselineConfig,
	DirectionId,
	DirectionModuleId,
	DirectionTouchId,
	StyleBundleId,
} from "../../theme/directions/types";
import type {
	EditorialArrivalUnit,
	EditorialBooklet,
	EditorialDay,
	PolicyId,
} from "../editorialModel";
import type { AtlasGridMeasurement } from "../families/atlasGrid";
import type { EditorialMagazineMeasurements } from "../families/editorialMagazine";
import type { PaperCollageMeasurement } from "../families/paperCollage";
import type { PlayfulRouteMeasurement } from "../families/playfulRoute";
import type { TravelNewspaperMeasurements } from "../families/travelNewspaper";
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

/**
 * The five modules extracted from the existing families. `styleProfileId`
 * selects the regression path that draws with a registered family profile
 * (its palette, fonts and decor); null draws with the direction's own bundle.
 */
export type ExtractedFamilyConfig = CommonSceneConfig & {
	readonly styleProfileId: string | null;
};

export type ModuleConfigById = {
	readonly "atlas-grid": ExtractedFamilyConfig;
	readonly "editorial-magazine": ExtractedFamilyConfig;
	readonly ledger: CommonSceneConfig & {
		readonly ledgerHeading: LedgerHeadingId | null;
	};
	readonly "paper-collage": ExtractedFamilyConfig;
	readonly "photo-essay": CommonSceneConfig & { readonly heroSplit: boolean };
	readonly "playful-route": ExtractedFamilyConfig & {
		readonly dayHeader: DayHeaderLabel | null;
	};
	readonly "quest-board": CommonSceneConfig & {
		readonly dayHeader: DayHeaderLabel | null;
		readonly participationLane: ParticipationLaneAssignment | null;
	};
	readonly "schematic-map": CommonSceneConfig;
	readonly "specimen-board": CommonSceneConfig;
	readonly "travel-newspaper": ExtractedFamilyConfig;
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

/** The scene of a program drawn by module `M`. */
export type SceneOfModule<M extends DirectionModuleId> = Extract<
	ProgramScene,
	{ readonly moduleId: M }
>;

/* ---- Scene spec, measurement and page plan per module (25.4) ---- */

/**
 * The input facts one scene draws. The module projects the whole model with
 * its policy, then narrows the day to the scene's own unit range. Names,
 * times and unit order are always kept.
 */
export type SceneContent = {
	readonly booklet: EditorialBooklet;
	/** The day this scene belongs to or references; null on cover/endcap. */
	readonly day: EditorialDay | null;
	readonly dayIndex: number | null;
	/** Units the scene draws as body (`data-unit-id`), in input order. */
	readonly ownedUnits: readonly EditorialArrivalUnit[];
	/** Units an extra page only references (`data-unit-ref`). */
	readonly referencedUnits: readonly EditorialArrivalUnit[];
	/** 0-based position of the first owned unit within its day. */
	readonly firstUnitOffset: number;
	readonly policyId: PolicyId;
};

export type SceneSpec<M extends DirectionModuleId = DirectionModuleId> = {
	readonly content: SceneContent;
	readonly scene: SceneOfModule<M>;
	/**
	 * Fonts, colors and heading of the scene. The measurement must report the
	 * same key; a mismatch is `invalid-measurement`.
	 */
	readonly styleKey: string;
};

/** A spec of some module; narrowed with `isSpecOfModule` before dispatch. */
export type AnySceneSpec = SceneSpec<DirectionModuleId>;

/** Verified narrowing: the scene itself says which module draws it. */
export function isSpecOfModule<M extends DirectionModuleId>(
	spec: AnySceneSpec,
	moduleId: M,
): spec is SceneSpec<M> {
	return spec.scene.moduleId === moduleId;
}

export type LocalPageKind =
	| "cover"
	| "first"
	| "continuation"
	| "divider"
	| "memo"
	| "endcap";

/**
 * One page of a scene. The page ID in the document is
 * `${sceneId}/${localPageId}`; the running page number is only drawn after
 * all scenes are concatenated.
 */
export type LocalPage = {
	/** The composition actually drawn, after a module's own fallback. */
	readonly compositionId: string;
	readonly kind: LocalPageKind;
	readonly localPageId: string;
	/** Units drawn as body on this page, in reading order. */
	readonly unitIds: readonly string[];
	/** Units this page only references (memo). */
	readonly unitRefs: readonly string[];
};

export type CoverLocalPage = LocalPage & {
	readonly kind: "cover";
	/** Set by modules that step the title size down (extracted families). */
	readonly titleSizePt: number | null;
};

export type BodyLocalPage = LocalPage & {
	readonly kind: "first" | "continuation";
	/** Unit IDs per column, reading left column top to bottom first. */
	readonly columns: readonly (readonly string[])[];
	/** 1-based running number of the first unit of this page within its day. */
	readonly firstUnitNumber: number;
	/** A module-owned composition fallback (paper-collage, playful-route). */
	readonly layoutVariant: string | null;
	/** playful-route draws its route from the measured block heights. */
	readonly unitHeightsMm: readonly number[] | null;
};

/** A memo page lists its referenced units in `unitRefs`; the others own none. */
export type ExtraLocalPage = LocalPage & {
	readonly kind: "divider" | "memo" | "endcap";
};

export type AnyLocalPage = CoverLocalPage | BodyLocalPage | ExtraLocalPage;

export type ModuleLocalPage<M extends DirectionModuleId> =
	M extends "woodcut-folio"
		? CoverLocalPage | BodyLocalPage | ExtraLocalPage
		: M extends "specimen-board"
			? BodyLocalPage
			: CoverLocalPage | BodyLocalPage;

export type ScenePlan<M extends DirectionModuleId = DirectionModuleId> = {
	readonly moduleId: M;
	readonly pages: readonly ModuleLocalPage<M>[];
	readonly sceneId: string;
};

export type AnyScenePlan = ScenePlan<DirectionModuleId>;

/** What every module measures from its measurement DOM, in mm. */
export type TitleMeasurement = {
	readonly contentHeightMm: number;
	readonly contentWidthMm: number;
	readonly reservedHeightMm: number;
	readonly reservedWidthMm: number;
};

export type CoverMeasurement = {
	readonly kind: "cover";
	readonly period: TitleMeasurement;
	readonly styleKey: string;
	readonly title: TitleMeasurement;
	/** Extracted families: the largest title size that fit, or null. */
	readonly titleSizePt: number | null;
};

export type BodyMeasurement = {
	/** Height of the empty-day text; only read when the scene owns no unit. */
	readonly emptyHeightMm: number;
	readonly heading: TitleMeasurement;
	readonly kind: "day";
	readonly styleKey: string;
	/** Width units were measured at; compared with the module geometry. */
	readonly textWidthMm: number;
	readonly unitHeightsMm: readonly number[];
};

export type ExtraMeasurement = {
	/** memo: height of each referenced entry block, in reference order. */
	readonly entryHeightsMm: readonly number[];
	readonly heading: TitleMeasurement;
	readonly kind: "divider" | "memo" | "endcap";
	readonly styleKey: string;
};

/**
 * An extracted family whose body was replaced by a transplanted content
 * structure. Its capacities come from the family DOM, whose geometry is
 * inherited instead of fixed in `modules/geometry.ts`.
 */
export type StructuredBodyMeasurement = Omit<BodyMeasurement, "kind"> & {
	/** Width of the family's body container the structure is laid out in. */
	readonly bodyWidthMm: number;
	readonly continuationCapacityMm: number;
	readonly firstCapacityMm: number;
	readonly kind: "structured-day";
};

/**
 * An extracted family's own day, measured with the family's existing
 * measurement contract narrowed to the scene's single day.
 */
export type FamilyDayMeasurement<Measurement> = {
	readonly heading: TitleMeasurement;
	readonly kind: "day";
	readonly measurement: Measurement;
	readonly styleKey: string;
};

type ExtractedMeasurement<Measurement> =
	| CoverMeasurement
	| FamilyDayMeasurement<Measurement>
	| StructuredBodyMeasurement;

export type SceneMeasurementByModule = {
	readonly "atlas-grid": ExtractedMeasurement<AtlasGridMeasurement>;
	readonly "editorial-magazine": ExtractedMeasurement<EditorialMagazineMeasurements>;
	readonly ledger: CoverMeasurement | BodyMeasurement;
	readonly "paper-collage": ExtractedMeasurement<PaperCollageMeasurement>;
	readonly "photo-essay": CoverMeasurement | BodyMeasurement;
	readonly "playful-route": ExtractedMeasurement<PlayfulRouteMeasurement>;
	readonly "quest-board": CoverMeasurement | BodyMeasurement;
	readonly "schematic-map": CoverMeasurement | BodyMeasurement;
	readonly "specimen-board": BodyMeasurement;
	readonly "travel-newspaper": ExtractedMeasurement<TravelNewspaperMeasurements>;
	readonly "vertical-poster": CoverMeasurement | BodyMeasurement;
	readonly "woodcut-folio":
		| CoverMeasurement
		| BodyMeasurement
		| ExtraMeasurement;
};

export type ScenePaginator<M extends DirectionModuleId> = (
	spec: SceneSpec<M>,
	measurement: SceneMeasurementByModule[M],
) => ScenePlan<M>;
