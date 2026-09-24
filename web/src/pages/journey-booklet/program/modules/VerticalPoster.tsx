import { MODULE_CAPABILITIES } from "../../../../booklet/program/moduleCapabilities";
import {
	VERTICAL_POSTER_COVER_GEOMETRY,
	VERTICAL_POSTER_DAY_LAYOUT,
} from "../../../../booklet/program/modules/geometry";
import { paginateVerticalPosterScene } from "../../../../booklet/program/modules/verticalPoster";
import { BookletLayoutError } from "../../layoutError";
import type { ModuleRegistration } from "../moduleRegistry";
import {
	coverOrBody,
	measureStructured,
	StructuredMeasure,
	type StructuredModuleDefinition,
	StructuredPages,
	structuredResources,
} from "../structuredModule";
import "./VerticalPoster.css";

const DEFINITION: StructuredModuleDefinition = {
	cover: VERTICAL_POSTER_COVER_GEOMETRY,
	coverHeroSlotId: null,
	dayHeroSlotId: null,
	dayLayout: () => VERTICAL_POSTER_DAY_LAYOUT,
	verticalCoverTitle: true,
	verticalDayHeading: true,
};

/** vertical-poster: vertical title, a large picture, a horizontal schedule. */
export const VERTICAL_POSTER_MODULE: ModuleRegistration<"vertical-poster"> = {
	capabilities: MODULE_CAPABILITIES["vertical-poster"],
	Measure: ({ context, spec }) => (
		<StructuredMeasure context={context} definition={DEFINITION} spec={spec} />
	),
	measure: (root, spec) => coverOrBody(measureStructured(root, spec)),
	moduleId: "vertical-poster",
	Pages: ({ assembled, context, spec }) => (
		<StructuredPages
			assembled={assembled}
			context={context}
			definition={DEFINITION}
			spec={spec}
		/>
	),
	paginate: paginateVerticalPosterScene,
	resources: structuredResources,
	// Only headings are vertical; the schedule stays horizontal.
	validateOutput: (pages) => {
		for (const page of pages) {
			for (const unit of page.querySelectorAll<HTMLElement>(".program-unit")) {
				if (getComputedStyle(unit).writingMode.startsWith("vertical")) {
					throw new BookletLayoutError(
						"hidden-text",
						"縦ポスターの予定欄が縦書きになっています。",
					);
				}
			}
		}
	},
};
