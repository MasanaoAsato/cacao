import { describe, expect, it } from "vitest";
import {
	testDay,
	testModel,
} from "../../../theme/composition/compositionTestKit";
import {
	bodyMeasurement,
	compiledProgram,
	coverMeasurement,
	extraMeasurement,
	fits,
	moduleSpec,
	specsFor,
} from "../programTestKit";
import { paginateWoodcutFolioScene } from "./woodcutFolio";

const woodcut = specsFor(compiledProgram(["vintage-journal"]));

const specOf = (sceneId: string) =>
	moduleSpec(woodcut, sceneId, "woodcut-folio");

describe("paginateWoodcutFolioScene", () => {
	it("正常系: 表紙は一頁で、予定を所有しない", () => {
		const spec = specOf("cover");
		const plan = paginateWoodcutFolioScene(spec, coverMeasurement(spec));
		expect(plan.pages).toEqual([
			expect.objectContaining({
				kind: "cover",
				localPageId: "cover",
				unitIds: [],
			}),
		]);
	});

	it("正常系: 初頁は98mm、継続は148mmの全幅本文へ3mm間隔で詰める", () => {
		const spec = specOf("day:d1");
		// 30 + 3 + 30 + 3 + 30 = 96 <= 98, the fourth unit continues.
		const plan = paginateWoodcutFolioScene(
			spec,
			bodyMeasurement(spec, 30, 128),
		);
		expect(plan.pages.map((page) => [page.localPageId, page.unitIds])).toEqual([
			["p1", ["d1-u0", "d1-u1", "d1-u2"]],
			["p2", ["d1-u3"]],
		]);
		expect(plan.pages[1]).toMatchObject({
			firstUnitNumber: 4,
			kind: "continuation",
		});
	});

	it("境界値系: 単位高が初頁容量と同値なら収め、継続容量を超える単位はunit-overflow", () => {
		const spec = specOf("day:d2");
		expect(
			paginateWoodcutFolioScene(spec, bodyMeasurement(spec, 98, 128)).pages,
		).toHaveLength(1);
		expect(() =>
			paginateWoodcutFolioScene(spec, bodyMeasurement(spec, 148.01, 128)),
		).toThrow(expect.objectContaining({ code: "unit-overflow" }));
	});

	it("境界値系: 空日は初頁一枚だけ", () => {
		const spec = specOf("day:d3");
		const plan = paginateWoodcutFolioScene(spec, bodyMeasurement(spec, 1, 128));
		expect(plan.pages).toEqual([
			expect.objectContaining({ kind: "first", unitIds: [] }),
		]);
	});

	it("異常系: 幅・styleの違う計測はinvalid-measurement", () => {
		const spec = specOf("day:d1");
		expect(() =>
			paginateWoodcutFolioScene(spec, bodyMeasurement(spec, 10, 106)),
		).toThrow(expect.objectContaining({ code: "invalid-measurement" }));
		expect(() =>
			paginateWoodcutFolioScene(spec, {
				...bodyMeasurement(spec, 10, 128),
				styleKey: "other",
			}),
		).toThrow(expect.objectContaining({ code: "invalid-measurement" }));
	});

	it("異常系: 長い題名が予約高を超えればcover-block-overflow（縮小しない）", () => {
		const spec = specOf("cover");
		expect(() =>
			paginateWoodcutFolioScene(
				spec,
				coverMeasurement(spec, {
					title: { ...fits(128, 32), contentHeightMm: 33 },
				}),
			),
		).toThrow(expect.objectContaining({ code: "cover-block-overflow" }));
	});
});

describe("woodcut-folio extras", () => {
	it("正常系: dividerとendcapは専用の一頁", () => {
		const chapters = specsFor(compiledProgram(["continuous-story"]));
		const divider = moduleSpec(chapters, "divider:d1", "woodcut-folio");
		const endcap = moduleSpec(chapters, "endcap", "woodcut-folio");
		expect(
			paginateWoodcutFolioScene(
				divider,
				extraMeasurement(divider, "divider", []),
			).pages,
		).toEqual([expect.objectContaining({ kind: "divider", unitIds: [] })]);
		expect(
			paginateWoodcutFolioScene(endcap, extraMeasurement(endcap, "endcap", []))
				.pages,
		).toEqual([expect.objectContaining({ kind: "endcap", unitRefs: [] })]);
	});

	it("正常系・境界値系: memoは参照を実測順に154mmへ分割し、参照だけを持つ", () => {
		const model = testModel({
			days: [testDay("d1", 1, ["09:00", "10:00", "11:00", "12:00"])],
		});
		const specs = specsFor(compiledProgram(["checklist"], model), model);
		const memo = moduleSpec(specs, "memo:d1", "woodcut-folio");
		const spec = memo;
		// 75 + 3 + 76 = 154 fits exactly; the rest moves on.
		const plan = paginateWoodcutFolioScene(
			spec,
			extraMeasurement(memo, "memo", [75, 76, 10, 10]),
		);
		expect(plan.pages.map((page) => page.unitRefs)).toEqual([
			["d1-u0", "d1-u1"],
			["d1-u2", "d1-u3"],
		]);
		expect(plan.pages.flatMap((page) => page.unitIds)).toEqual([]);
	});

	it("異常系: memoの計測種別・件数が違えばinvalid-measurement", () => {
		const model = testModel({ days: [testDay("d1", 1, ["09:00"])] });
		const specs = specsFor(compiledProgram(["checklist"], model), model);
		const memo = moduleSpec(specs, "memo:d1", "woodcut-folio");
		const spec = memo;
		expect(() =>
			paginateWoodcutFolioScene(spec, extraMeasurement(memo, "memo", [])),
		).toThrow(expect.objectContaining({ code: "invalid-measurement" }));
		expect(() =>
			paginateWoodcutFolioScene(spec, extraMeasurement(memo, "divider", [])),
		).toThrow(expect.objectContaining({ code: "invalid-measurement" }));
	});
});
