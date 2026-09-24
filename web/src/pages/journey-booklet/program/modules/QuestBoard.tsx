import { MODULE_CAPABILITIES } from "../../../../booklet/program/moduleCapabilities";
import {
	QUEST_BOARD_DAY_LAYOUT,
	STANDARD_COVER_GEOMETRY,
} from "../../../../booklet/program/modules/geometry";
import { paginateQuestBoardScene } from "../../../../booklet/program/modules/questBoard";
import type { ModuleRegistration } from "../moduleRegistry";
import {
	coverOrBody,
	measureStructured,
	noModuleChecks,
	StructuredMeasure,
	type StructuredModuleDefinition,
	StructuredPages,
	structuredResources,
} from "../structuredModule";
import "./QuestBoard.css";

const DEFINITION: StructuredModuleDefinition = {
	cover: STANDARD_COVER_GEOMETRY,
	coverHeroSlotId: null,
	dayHeroSlotId: "hero",
	dayLayout: () => QUEST_BOARD_DAY_LAYOUT,
	verticalCoverTitle: false,
	verticalDayHeading: false,
};

/** quest-board: section headings across the page, one panel per unit, lanes. */
export const QUEST_BOARD_MODULE: ModuleRegistration<"quest-board"> = {
	capabilities: MODULE_CAPABILITIES["quest-board"],
	Measure: ({ context, spec }) => (
		<StructuredMeasure context={context} definition={DEFINITION} spec={spec} />
	),
	measure: (root, spec) => coverOrBody(measureStructured(root, spec)),
	moduleId: "quest-board",
	Pages: ({ assembled, context, spec }) => (
		<StructuredPages
			assembled={assembled}
			context={context}
			definition={DEFINITION}
			spec={spec}
		/>
	),
	paginate: paginateQuestBoardScene,
	resources: structuredResources,
	validateOutput: noModuleChecks,
};
