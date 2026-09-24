import { describe, expect, it } from "vitest";
import {
	bodyMeasurement,
	compiledProgram,
	moduleSpec,
	specsFor,
} from "../programTestKit";
import { paginatePhotoEssayScene } from "./photoEssay";

describe("paginatePhotoEssayScene", () => {
	it("正常系: 大きい一枚絵の後の本文は48mm、継続は154mm", () => {
		const specs = specsFor(compiledProgram(["photo-book"]));
		const spec = moduleSpec(specs, "day:d1", "photo-essay");
		const plan = paginatePhotoEssayScene(spec, bodyMeasurement(spec, 22, 128));
		// 22 + 3 + 22 = 47 <= 48.
		expect(plan.pages.map((page) => page.unitIds.length)).toEqual([2, 2]);
		expect(plan.pages[0]?.compositionId).toBe("single-plate");
	});

	it("境界値系: 一日が複数sceneになると挿絵は先頭だけ、後続sceneは継続構図で始まる", () => {
		const specs = specsFor(compiledProgram(["day-story"]));
		const first = moduleSpec(specs, "day:d1", "photo-essay");
		const later = moduleSpec(specs, "day:d1:d1-u2", "photo-essay");
		expect(first.scene.kind === "day" && first.scene.showIllustration).toBe(
			true,
		);
		const plan = paginatePhotoEssayScene(
			later,
			bodyMeasurement(later, 70, 128),
		);
		// 70 + 3 + 70 = 143 <= 154 on the scene's first page.
		expect(plan.pages).toHaveLength(1);
		expect(plan.pages[0]?.compositionId).toBe("continuation");
	});

	it("異常系: 予定の計測件数が違えばinvalid-measurement", () => {
		const specs = specsFor(compiledProgram(["photo-book"]));
		const spec = moduleSpec(specs, "day:d1", "photo-essay");
		expect(() =>
			paginatePhotoEssayScene(spec, bodyMeasurement(spec, [10], 128)),
		).toThrow(expect.objectContaining({ code: "invalid-measurement" }));
	});
});
