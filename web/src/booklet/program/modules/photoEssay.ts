import type { ScenePaginator } from "../model";
import { PHOTO_ESSAY_DAY_LAYOUT } from "./geometry";
import {
	coverPage,
	requireMeasurementKind,
	structuredBodyPages,
} from "./scenePages";

/**
 * One large plate and a separate full-width list. A later scene of the same
 * day has no illustration and uses the continuation composition from its
 * first page on.
 */
export const paginatePhotoEssayScene: ScenePaginator<"photo-essay"> = (
	spec,
	measurement,
) => {
	const scene = spec.scene;
	if (scene.kind === "cover") {
		requireMeasurementKind(spec, measurement, "cover");
		return {
			moduleId: "photo-essay",
			pages: [coverPage(spec, measurement, scene.config.compositionId)],
			sceneId: scene.sceneId,
		};
	}
	requireMeasurementKind(spec, measurement, "day");
	const continuation = PHOTO_ESSAY_DAY_LAYOUT.continuation.body.heightMm;
	return {
		moduleId: "photo-essay",
		pages: structuredBodyPages(spec, measurement, {
			compositionId: scene.showIllustration
				? scene.config.compositionId
				: "continuation",
			continuationCapacityMm: continuation,
			firstCapacityMm: scene.showIllustration
				? PHOTO_ESSAY_DAY_LAYOUT.first.body.heightMm
				: continuation,
		}),
		sceneId: scene.sceneId,
	};
};
