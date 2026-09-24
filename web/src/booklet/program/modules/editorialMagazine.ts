import { paginateEditorialMagazineDays } from "../../families/editorialMagazine";
import { PaginationError } from "../../paginationError";
import type { ScenePaginator } from "../model";
import {
	coverPage,
	localBodyPages,
	requireFamilyDay,
	sceneBooklet,
	structuredFamilyPages,
} from "./scenePages";

/** editorial-magazine: the photo feature and its article cards, one day per scene. */
export const paginateEditorialMagazineScene: ScenePaginator<
	"editorial-magazine"
> = (spec, measurement) => {
	const scene = spec.scene;
	if (scene.kind === "cover") {
		if (measurement.kind !== "cover")
			throw new PaginationError(
				"invalid-measurement",
				"表紙の計測がありません。",
			);
		return {
			moduleId: "editorial-magazine",
			pages: [coverPage(spec, measurement, scene.config.compositionId)],
			sceneId: scene.sceneId,
		};
	}
	if (measurement.kind === "structured-day")
		return {
			moduleId: "editorial-magazine",
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
	const pages = paginateEditorialMagazineDays(
		sceneBooklet(spec),
		measurement.measurement,
	);
	return {
		moduleId: "editorial-magazine",
		pages: localBodyPages(
			spec,
			pages.flatMap((page) =>
				page.kind === "cover"
					? []
					: [
							{
								columns: [page.unitIndexes],
								continuation: page.kind === "continuation",
								unitHeightsMm: null,
							},
						],
			),
			scene.config.compositionId,
			null,
		),
		sceneId: scene.sceneId,
	};
};
