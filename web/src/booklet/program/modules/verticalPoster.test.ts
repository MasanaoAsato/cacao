import { describe, expect, it } from "vitest";
import {
	bodyMeasurement,
	compiledProgram,
	coverMeasurement,
	fits,
	moduleSpec,
	specsFor,
} from "../programTestKit";
import { paginateVerticalPosterScene } from "./verticalPoster";

const specs = specsFor(compiledProgram(["japan-poster"]));

describe("paginateVerticalPosterScene", () => {
	it("正常系: 初頁98mm・継続154mmの横書き予定欄", () => {
		const spec = moduleSpec(specs, "day:d1", "vertical-poster");
		const plan = paginateVerticalPosterScene(
			spec,
			bodyMeasurement(spec, 47, 128),
		);
		// 47 + 3 + 47 = 97 <= 98.
		expect(plan.pages.map((page) => page.unitIds.length)).toEqual([2, 2]);
	});

	it("異常系: 縦書き日見出しが26×80mmからあふれればday-header-overflow", () => {
		const spec = moduleSpec(specs, "day:d1", "vertical-poster");
		expect(() =>
			paginateVerticalPosterScene(
				spec,
				bodyMeasurement(spec, 10, 128, {
					heading: { ...fits(26, 80), contentHeightMm: 81 },
				}),
			),
		).toThrow(expect.objectContaining({ code: "day-header-overflow" }));
	});

	it("境界値系: 縦書き題名が1px以内なら収める", () => {
		const spec = moduleSpec(specs, "cover", "vertical-poster");
		const plan = paginateVerticalPosterScene(
			spec,
			coverMeasurement(spec, {
				title: { ...fits(26, 146), contentHeightMm: 146 + 25.4 / 96 },
			}),
		);
		expect(plan.pages[0]?.kind).toBe("cover");
	});
});
