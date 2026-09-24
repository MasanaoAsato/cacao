/**
 * The four basic verification works of 25.4, built as programs for tests and
 * the comparison fixture. They are not a second catalog: the compiler never
 * selects them, and 1–4 styles here are examples, not product limits.
 */
import type { ArtworkTouchId } from "../../theme/artwork/types";
import type {
	BasicWorkStyleId,
	DirectionId,
	DirectionModuleId,
} from "../../theme/directions/types";
import type { BookletModel } from "../model";
import type {
	ArtworkBinding,
	BookletProgram,
	CommonSceneConfig,
	EffectClaim,
	ModuleSceneBinding,
	ProgramScene,
} from "./model";
import {
	HEADING_MINIMUM,
	MODULE_CAPABILITIES,
	type RegionSize,
} from "./moduleCapabilities";

export type BasicWorkId =
	| "woodcut-journey"
	| "rail-sketchbook"
	| "specimen-scrapbook"
	| "changing-chapters";

export const BASIC_WORK_IDS: readonly BasicWorkId[] = [
	"woodcut-journey",
	"rail-sketchbook",
	"specimen-scrapbook",
	"changing-chapters",
];

/** One scene look: a module, its composition, style and frozen artwork. */
type Look = {
	readonly art: readonly {
		readonly assetId: string;
		readonly role: ArtworkBinding["role"];
		readonly slotId: string;
		readonly touchId: ArtworkTouchId;
	}[];
	readonly compositionId: string;
	/** The existing direction whose drawing this look stands for. */
	readonly directionId: DirectionId;
	readonly moduleId: DirectionModuleId;
	readonly styleBundleId: BasicWorkStyleId | "play";
	readonly styleProfileId: string | null;
	readonly touch: ArtworkTouchId | "none";
};

const WOODCUT_COVER: Look = {
	art: [
		{
			assetId: "woodcut-mountain-hero-r1",
			role: "hero",
			slotId: "cover-hero",
			touchId: "woodcut",
		},
	],
	compositionId: "folio",
	directionId: "wa-modern",
	moduleId: "woodcut-folio",
	styleBundleId: "woodcut-journey",
	styleProfileId: null,
	touch: "woodcut",
};

const WOODCUT_DAY: Look = {
	...WOODCUT_COVER,
	art: [
		{
			assetId: "woodcut-leaf-medium-r1",
			role: "medium",
			slotId: "day-art",
			touchId: "woodcut",
		},
	],
};

/** Pencil notebook over an exact timetable; no text sits in any SVG. */
const RAIL: Look = {
	art: [],
	compositionId: "side-index",
	directionId: "travel-note",
	moduleId: "atlas-grid",
	styleBundleId: "rail-sketchbook",
	styleProfileId: null,
	touch: "pencil",
};

const SPECIMEN_COVER: Look = {
	art: [],
	compositionId: "photo-left",
	directionId: "nordic",
	moduleId: "paper-collage",
	styleBundleId: "specimen-scrapbook",
	styleProfileId: null,
	touch: "cut-paper",
};

const SPECIMEN_DAY: Look = {
	art: [
		{
			assetId: "engraving-leaf-medium-r1",
			role: "medium",
			slotId: "specimen",
			touchId: "engraving",
		},
	],
	compositionId: "two-column",
	directionId: "encyclopedia",
	moduleId: "specimen-board",
	styleBundleId: "specimen-scrapbook",
	styleProfileId: null,
	touch: "engraving",
};

/** The existing playful-route.playful-pop profile with its zigzag composition. */
const PLAYFUL_POP: Look = {
	art: [],
	compositionId: "zigzag",
	directionId: "board-game",
	moduleId: "playful-route",
	styleBundleId: "play",
	styleProfileId: "playful-route.playful-pop",
	touch: "cut-paper",
};

function commonConfig(look: Look): CommonSceneConfig {
	return {
		bindings: look.art.map((art) => ({
			assetId: art.assetId,
			directionId: look.directionId,
			role: art.role,
			slotId: art.slotId,
			touchId: art.touchId,
			viewId: null,
		})),
		compositionId: look.compositionId,
		contentStructure: null,
		heading: {
			directionId: look.directionId,
			orientation: "horizontal",
			styleBundleId: look.styleBundleId,
			system: null,
		},
		imageTreatment: null,
		numberedEntries: look.moduleId === "specimen-board",
		surface: {
			directionId: look.directionId,
			localePackId: null,
			styleBundleId: look.styleBundleId,
			touch: look.touch === "none" ? "none" : look.touch,
		},
	};
}

