import type { BookletModel, BookletPlace } from "../../booklet/model";
import type {
	ImageTreatmentId,
	ParticipationId,
} from "../../booklet/program/model";
import type { DirectionContribution } from "../composition/types";

export type { DirectionContribution };

export const DIRECTION_IDS = [
	"travel-magazine",
	"travel-note",
	"scrapbook",
	"film",
	"retro-tourism",
	"vintage-journal",
	"luxury-magazine",
	"hotel-brochure",
	"inflight",
	"japan-poster",
	"wa-modern",
	"onsen",
	"youth",
	"anime-background",
	"game-ui",
	"rpg",
	"board-game",
	"rail",
	"flight",
	"road-trip",
	"map",
	"transit",
	"timeline",
	"cards",
	"minimal",
	"nordic",
	"pastel-pop",
	"cafe",
	"gourmet",
	"photo-book",
	"storybook",
	"literature",
	"newspaper",
	"tourist-info",
	"museum",
	"encyclopedia",
	"data-book",
	"web-app",
	"social",
	"polaroid",
	"season",
	"local-color",
	"local-motif",
	"stamp",
	"checklist",
	"mission",
	"day-story",
	"chapters",
	"category-color",
	"practical",
	"memory-album",
	"continuous-story",
] as const;

export type DirectionId = (typeof DIRECTION_IDS)[number];

export type DirectionModuleId =
	| "editorial-magazine"
	| "atlas-grid"
	| "paper-collage"
	| "photo-essay"
	| "woodcut-folio"
	| "vertical-poster"
	| "quest-board"
	| "playful-route"
	| "ledger"
	| "schematic-map"
	| "specimen-board"
	| "travel-newspaper";

export type DirectionTouchId =
	| "screenprint"
	| "pencil"
	| "cut-paper"
	| "charcoal"
	| "risograph"
	| "engraving"
	| "ink-wash"
	| "geometric"
	| "technical"
	| "brush"
	| "woodcut"
	| "gouache"
	| "pixel"
	| "none"
	| "chalk";

export type StyleBundleId =
	| "ink"
	| "bright"
	| "warm"
	| "quiet"
	| "play"
	| "night";

export type DirectionCoverage = {
	readonly continuationPage: true;
	readonly cover: true;
	readonly emptyDay: true;
	readonly fullItinerary: true;
};

export type DirectionSignature = {
	readonly description: string;
	readonly label: string;
};

export type DirectionBaselineConfig = {
	readonly dayHeader?: "DAY / EVENT" | "DAY / MISSION" | "第○章 / 訪問地点";
	readonly imageTreatment?: ImageTreatmentId;
	readonly ledgerHeading?: "data-book" | "flight" | "practical" | "rail";
	readonly minimalDecoration?: true;
	readonly numberedEntries?: true;
	readonly participation?: ParticipationId;
	readonly storyFlow?: "chapters" | "continuous-story" | "time-sections";
};

export type DirectionBaseline = {
	readonly config: DirectionBaselineConfig;
	readonly coverModule: DirectionModuleId;
	readonly coverage: DirectionCoverage;
	readonly module: DirectionModuleId;
	readonly signature: DirectionSignature;
	readonly styleBundleId: StyleBundleId;
	readonly touch: DirectionTouchId;
};

export type DirectionEligibility =
	| { readonly kind: "always" }
	| { readonly kind: "locale-pack"; readonly localePackIds: readonly string[] };

export type DirectionDefinition<Id extends DirectionId = DirectionId> = {
	readonly baseline: () => DirectionBaseline;
	readonly contributions: readonly DirectionContribution[];
	readonly eligibility: DirectionEligibility;
	readonly id: Id;
	readonly revision: 1;
	readonly reviewId: `direction:${Id}:v1`;
};

export type DirectionEligibilityContext = {
	readonly destinationPlace: BookletPlace | null;
};

export type DirectionBuildInput = {
	readonly model: BookletModel;
	readonly eligibility: DirectionEligibilityContext;
};
