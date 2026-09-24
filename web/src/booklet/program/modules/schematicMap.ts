import type { ScenePaginator } from "../model";
import { SCHEMATIC_DAY_LAYOUT } from "./geometry";
import {
	coverPage,
	requireMeasurementKind,
	structuredBodyPages,
} from "./scenePages";

/**
 * A numbered concept route (not a map) and the numbered body in the same
 * order. Pages split by height and by the eight-node diagram limit.
 */
export const paginateSchematicMapScene: ScenePaginator<"schematic-map"> = (
	spec,
	measurement,
) => {
	const scene = spec.scene;
	if (scene.kind === "cover") {
		requireMeasurementKind(spec, measurement, "cover");
		return {
			moduleId: "schematic-map",
			pages: [coverPage(spec, measurement, scene.config.compositionId)],
			sceneId: scene.sceneId,
		};
	}
	requireMeasurementKind(spec, measurement, "day");
	return {
		moduleId: "schematic-map",
		pages: structuredBodyPages(spec, measurement, {
			compositionId: scene.config.compositionId,
			continuationCapacityMm: SCHEMATIC_DAY_LAYOUT.continuation.body.heightMm,
			firstCapacityMm: SCHEMATIC_DAY_LAYOUT.first.body.heightMm,
		}),
		sceneId: scene.sceneId,
	};
};
