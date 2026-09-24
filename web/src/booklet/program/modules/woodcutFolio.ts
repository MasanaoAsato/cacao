import { PaginationError } from "../../paginationError";
import type {
	ExtraLocalPage,
	ExtraMeasurement,
	ScenePaginator,
	SceneSpec,
} from "../model";
import { flowPageUnitIndexes, flowUnits } from "./flow";
import {
	EXTRA_PAGE_BODY_RECT,
	MEMO_ENTRY_GAP_MM,
	WOODCUT_DAY_LAYOUT,
} from "./geometry";
import {
	coverPage,
	requireMeasurementKind,
	requireSameStyle,
	requireTitleFits,
	structuredBodyPages,
} from "./scenePages";

function extraPage(
	kind: ExtraLocalPage["kind"],
	localPageId: string,
	unitRefs: readonly string[],
): ExtraLocalPage {
	return Object.freeze({
		compositionId: kind,
		kind,
		localPageId,
		unitIds: Object.freeze([]),
		unitRefs: Object.freeze([...unitRefs]),
	});
}

/**
 * A memo lists "訪問：名称" with a stamp box, a checkbox or a mission field
 * and splits over pages by measured entry height; memory-album is one page
 * per day with a photo frame and ruled note lines, and lists no entries.
 */
function memoPages(
	spec: SceneSpec<"woodcut-folio">,
	measurement: ExtraMeasurement,
): readonly ExtraLocalPage[] {
	const scene = spec.scene;
	if (scene.kind !== "memo") return [];
	if (scene.participation === "memory-album") {
		if (measurement.entryHeightsMm.length !== 0) {
			throw new PaginationError(
				"invalid-measurement",
				"アルバム頁は参照一覧を計測しません。",
			);
		}
		return [extraPage("memo", "p1", [])];
	}
	const refs = spec.content.referencedUnits;
	if (measurement.entryHeightsMm.length !== refs.length) {
		throw new PaginationError(
			"invalid-measurement",
			`memo「${scene.sceneId}」の参照計測件数が一致しません。`,
		);
	}
	const flow = flowUnits(
		{
			continuationCapacityMm: EXTRA_PAGE_BODY_RECT.heightMm,
			firstCapacityMm: EXTRA_PAGE_BODY_RECT.heightMm,
			gapMm: MEMO_ENTRY_GAP_MM,
			unitHeightsMm: measurement.entryHeightsMm,
		},
		{ columns: 1 },
	);
	return flow.map((page, index) =>
		extraPage(
			"memo",
			`p${index + 1}`,
			flowPageUnitIndexes(page).map((unitIndex) => refs[unitIndex]?.id ?? ""),
		),
	);
}

/**
 * woodcut-folio: frameless full-width body. It also draws every divider,
 * memo and endcap scene in the contributing direction's style (25.4), so no
 * thirteenth module is needed.
 */
export const paginateWoodcutFolioScene: ScenePaginator<"woodcut-folio"> = (
	spec,
	measurement,
) => {
	const scene = spec.scene;
	switch (scene.kind) {
		case "cover":
			requireMeasurementKind(spec, measurement, "cover");
			return {
				moduleId: "woodcut-folio",
				pages: [coverPage(spec, measurement, scene.config.compositionId)],
				sceneId: scene.sceneId,
			};
		case "day": {
			requireMeasurementKind(spec, measurement, "day");
			return {
				moduleId: "woodcut-folio",
				pages: structuredBodyPages(spec, measurement, {
					compositionId: scene.config.compositionId,
					continuationCapacityMm: WOODCUT_DAY_LAYOUT.continuation.body.heightMm,
					firstCapacityMm: WOODCUT_DAY_LAYOUT.first.body.heightMm,
				}),
				sceneId: scene.sceneId,
			};
		}
		case "divider":
		case "endcap":
		case "memo": {
			requireMeasurementKind(spec, measurement, scene.kind);
			requireSameStyle(spec, measurement);
			requireTitleFits(
				measurement.heading,
				scene.kind === "memo" ? "day-header-overflow" : "cover-block-overflow",
				scene.kind === "memo" ? "記入頁の見出し" : "章扉の題名",
			);
			return {
				moduleId: "woodcut-folio",
				pages:
					scene.kind === "memo"
						? memoPages(spec, measurement)
						: [extraPage(scene.kind, "p1", [])],
				sceneId: scene.sceneId,
			};
		}
	}
};
