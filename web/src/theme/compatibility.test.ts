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
				matches: () => true,
			},
		]);
		expect(result.palettes).not.toContain("paper-ink");
	});

	it("境界値系: 除外後に空になる軸は元の許可リストを維持する", () => {
		const mood = MOODS.get("field-notes");
		if (!mood) {
			throw new Error("field-notesの定義がありません。");
		}
		const result = applyCompatibility(mood, { coverVisualStyle: null }, [
			{
				exclude: { decors: ["field-notes"] },
				matches: () => true,
			},
		]);
		expect(result.decors).toEqual(mood.decors);
	});
});