function binding(look: Look): ModuleSceneBinding {
	const common = commonConfig(look);
	switch (look.moduleId) {
		case "atlas-grid":
		case "editorial-magazine":
		case "paper-collage":
		case "travel-newspaper":
			return {
				config: { ...common, styleProfileId: look.styleProfileId },
				moduleId: look.moduleId,
			};
		case "playful-route":
			return {
				config: {
					...common,
					dayHeader: null,
					styleProfileId: look.styleProfileId,
				},
				moduleId: "playful-route",
			};
		case "woodcut-folio":
			return {
				config: { ...common, minimalDecoration: false },
				moduleId: "woodcut-folio",
			};
		case "specimen-board":
		case "schematic-map":
		case "vertical-poster":
			return { config: common, moduleId: look.moduleId };
		case "ledger":
			return {
				config: { ...common, ledgerHeading: null },
				moduleId: "ledger",
			};
		case "photo-essay":
			return {
				config: { ...common, heroSplit: false },
				moduleId: "photo-essay",
			};
		case "quest-board":
			return {
				config: { ...common, dayHeader: null, participationLane: null },
				moduleId: "quest-board",
			};
	}
}

function claim(
	look: Look,
	sceneId: string,
	kind: EffectClaim["kind"],
	regionId: string,
	size: RegionSize,
): EffectClaim {
	return {
		directionId: look.directionId,
		kind,
		minimumHeightMm: size.heightMm,
		minimumWidthMm: size.widthMm,
		regionId,
		sceneId,
	};
}

function artClaims(look: Look, sceneId: string): readonly EffectClaim[] {
	const capability = MODULE_CAPABILITIES[look.moduleId];
	return look.art.flatMap((art) => {
		const slot =
			capability.cover?.heroSlot?.slotId === art.slotId
				? capability.cover.heroSlot
				: capability.day.heroSlot?.slotId === art.slotId
					? capability.day.heroSlot
					: null;
		return slot ? [claim(look, sceneId, "hero-art", "hero", slot)] : [];
	});
}

function coverScene(look: Look): ProgramScene {
	const capability = MODULE_CAPABILITIES[look.moduleId].cover;
	if (!capability) throw new Error(`${look.moduleId}は表紙を描けません。`);
	return {
		...binding(look),
		effects: [
			claim(look, "cover", "body-structure", "cover", capability.image),
			claim(look, "cover", "heading", "heading", HEADING_MINIMUM),
			...artClaims(look, "cover"),
		],
		kind: "cover",
		sceneId: "cover",
	};
}

function dayScene(
	look: Look,
	day: BookletModel["days"][number],
	chapter: boolean,
): ProgramScene {
	const sceneId = `day:${day.id}`;
	return {
		...binding(look),
		dayId: day.id,
		effects: [
			claim(
				look,
				sceneId,
				chapter ? "chapter" : "body-structure",
				"body",
				MODULE_CAPABILITIES[look.moduleId].day.body,
			),
			claim(look, sceneId, "heading", "heading", HEADING_MINIMUM),
			...artClaims(look, sceneId),
		],
		kind: "day",
		sceneId,
		section: null,
		showIllustration: true,
		unitIds: day.units.map((unit) => unit.id),
	};
}

const CHAPTER_CYCLE: readonly Look[] = [
	WOODCUT_DAY,
	RAIL,
	SPECIMEN_DAY,
	PLAYFUL_POP,
];

export function basicWorkProgram(
	workId: BasicWorkId,
	model: BookletModel,
	options: { readonly catalogRevision: string; readonly seed: string },
): BookletProgram {
	const looks = (() => {
		switch (workId) {
			case "woodcut-journey":
				return { cover: WOODCUT_COVER, day: () => WOODCUT_DAY };
			case "rail-sketchbook":
				return { cover: RAIL, day: () => RAIL };
			case "specimen-scrapbook":
				return { cover: SPECIMEN_COVER, day: () => SPECIMEN_DAY };
			case "changing-chapters":
				return {
					cover: WOODCUT_COVER,
					// Days cycle in input order; continuation pages keep their day's look.
					day: (index: number) =>
						CHAPTER_CYCLE[index % CHAPTER_CYCLE.length] ?? WOODCUT_DAY,
				};
		}
	})();
	return {
		baseDirectionId: looks.cover.directionId,
		catalogRevision: options.catalogRevision,
		scenes: [
			coverScene(looks.cover),
			...model.days.map((day, index) =>
				dayScene(looks.day(index), day, workId === "changing-chapters"),
			),
		],
		seed: options.seed,
	};
}
