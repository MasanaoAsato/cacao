import type { ScenePaginator } from "../model";
import { QUEST_BOARD_DAY_LAYOUT } from "./geometry";
import {
	coverPage,
	requireMeasurementKind,
	structuredBodyPages,
} from "./scenePages";

/** Section panels per unit; a stamp or checklist lane narrows the panel text. */
export const paginateQuestBoardScene: ScenePaginator<"quest-board"> = (
	spec,
	measurement,
) => {
	const scene = spec.scene;
	if (scene.kind === "cover") {
		requireMeasurementKind(spec, measurement, "cover");
		return {
			moduleId: "quest-board",
			pages: [coverPage(spec, measurement, scene.config.compositionId)],
			sceneId: scene.sceneId,
		};
	}
	requireMeasurementKind(spec, measurement, "day");
	return {
		moduleId: "quest-board",
		pages: structuredBodyPages(spec, measurement, {
			compositionId: scene.config.compositionId,
			continuationCapacityMm: QUEST_BOARD_DAY_LAYOUT.continuation.body.heightMm,
			firstCapacityMm: QUEST_BOARD_DAY_LAYOUT.first.body.heightMm,
		}),
		sceneId: scene.sceneId,
	};
};
