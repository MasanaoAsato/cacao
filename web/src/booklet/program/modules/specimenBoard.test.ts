import { describe, expect, it } from "vitest";
import {
	bodyMeasurement,
	compiledProgram,
	moduleSpec,
	specsFor,
} from "../programTestKit";
import { paginateSpecimenBoardScene } from "./specimenBoard";

const specs = specsFor(compiledProgram(["nordic"]));

describe("paginateSpecimenBoardScene", () => {
	it("正常系: 51mm幅で実測した予定を左列の上から下、次に右列へ詰める", () => {
		const spec = moduleSpec(specs, "day:d1", "specimen-board");
		// First page 108mm: 50 + 3 + 50 = 103 per column.
		const plan = paginateSpecimenBoardScene(
			spec,
			bodyMeasurement(spec, 50, 51),
		);
		expect(plan.pages).toHaveLength(1);
		expect(plan.pages[0]?.columns).toEqual([
			["d1-u0", "d1-u1"],
			["d1-u2", "d1-u3"],
		]);
	});

	it("境界値系: 継続は154mm。初頁に入らない単位は見出しと画像の頁を残して送る", () => {
		const spec = moduleSpec(specs, "day:d2", "specimen-board");
		const plan = paginateSpecimenBoardScene(
			spec,
			bodyMeasurement(spec, 154, 51),
		);
		expect(plan.pages.map((page) => [page.kind, page.unitIds])).toEqual([
			["first", []],
			["continuation", ["d2-u0"]],
		]);
	});

	it("異常系: 61mm列幅のまま計測した予定はinvalid-measurement", () => {
		const spec = moduleSpec(specs, "day:d1", "specimen-board");
		expect(() =>
			paginateSpecimenBoardScene(spec, bodyMeasurement(spec, 10, 61)),
		).toThrow(expect.objectContaining({ code: "invalid-measurement" }));
	});

	it("正常系: specimen-boardは表紙を描けないので、表紙はpaper-collageが描く", () => {
		const cover = specs.find((spec) => spec.scene.kind === "cover");
		expect(cover?.scene.moduleId).toBe("paper-collage");
	});
});
