import { MODULE_CAPABILITIES } from "../../../../booklet/program/moduleCapabilities";
import {
	SCHEMATIC_DAY_LAYOUT,
	SCHEMATIC_MAX_NODES,
	STANDARD_COVER_GEOMETRY,
} from "../../../../booklet/program/modules/geometry";
import { paginateSchematicMapScene } from "../../../../booklet/program/modules/schematicMap";
import { BookletLayoutError } from "../../layoutError";
import type { ModuleRegistration } from "../moduleRegistry";
import { ConceptRoute } from "../sceneParts";
import {
	coverOrBody,
	measureStructured,
	StructuredMeasure,
	type StructuredModuleDefinition,
	StructuredPages,
	structuredResources,
} from "../structuredModule";
import "./SchematicMap.css";

const DEFINITION: StructuredModuleDefinition = {
	cover: STANDARD_COVER_GEOMETRY,
	coverHeroSlotId: null,
	dayHeroSlotId: null,
	dayLayout: () => SCHEMATIC_DAY_LAYOUT,
	extra: ({ page }) =>
		page && page.unitIds.length > 0 ? (
			<ConceptRoute
				count={page.unitIds.length}
				firstNumber={page.firstUnitNumber}
				variant="concept-route"
			/>
		) : null,
	verticalCoverTitle: false,
	verticalDayHeading: false,
};

/** schematic-map: numbered concept route and the body in the same order. */
export const SCHEMATIC_MAP_MODULE: ModuleRegistration<"schematic-map"> = {
	capabilities: MODULE_CAPABILITIES["schematic-map"],
	Measure: ({ context, spec }) => (
		<StructuredMeasure context={context} definition={DEFINITION} spec={spec} />
	),
	measure: (root, spec) => coverOrBody(measureStructured(root, spec)),
	moduleId: "schematic-map",
	Pages: ({ assembled, context, spec }) => (
		<StructuredPages
			assembled={assembled}
			context={context}
			definition={DEFINITION}
			spec={spec}
		/>
	),
	paginate: paginateSchematicMapScene,
	resources: structuredResources,
	// Each page's diagram draws exactly the units of that page, at most eight.
	validateOutput: (pages) => {
		for (const page of pages) {
			const diagram = page.querySelector('[data-program-region="extra"]');
			if (!diagram) continue;
			const nodes = diagram.querySelectorAll(".program-route__node").length;
			const units = page.querySelectorAll("[data-unit-id]").length;
			if (nodes > SCHEMATIC_MAX_NODES || nodes !== units) {
				throw new BookletLayoutError(
					"dom-not-ready",
					`概念ルートのノード数（${nodes}）が頁の予定数（${units}）と一致しません。`,
				);
			}
		}
	},
};
