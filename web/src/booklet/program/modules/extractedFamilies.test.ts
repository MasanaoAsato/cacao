import { describe, expect, it } from "vitest";
import type { AtlasGridMeasurement } from "../../families/atlasGrid";
import type { EditorialMagazineMeasurements } from "../../families/editorialMagazine";
import type { PaperCollageMeasurement } from "../../families/paperCollage";
import type { PlayfulRouteMeasurement } from "../../families/playfulRoute";
import type { TravelNewspaperMeasurements } from "../../families/travelNewspaper";
import type { AnySceneSpec, FamilyDayMeasurement } from "../model";
import {
	compiledProgram,
	coverMeasurement,
	fits,
	moduleSpec,
	specsFor,
} from "../programTestKit";
import { paginateAtlasGridScene } from "./atlasGrid";
import { paginateEditorialMagazineScene } from "./editorialMagazine";
import { paginatePaperCollageScene } from "./paperCollage";
import { paginatePlayfulRouteScene } from "./playfulRoute";
import { paginateTravelNewspaperScene } from "./travelNewspaper";

function familyDay<T>(
	spec: AnySceneSpec,
	measurement: T,
): FamilyDayMeasurement<T> {
	return { heading: fits(), kind: "day", measurement, styleKey: spec.styleKey };
}

describe("既存familyから抽出したmodule", () => {
	it("正常系: atlas-gridの日sceneは自分の一日だけの表を分割し、別の日と頁を共有しない", () => {
		const specs = specsFor(compiledProgram(["travel-note"]));
		const spec = moduleSpec(specs, "day:d1", "atlas-grid");
		const measurement: AtlasGridMeasurement = {
			bodyHeight: 100,
			days: [
				{ bandHeight: 10, emptyRowHeight: 8, rowHeights: [40, 40, 40, 40] },
			],
		};
		const plan = paginateAtlasGridScene(spec, familyDay(spec, measurement));
		expect(plan.pages.map((page) => [page.kind, page.unitIds])).toEqual([
			["first", ["d1-u0", "d1-u1"]],
			["continuation", ["d1-u2", "d1-u3"]],
		]);
		const cover = moduleSpec(specs, "cover", "atlas-grid");
		expect(
			paginateAtlasGridScene(
				cover,
				coverMeasurement(cover, { titleSizePt: 28 }),
			).pages[0],
		).toMatchObject({ kind: "cover", titleSizePt: 28 });
	});

	it("正常系: paper-collageは自分の予定だけで構図退避を選ぶ", () => {
		const specs = specsFor(compiledProgram(["scrapbook"]));
		const spec = moduleSpec(specs, "day:d1", "paper-collage");
		const measurement: PaperCollageMeasurement = {
			cardGap: 3,
			continuationBodyHeight: 150,
			days: [
				{
					narrowCardHeights: [120, 20, 20, 20],
					wideCardHeights: [60, 10, 10, 10],
				},
			],
			firstBodyHeight: 100,
		};
		const plan = paginatePaperCollageScene(spec, familyDay(spec, measurement));
		const first = plan.pages[0];
		expect(first?.kind === "first" && first.layoutVariant).toBe(
			"compact-header",
		);
		expect(plan.pages.flatMap((page) => page.unitIds)).toEqual([
			"d1-u0",
			"d1-u1",
			"d1-u2",
			"d1-u3",
		]);
	});

	it("正常系: playful-routeは頁ごとのブロック高を保持する", () => {
		const specs = specsFor(compiledProgram(["board-game"]));
		const spec = moduleSpec(specs, "day:d1", "playful-route");
		const measurement: PlayfulRouteMeasurement = {
			blockGap: 4,
			continuationBodyHeight: 120,
			days: [
				{
					selectedBlockHeights: [30, 30, 30, 30],
					wideBlockHeights: [20, 20, 20, 20],
				},
			],
			firstBodyHeight: 70,
			selectedBlockWidth: 80,
			wideBlockWidth: 120,
		};
		const plan = paginatePlayfulRouteScene(spec, familyDay(spec, measurement));
		expect(
			plan.pages.map((page) =>
				page.kind === "cover" ? null : page.unitHeightsMm,
			),
		).toEqual([
			[30, 30],
			[30, 30],
		]);
	});

	it("境界値系: editorial-magazineは記事頁に入らない先頭カードを継続頁へ送り、記事頁を残す", () => {
		const specs = specsFor(compiledProgram(["travel-magazine"]));
		const spec = moduleSpec(specs, "day:d2", "editorial-magazine");
		const measurement: EditorialMagazineMeasurements = {
			articleHeaderHeightMm: 40,
			articleStartYmm: 80,
			cardGapMm: 3,
			continuationHeaderHeightMm: 20,
			continuationStartYmm: 30,
			pageBottomYmm: 200,
			unitHeightsMm: new Map([["d2-u0", 150]]),
		};
		const plan = paginateEditorialMagazineScene(
			spec,
			familyDay(spec, measurement),
		);
		expect(plan.pages.map((page) => [page.kind, page.unitIds])).toEqual([
			["first", []],
			["continuation", ["d2-u0"]],
		]);
	});

	it("正常系: travel-newspaperは二段組を保ち、読む順に予定を並べる", () => {
		const specs = specsFor(compiledProgram(["newspaper"]));
		const spec = moduleSpec(specs, "day:d1", "travel-newspaper");
		const measurement: TravelNewspaperMeasurements = {
			articleGapMm: 4,
			articleStartYmm: 68,
			columnGapMm: 10,
			continuationHeaderHeightMm: 20,
			continuationStartYmm: 30,
			dayHeaderHeightMm: 50,
			pageBottomYmm: 200,
			unitHeightsMm: new Map(
				["d1-u0", "d1-u1", "d1-u2", "d1-u3"].map((id) => [id, 60]),
			),
		};
		const plan = paginateTravelNewspaperScene(
			spec,
			familyDay(spec, measurement),
		);
		expect(plan.pages.flatMap((page) => page.unitIds)).toEqual([
			"d1-u0",
			"d1-u1",
			"d1-u2",
			"d1-u3",
		]);
	});

	it("異常系: 家族の日見出しがあふれる・styleが違う計測を拒否する", () => {
		const specs = specsFor(compiledProgram(["travel-note"]));
		const spec = moduleSpec(specs, "day:d2", "atlas-grid");
		const measurement: AtlasGridMeasurement = {
			bodyHeight: 100,
			days: [{ bandHeight: 10, emptyRowHeight: 8, rowHeights: [20] }],
		};
		expect(() =>
			paginateAtlasGridScene(spec, {
				...familyDay(spec, measurement),
				heading: { ...fits(), contentHeightMm: 11 },
			}),
		).toThrow(expect.objectContaining({ code: "day-header-overflow" }));
		expect(() =>
			paginateAtlasGridScene(spec, {
				...familyDay(spec, measurement),
				styleKey: "x",
			}),
		).toThrow(expect.objectContaining({ code: "invalid-measurement" }));
	});
});
