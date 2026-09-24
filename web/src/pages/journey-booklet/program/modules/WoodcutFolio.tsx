import { MODULE_CAPABILITIES } from "../../../../booklet/program/moduleCapabilities";
import {
	WOODCUT_COVER_GEOMETRY,
	WOODCUT_DAY_LAYOUT,
} from "../../../../booklet/program/modules/geometry";
import { paginateWoodcutFolioScene } from "../../../../booklet/program/modules/woodcutFolio";
import type { ModuleRegistration } from "../moduleRegistry";
import {
	measureStructured,
	noModuleChecks,
	StructuredMeasure,
	type StructuredModuleDefinition,
	StructuredPages,
	structuredResources,
} from "../structuredModule";
import "./WoodcutFolio.css";

const DEFINITION: StructuredModuleDefinition = {
	cover: WOODCUT_COVER_GEOMETRY,
	coverHeroSlotId: "cover-hero",
	dayHeroSlotId: "day-art",
	dayLayout: () => WOODCUT_DAY_LAYOUT,
	verticalCoverTitle: false,
	verticalDayHeading: false,
};

/**
 * woodcut-folio: large carved faces, margins and frameless full-width text.
 * It also draws every divider, memo and endcap in the contributing style.
 */
export const WOODCUT_FOLIO_MODULE: ModuleRegistration<"woodcut-folio"> = {
	capabilities: MODULE_CAPABILITIES["woodcut-folio"],
	Measure: ({ context, spec }) => (
		<StructuredMeasure context={context} definition={DEFINITION} spec={spec} />
	),
	measure: (root, spec) => measureStructured(root, spec),
	moduleId: "woodcut-folio",
	Pages: ({ assembled, context, spec }) => (
		<StructuredPages
			assembled={assembled}
			context={context}
			definition={DEFINITION}
			spec={spec}
		/>
	),
	paginate: paginateWoodcutFolioScene,
	resources: structuredResources,
	validateOutput: noModuleChecks,
};
