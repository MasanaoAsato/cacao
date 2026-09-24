import type { DirectionModuleId } from "../../theme/directions/types";
import type { HeadingOrientation, ParticipationLaneId } from "./model";

/** Width and height in mm on the A5 page. */
export type RegionSize = {
	readonly heightMm: number;
	readonly widthMm: number;
};

/** A reserved artwork rectangle. Text never flows over it. */
export type ArtworkSlotSpec = RegionSize & {
	/** Role used when the baseline direction fills the slot with its touch. */
	readonly baselineRole: "hero" | "medium";
	readonly slotId: string;
};

export type CoverCapability = {
	readonly heroSlot: ArtworkSlotSpec | null;
	readonly image: RegionSize;
	readonly title: RegionSize;
	readonly titleOrientation: HeadingOrientation;
};

export type DayCapability = {
	readonly body: RegionSize;
	/** Native art slot on the first day page, or null. */
	readonly heroSlot: ArtworkSlotSpec | null;
	readonly heading: RegionSize;
	readonly headingOrientation: HeadingOrientation;
	/** Day illustration region on the first page, or null when the module has none. */
	readonly image: RegionSize | null;
	readonly participationLanes: readonly ParticipationLaneId[];
	/** photo-essay only: the module-specific image + hero composition. */
	readonly splitHero: {
		readonly compositionId: string;
		readonly image: RegionSize;
		readonly slot: ArtworkSlotSpec;
	} | null;
};

export type ModuleCapability = {
	/** null means the module cannot draw a cover (specimen-board). */
	readonly cover: CoverCapability | null;
	readonly day: DayCapability;
	readonly standardCompositionId: string;
};

/** Size of an 18pt heading line; smaller headings never count as an effect. */
export const HEADING_MINIMUM: RegionSize = { heightMm: 6.35, widthMm: 6.35 };

/** Smallest principal illustration or image treatment that counts (25.3). */
export const PRINCIPAL_ART_MINIMUM: RegionSize = { heightMm: 30, widthMm: 40 };

/** Memo, divider and endcap body region (10,40,128,154). */
export const EXTRA_PAGE_BODY: RegionSize = { heightMm: 154, widthMm: 128 };

const size = (widthMm: number, heightMm: number): RegionSize => ({
	heightMm,
	widthMm,
});

const STANDARD_COVER: CoverCapability = {
	heroSlot: null,
	image: size(128, 104),
	title: size(128, 32),
	titleOrientation: "horizontal",
};

/**
 * The five modules extracted from the existing families keep their own
 * geometry, which 25.4 measures. The compiler only relies on the lower bounds
 * it asks the final DOM to prove.
 */
function extractedFamily(standardCompositionId: string): ModuleCapability {
	return {
		cover: {
			heroSlot: null,
			image: PRINCIPAL_ART_MINIMUM,
			title: size(128, 6.35),
			titleOrientation: "horizontal",
		},
		day: {
			body: size(128, 40),
			heading: size(128, 6.35),
			headingOrientation: "horizontal",
			heroSlot: null,
			image: PRINCIPAL_ART_MINIMUM,
			participationLanes: [],
			splitHero: null,
		},
		standardCompositionId,
	};
}

export const MODULE_CAPABILITIES: Readonly<
	Record<DirectionModuleId, ModuleCapability>
> = {
	"atlas-grid": extractedFamily("side-index"),
	"paper-collage": extractedFamily("photo-left"),
	"playful-route": extractedFamily("zigzag"),
	"editorial-magazine": extractedFamily("magazine-feature"),
	"travel-newspaper": extractedFamily("newspaper-columns"),
	"woodcut-folio": {
		cover: {
			heroSlot: {
				baselineRole: "hero",
				heightMm: 84,
				slotId: "cover-hero",
				widthMm: 128,
			},
			image: size(36, 24),
			title: size(128, 32),
			titleOrientation: "horizontal",
		},
		day: {
			body: size(128, 98),
			heading: size(128, 28),
			headingOrientation: "horizontal",
			heroSlot: {
				baselineRole: "medium",
				heightMm: 46,
				slotId: "day-art",
				widthMm: 40,
			},
			image: size(82, 46),
			participationLanes: [],
			splitHero: null,
		},
		standardCompositionId: "folio",
	},
	"specimen-board": {
		cover: null,
		day: {
			body: size(128, 108),
			heading: size(128, 24),
			headingOrientation: "horizontal",
			heroSlot: {
				baselineRole: "medium",
				heightMm: 40,
				slotId: "specimen",
				widthMm: 42,
			},
			image: size(80, 40),
			participationLanes: [],
			splitHero: null,
		},
		standardCompositionId: "two-column",
	},
	"vertical-poster": {
		cover: {
			heroSlot: null,
			image: size(96, 146),
			title: size(26, 146),
			titleOrientation: "vertical",
		},
		day: {
			body: size(128, 98),
			heading: size(26, 80),
			headingOrientation: "vertical",
			heroSlot: null,
			image: size(96, 80),
			participationLanes: [],
			splitHero: null,
		},
		standardCompositionId: "vertical-title",
	},
	"photo-essay": {
		cover: STANDARD_COVER,
		day: {
			body: size(128, 48),
			heading: size(128, 24),
			headingOrientation: "horizontal",
			heroSlot: null,
			image: size(128, 100),
			participationLanes: [],
			splitHero: {
				compositionId: "hero-split",
				image: size(80, 100),
				slot: {
					baselineRole: "hero",
					heightMm: 100,
					slotId: "hero",
					widthMm: 42,
				},
			},
		},
		standardCompositionId: "single-plate",
	},
	"quest-board": {
		cover: STANDARD_COVER,
		day: {
			body: size(128, 108),
			heading: size(128, 24),
			headingOrientation: "horizontal",
			heroSlot: {
				baselineRole: "hero",
				heightMm: 40,
				slotId: "hero",
				widthMm: 42,
			},
			image: size(80, 40),
			participationLanes: ["stamp", "checklist"],
			splitHero: null,
		},
		standardCompositionId: "panels",
	},
	"schematic-map": {
		cover: STANDARD_COVER,
		day: {
			body: size(128, 94),
			heading: size(128, 24),
			headingOrientation: "horizontal",
			heroSlot: null,
			image: null,
			participationLanes: [],
			splitHero: null,
		},
		standardCompositionId: "concept-route",
	},
	ledger: {
		cover: STANDARD_COVER,
		day: {
			body: size(128, 142),
			heading: size(128, 24),
			headingOrientation: "horizontal",
			heroSlot: null,
			image: null,
			participationLanes: [],
			splitHero: null,
		},
		standardCompositionId: "timetable",
	},
};

/** Lane widths come from 25.4: stamp takes the right 24mm, checklist the left 6mm. */
export const PARTICIPATION_LANE_WIDTH_MM: Readonly<
	Record<ParticipationLaneId, number>
> = { checklist: 6, stamp: 24 };

export function coversPrincipalArt(region: RegionSize | null): boolean {
	return (
		region !== null &&
		region.widthMm >= PRINCIPAL_ART_MINIMUM.widthMm &&
		region.heightMm >= PRINCIPAL_ART_MINIMUM.heightMm
	);
}
