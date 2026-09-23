import { describe, expect, it } from "vitest";
import {
	STYLE_BUNDLES,
	styleBundleById,
	validateStyleBundle,
} from "./styleBundles";

describe("styleBundles", () => {
	it("正常系: 6束をIDから取得し、共通の文字組下限を満たす", () => {
		expect(Object.keys(STYLE_BUNDLES)).toHaveLength(6);
		expect(styleBundleById("night").paperColor).toBe("#182331");
		for (const bundle of Object.values(STYLE_BUNDLES)) {
			expect(() => validateStyleBundle(bundle)).not.toThrow();
		}
	});

	it("異常系: 本文の文字サイズが下限未満なら拒否する", () => {
		expect(() =>
			validateStyleBundle({ ...STYLE_BUNDLES.ink, bodyFontSizePt: 9.9 }),
		).toThrow("文字サイズ");
	});

	it("境界値系: 設計書の最小値は受け付ける", () => {
		expect(() =>
			validateStyleBundle({
				...STYLE_BUNDLES.ink,
				bodyFontSizePt: 10,
				displayFontSizePt: 18,
				utilityFontSizePt: 8.5,
			}),
		).not.toThrow();
	});
});
