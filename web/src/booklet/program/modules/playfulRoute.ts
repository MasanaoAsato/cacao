import { paginatePlayfulRouteDays } from "../../families/playfulRoute";
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
 * playful-route cover and day. The block fallback (selected →
 * compact-header → wide-ribbon) is chosen over the scene's own units, and
 * each page keeps its measured block heights to draw the route.
 */
export const paginatePlayfulRouteScene: ScenePaginator<"playful-route"> = (
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
			moduleId: "playful-route",
			pages: [coverPage(spec, measurement, scene.config.compositionId)],
			sceneId: scene.sceneId,
		};
	}
	if (measurement.kind === "structured-day")
		return {
			moduleId: "playful-route",
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
	const days = paginatePlayfulRouteDays(
		sceneBooklet(spec),
		measurement.measurement,
	);
	return {
		moduleId: "playful-route",
		pages: localBodyPages(
			spec,
			days.map((day) => ({
				columns: [day.unitIndexes],
				continuation: day.continuation,
				unitHeightsMm: day.blockHeightsMm,
			})),
			scene.config.compositionId,
			days[0]?.layoutVariant ?? null,
		),
		sceneId: scene.sceneId,
	};
};
