import { paginateTravelNewspaperDays } from "../../families/travelNewspaper";
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
 * travel-newspaper: masthead and two article columns. The newspaper's
 * columns stay its own and are not merged into a shared card body.
 */
export const paginateTravelNewspaperScene: ScenePaginator<
	"travel-newspaper"
> = (spec, measurement) => {
	const scene = spec.scene;
	if (scene.kind === "cover") {
		if (measurement.kind !== "cover")
			throw new PaginationError(
				"invalid-measurement",
				"表紙の計測がありません。",
			);
		return {
			moduleId: "travel-newspaper",
			pages: [coverPage(spec, measurement, scene.config.compositionId)],
			sceneId: scene.sceneId,
		};
	}
	if (measurement.kind === "structured-day")
		return {
			moduleId: "travel-newspaper",
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
	const pages = paginateTravelNewspaperDays(
		sceneBooklet(spec),
		measurement.measurement,
	);
	return {
		moduleId: "travel-newspaper",
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
