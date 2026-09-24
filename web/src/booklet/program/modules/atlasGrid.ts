import { paginateAtlasGridTables } from "../../families/atlasGrid";
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
 * atlas-grid cover and day, extracted from the family. A day scene is the
 * family's table narrowed to the scene's one day, so it never shares a page
 * with another day.
 */
export const paginateAtlasGridScene: ScenePaginator<"atlas-grid"> = (
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
			moduleId: "atlas-grid",
			pages: [coverPage(spec, measurement, scene.config.compositionId)],
			sceneId: scene.sceneId,
		};
	}
	if (measurement.kind === "structured-day")
		return {
			moduleId: "atlas-grid",
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
	const tables = paginateAtlasGridTables(
		sceneBooklet(spec),
		measurement.measurement,
	);
	return {
		moduleId: "atlas-grid",
		pages: localBodyPages(
			spec,
			tables.map((table, index) => ({
				columns: [table.sections.flatMap((section) => section.unitIndexes)],
				continuation: index > 0,
				unitHeightsMm: null,
			})),
			scene.config.compositionId,
			null,
		),
		sceneId: scene.sceneId,
	};
};
