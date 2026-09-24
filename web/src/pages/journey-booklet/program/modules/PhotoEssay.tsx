import { MODULE_CAPABILITIES } from "../../../../booklet/program/moduleCapabilities";
import {
	PHOTO_ESSAY_DAY_LAYOUT,
	PHOTO_ESSAY_SPLIT_FIRST,
	STANDARD_COVER_GEOMETRY,
} from "../../../../booklet/program/modules/geometry";
import { paginatePhotoEssayScene } from "../../../../booklet/program/modules/photoEssay";
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
import "./PhotoEssay.css";

const DEFINITION: StructuredModuleDefinition = {
	cover: STANDARD_COVER_GEOMETRY,
	coverHeroSlotId: null,
	dayHeroSlotId: "hero",
	// The image + hero split keeps the body where it was.
	dayLayout: (scene) =>
		"heroSplit" in scene.config && scene.config.heroSplit
			? { ...PHOTO_ESSAY_DAY_LAYOUT, first: PHOTO_ESSAY_SPLIT_FIRST }
			: PHOTO_ESSAY_DAY_LAYOUT,
	verticalCoverTitle: false,
	verticalDayHeading: false,
};

/** photo-essay: one large plate, then an independent full-width list. */
export const PHOTO_ESSAY_MODULE: ModuleRegistration<"photo-essay"> = {
	capabilities: MODULE_CAPABILITIES["photo-essay"],
	Measure: ({ context, spec }) => (
		<StructuredMeasure context={context} definition={DEFINITION} spec={spec} />
	),
	measure: (root, spec) => coverOrBody(measureStructured(root, spec)),
	moduleId: "photo-essay",
	Pages: ({ assembled, context, spec }) => (
		<StructuredPages
			assembled={assembled}
			context={context}
			definition={DEFINITION}
			spec={spec}
		/>
	),
	paginate: paginatePhotoEssayScene,
	resources: structuredResources,
	validateOutput: noModuleChecks,
};
