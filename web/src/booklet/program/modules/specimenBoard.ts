import type { ScenePaginator } from "../model";
import { SPECIMEN_DAY_LAYOUT } from "./geometry";
import { requireMeasurementKind, structuredBodyPages } from "./scenePages";

/** Two 61mm columns, left top to bottom first. It has no cover (definition error). */
export const paginateSpecimenBoardScene: ScenePaginator<"specimen-board"> = (
	spec,
	measurement,
) => {
	const scene = spec.scene;
	if (scene.kind !== "day") {
		throw new Error("specimen-boardは表紙を描けません（定義エラー）。");
	}
	requireMeasurementKind(spec, measurement, "day");
	return {
		moduleId: "specimen-board",
		pages: structuredBodyPages(spec, measurement, {
			compositionId: scene.config.compositionId,
			continuationCapacityMm: SPECIMEN_DAY_LAYOUT.continuation.body.heightMm,
			firstCapacityMm: SPECIMEN_DAY_LAYOUT.first.body.heightMm,
		}),
		sceneId: scene.sceneId,
	};
};
