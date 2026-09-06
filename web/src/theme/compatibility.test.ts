import { describe, expect, it } from "vitest";
import { MOODS } from "./catalog";
import { applyCompatibility } from "./compatibility";

describe("テーマ相性表", () => {
	it("正常系: 一致した規則の除外を雰囲気の許可リストへ適用する", () => {
		const mood = MOODS.get("field-notes");
		if (!mood) {
			throw new Error("field-notesの定義がありません。");
		}
		const result = applyCompatibility(mood, { coverVisualStyle: null }, [
			{
				exclude: { palettes: ["paper-ink"] },
				when: { coverVisualStyle: ["watercolor"] },
			},
		]);
		expect(result.palettes).toContain("paper-ink");
		const matched = applyCompatibility(
			mood,
			{ coverVisualStyle: "watercolor" },
			[
				{
					exclude: { palettes: ["paper-ink"] },
					when: { coverVisualStyle: ["watercolor"] },
				},
			],
		);
		expect(matched.palettes).not.toContain("paper-ink");
	});

	it("境界値系: 除外後に空になる軸は元の許可リストを維持する", () => {
		const mood = MOODS.get("field-notes");
		if (!mood) {
			throw new Error("field-notesの定義がありません。");
		}
		const result = applyCompatibility(
			mood,
			{ coverVisualStyle: "watercolor" },
			[
				{
					exclude: { decors: ["dotted-grid", "hairline-frame"] },
					when: { coverVisualStyle: ["watercolor"] },
				},
			],
		);
		expect(result.decors).toEqual(mood.decors);
	});

	it("正常系: watercolorは夜の配色と硬い装飾を除外する", () => {
		const mood = MOODS.get("night-train");
		if (!mood) {
			throw new Error("night-trainの定義がありません。");
		}

		const result = applyCompatibility(mood, { coverVisualStyle: "watercolor" });

		expect(result.palettes).not.toContain("night-window");
		expect(result.decors).not.toContain("stripe-band");
		expect(result.decors).not.toContain("dashed-ticket");
	});

	it("正常系: 写真系とnullは許可リストを変更しない", () => {
		const mood = MOODS.get("night-train");
		if (!mood) {
			throw new Error("night-trainの定義がありません。");
		}

		expect(applyCompatibility(mood, { coverVisualStyle: null })).toEqual(mood);
		expect(
			applyCompatibility(mood, { coverVisualStyle: "editorial-photograph" }),
		).toEqual(mood);
	});
});
