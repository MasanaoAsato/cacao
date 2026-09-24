import type { ScenePaginator } from "../model";
import { LEDGER_DAY_LAYOUT } from "./geometry";
import {
	coverPage,
	requireMeasurementKind,
	structuredBodyPages,
} from "./scenePages";

/** Aligned time, transport, name and cost columns; the same body on every page. */
export const paginateLedgerScene: ScenePaginator<"ledger"> = (
	spec,
	measurement,
) => {
	const scene = spec.scene;
	if (scene.kind === "cover") {
		requireMeasurementKind(spec, measurement, "cover");
		return {
			moduleId: "ledger",
			pages: [coverPage(spec, measurement, scene.config.compositionId)],
			sceneId: scene.sceneId,
		};
	}
	requireMeasurementKind(spec, measurement, "day");
	return {
		moduleId: "ledger",
		pages: structuredBodyPages(spec, measurement, {
			compositionId: scene.config.compositionId,
			continuationCapacityMm: LEDGER_DAY_LAYOUT.continuation.body.heightMm,
			firstCapacityMm: LEDGER_DAY_LAYOUT.first.body.heightMm,
		}),
		sceneId: scene.sceneId,
	};
};
