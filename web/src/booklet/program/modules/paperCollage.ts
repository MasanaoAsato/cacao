import { paginatePaperCollageDays } from "../../families/paperCollage";
import { PaginationError } from "../../paginationError";
import type { ScenePaginator } from "../model";
import {
	coverPage,
	localBodyPages,
	requireFamilyDay,
	sceneBooklet,
	structuredFamilyPages,
} from "./scenePages";

/**
 * paper-collage cover and day. The family's card fallback (selected →
 * compact-header → wide-cards) is chosen over the scene's own units.
 */
export const paginatePaperCollageScene: ScenePaginator<"paper-collage"> = (
	spec,
	measurement,
) => {
	const scene = spec.scene;
	if (scene.kind === "cover") {
		if (measurement.kind !== "cover")
			throw new PaginationError(
				"invalid-measurement",
				"表紙の計測がありません。",
			);
		return {
			moduleId: "paper-collage",
			pages: [coverPage(spec, measurement, scene.config.compositionId)],
			sceneId: scene.sceneId,
		};
	}
	if (measurement.kind === "structured-day")
		return {
			moduleId: "paper-collage",
			pages: structuredFamilyPages(
				spec,
				measurement,
				scene.config.compositionId,
			),
			sceneId: scene.sceneId,
		};
	if (measurement.kind !== "day")
		throw new PaginationError("invalid-measurement", "日の計測がありません。");
	requireFamilyDay(spec, measurement);
	const days = paginatePaperCollageDays(
		sceneBooklet(spec),
		measurement.measurement,
	);
	return {
		moduleId: "paper-collage",
		pages: localBodyPages(
			spec,
			days.map((day) => ({
				columns: day.columns,
				continuation: day.continuation,
				unitHeightsMm: null,
			})),
			scene.config.compositionId,
			days[0]?.layoutVariant ?? null,
		),
		sceneId: scene.sceneId,
	};
};
