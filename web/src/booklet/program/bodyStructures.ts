import type { DirectionModuleId } from "../../theme/directions/types";
import type { PolicyId } from "../editorialModel";
import type { ContentStructureId, ProgramScene } from "./model";
import {
	DEFAULT_UNIT_GAP_MM,
	LEDGER_ROW_GAP_MM,
	QUEST_CHECKLIST_LANE_MM,
	QUEST_PANEL_PADDING_MM,
	QUEST_STAMP_LANE_MM,
	QUEST_UNIT_GAP_MM,
	SCHEMATIC_MAX_NODES,
	SPECIMEN_TEXT_MM,
} from "./modules/geometry";

/** Each module owns its listing policy; a transplanted structure keeps its source's. */
export const MODULE_POLICIES: Readonly<Record<DirectionModuleId, PolicyId>> =
	Object.freeze({
		"atlas-grid": "timetable",
		"editorial-magazine": "captions",
		ledger: "timetable",
		"paper-collage": "captions",
		"photo-essay": "captions",
		"playful-route": "route",
		"quest-board": "captions",
		"schematic-map": "route",
		"specimen-board": "captions",
		"travel-newspaper": "timetable",
		"vertical-poster": "captions",
		"woodcut-folio": "captions",
	});

/** Native bodies of the seven new modules. Extracted families draw their own. */
export type NativeBodyId =
	| "full-width-list"
	| "specimen-columns"
	| "quest-panels"
	| "numbered-route"
	| "ledger-rows";

export type BodyStructureId = NativeBodyId | ContentStructureId;

export type BodyStructure = {
	readonly columns: number;
	readonly gapMm: number;
	/**
	 * Height a structure reserves at the top of every page's body (a route
	 * strip or column headings) before units are placed.
	 */
	readonly headerMm: number;
	readonly id: BodyStructureId;
	readonly maxUnitsPerPage: number | null;
	readonly policyId: PolicyId;
	/** Width the unit text is laid out and measured at. */
	readonly textWidthMm: number;
};

const NATIVE_BODIES: Partial<Record<DirectionModuleId, NativeBodyId>> = {
	ledger: "ledger-rows",
	"photo-essay": "full-width-list",
	"quest-board": "quest-panels",
	"schematic-map": "numbered-route",
	"specimen-board": "specimen-columns",
	"vertical-poster": "full-width-list",
	"woodcut-folio": "full-width-list",
};

/** A transplanted route strip reserves 30mm plus a 6mm gap, like schematic continuation. */
const ROUTE_STRIP_MM = 36;
/** Transplanted ledger columns reserve their 10mm headings plus the 2mm row gap. */
const COLUMN_HEADINGS_MM = 12;

function laneWidthMm(scene: ProgramScene): number {
	if (scene.kind !== "day" || scene.moduleId !== "quest-board") return 0;
	const lane = scene.config.participationLane?.lane;
	if (lane === "stamp") return QUEST_STAMP_LANE_MM;
	if (lane === "checklist") return QUEST_CHECKLIST_LANE_MM;
	return 0;
}

function contentStructure(
	id: ContentStructureId,
	sourceModuleId: DirectionModuleId,
	bodyWidthMm: number,
	laneMm: number,
): BodyStructure {
	const policyId = MODULE_POLICIES[sourceModuleId];
	const textWidthMm = bodyWidthMm - laneMm;
	switch (id) {
		case "concept-route":
		case "route-line":
			return {
				columns: 1,
				gapMm: DEFAULT_UNIT_GAP_MM,
				headerMm: ROUTE_STRIP_MM,
				id,
				maxUnitsPerPage: SCHEMATIC_MAX_NODES,
				policyId,
				textWidthMm,
			};
		case "data-columns":
		case "fixed-columns":
			return {
				columns: 1,
				gapMm: LEDGER_ROW_GAP_MM,
				headerMm: COLUMN_HEADINGS_MM,
				id,
				maxUnitsPerPage: null,
				policyId,
				textWidthMm,
			};
		case "cards":
		case "stage-panels":
			return {
				columns: 1,
				gapMm: QUEST_UNIT_GAP_MM,
				headerMm: 0,
				id,
				maxUnitsPerPage: null,
				policyId,
				textWidthMm,
			};
		case "timeline":
		case "board-squares":
		case "category-bands":
			return {
				columns: 1,
				gapMm: DEFAULT_UNIT_GAP_MM,
				headerMm: 0,
				id,
				maxUnitsPerPage: null,
				policyId,
				textWidthMm,
			};
	}
}

function nativeStructure(
	id: NativeBodyId,
	moduleId: DirectionModuleId,
	laneMm: number,
): BodyStructure {
	const policyId = MODULE_POLICIES[moduleId];
	switch (id) {
		case "full-width-list":
			return {
				columns: 1,
				gapMm: DEFAULT_UNIT_GAP_MM,
				headerMm: 0,
				id,
				maxUnitsPerPage: null,
				policyId,
				textWidthMm: 128,
			};
		case "specimen-columns":
			return {
				columns: 2,
				gapMm: DEFAULT_UNIT_GAP_MM,
				headerMm: 0,
				id,
				maxUnitsPerPage: null,
				policyId,
				textWidthMm: SPECIMEN_TEXT_MM,
			};
		case "quest-panels":
			return {
				columns: 1,
				gapMm: QUEST_UNIT_GAP_MM,
				headerMm: 0,
				id,
				maxUnitsPerPage: null,
				policyId,
				textWidthMm: 128 - 2 * QUEST_PANEL_PADDING_MM - laneMm,
			};
		case "numbered-route":
			return {
				columns: 1,
				gapMm: DEFAULT_UNIT_GAP_MM,
				headerMm: 0,
				id,
				maxUnitsPerPage: SCHEMATIC_MAX_NODES,
				policyId,
				textWidthMm: 128,
			};
		case "ledger-rows":
			return {
				columns: 1,
				gapMm: LEDGER_ROW_GAP_MM,
				headerMm: 0,
				id,
				maxUnitsPerPage: null,
				policyId,
				textWidthMm: 128,
			};
	}
}

/**
 * The body a day scene draws. `bodyWidthMm` is the module's body width; for
 * extracted families it is read from their DOM. Returns null for an
 * extracted family drawing its own native body.
 */
export function bodyStructureFor(
	scene: ProgramScene,
	bodyWidthMm = 128,
): BodyStructure | null {
	const laneMm = laneWidthMm(scene);
	const structure = scene.config.contentStructure;
	if (scene.kind === "day" && structure)
		return contentStructure(
			structure.structure,
			structure.sourceModuleId,
			bodyWidthMm,
			laneMm,
		);
	const native = NATIVE_BODIES[scene.moduleId];
	return native ? nativeStructure(native, scene.moduleId, laneMm) : null;
}

/** schematic-map always splits by its diagram's node limit as well as height. */
export function maxUnitsPerPage(scene: ProgramScene): number | null {
	if (scene.moduleId === "schematic-map") return SCHEMATIC_MAX_NODES;
	return bodyStructureFor(scene)?.maxUnitsPerPage ?? null;
}

export function policyForScene(scene: ProgramScene): PolicyId {
	if (scene.kind === "day" && scene.config.contentStructure)
		return MODULE_POLICIES[scene.config.contentStructure.sourceModuleId];
	return MODULE_POLICIES[scene.moduleId];
}
