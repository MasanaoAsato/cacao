import type { ScenePaginator } from "../model";
import { VERTICAL_POSTER_DAY_LAYOUT } from "./geometry";
import {
	coverPage,
	requireMeasurementKind,
	structuredBodyPages,
} from "./scenePages";

/** Vertical title and day heading, a large image, a horizontal schedule. */
export const paginateVerticalPosterScene: ScenePaginator<"vertical-poster"> = (
	spec,
	measurement,
) => {
	const scene = spec.scene;
	if (scene.kind === "cover") {
		requireMeasurementKind(spec, measurement, "cover");
		return {
			moduleId: "vertical-poster",
			pages: [coverPage(spec, measurement, scene.config.compositionId)],
			sceneId: scene.sceneId,
		};
	}
	requireMeasurementKind(spec, measurement, "day");
	return {
		moduleId: "vertical-poster",
		pages: structuredBodyPages(spec, measurement, {
			compositionId: scene.config.compositionId,
			continuationCapacityMm:
				VERTICAL_POSTER_DAY_LAYOUT.continuation.body.heightMm,
			firstCapacityMm: VERTICAL_POSTER_DAY_LAYOUT.first.body.heightMm,
		}),
		sceneId: scene.sceneId,
	};
};
