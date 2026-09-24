import { MODULE_CAPABILITIES } from "../../../../booklet/program/moduleCapabilities";
import { SPECIMEN_DAY_LAYOUT } from "../../../../booklet/program/modules/geometry";
import { paginateSpecimenBoardScene } from "../../../../booklet/program/modules/specimenBoard";
import type { ModuleRegistration } from "../moduleRegistry";
import {
	bodyOnly,
	measureStructured,
	noModuleChecks,
	StructuredMeasure,
	type StructuredModuleDefinition,
	StructuredPages,
	structuredResources,
} from "../structuredModule";
import "./SpecimenBoard.css";

const DEFINITION: StructuredModuleDefinition = {
	cover: null,
	coverHeroSlotId: null,
	dayHeroSlotId: "specimen",
	dayLayout: () => SPECIMEN_DAY_LAYOUT,
	verticalCoverTitle: false,
	verticalDayHeading: false,
};

/** specimen-board: a two-column specimen sheet; day scenes only. */
export const SPECIMEN_BOARD_MODULE: ModuleRegistration<"specimen-board"> = {
	capabilities: MODULE_CAPABILITIES["specimen-board"],
	Measure: ({ context, spec }) => (
		<StructuredMeasure context={context} definition={DEFINITION} spec={spec} />
	),
	measure: (root, spec) => bodyOnly(measureStructured(root, spec)),
	moduleId: "specimen-board",
	Pages: ({ assembled, context, spec }) => (
		<StructuredPages
			assembled={assembled}
			context={context}
			definition={DEFINITION}
			spec={spec}
		/>
	),
	paginate: paginateSpecimenBoardScene,
	resources: structuredResources,
	validateOutput: noModuleChecks,
};
