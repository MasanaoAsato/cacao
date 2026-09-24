import { MODULE_CAPABILITIES } from "../../../../booklet/program/moduleCapabilities";
import {
	LEDGER_DAY_LAYOUT,
	STANDARD_COVER_GEOMETRY,
} from "../../../../booklet/program/modules/geometry";
import { paginateLedgerScene } from "../../../../booklet/program/modules/ledger";
import type { ModuleRegistration } from "../moduleRegistry";
import { LedgerColumnHeadings } from "../sceneParts";
import {
	coverOrBody,
	measureStructured,
	noModuleChecks,
	StructuredMeasure,
	type StructuredModuleDefinition,
	StructuredPages,
	structuredResources,
} from "../structuredModule";
import "./Ledger.css";

const DEFINITION: StructuredModuleDefinition = {
	cover: STANDARD_COVER_GEOMETRY,
	coverHeroSlotId: null,
	dayHeroSlotId: null,
	dayLayout: () => LEDGER_DAY_LAYOUT,
	// The column headings belong to the native rows; a transplanted structure draws its own.
	extra: ({ spec }) =>
		spec.scene.config.contentStructure ? null : <LedgerColumnHeadings />,
	verticalCoverTitle: false,
	verticalDayHeading: false,
};

/** ledger: aligned time, transport, name and cost columns on every page. */
export const LEDGER_MODULE: ModuleRegistration<"ledger"> = {
	capabilities: MODULE_CAPABILITIES.ledger,
	Measure: ({ context, spec }) => (
		<StructuredMeasure context={context} definition={DEFINITION} spec={spec} />
	),
	measure: (root, spec) => coverOrBody(measureStructured(root, spec)),
	moduleId: "ledger",
	Pages: ({ assembled, context, spec }) => (
		<StructuredPages
			assembled={assembled}
			context={context}
			definition={DEFINITION}
			spec={spec}
		/>
	),
	paginate: paginateLedgerScene,
	resources: structuredResources,
	validateOutput: noModuleChecks,
};
