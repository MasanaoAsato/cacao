import { describe, expect, it } from "vitest";
import { contrastRatio } from "./contrast";

describe("contrastRatio", () => {
	it("正常系: 黒と白は21:1で、前景と背景を入れ替えても同じ値を返す", () => {
		expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
		expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 5);
	});

	it("正常系: 大文字の16進と前後の空白を受け付ける", () => {
		expect(contrastRatio(" #FFFFFF ", "#000000")).toBeCloseTo(21, 5);
	});

	it("境界値系: 同じ色は1:1になる", () => {
		expect(contrastRatio("#777777", "#777777")).toBe(1);
	});

	it("境界値系: 灰色#767676は白に対してWCAGの4.5:1をわずかに超える", () => {
		const ratio = contrastRatio("#767676", "#ffffff");
		expect(ratio).toBeGreaterThan(4.5);
		expect(ratio).toBeLessThan(4.6);
	});

	it("異常系: #rrggbb以外の色はnullを返す", () => {
		expect(contrastRatio("#fff", "#000000")).toBeNull();
		expect(contrastRatio("#000000", "red")).toBeNull();
		expect(contrastRatio("#gggggg", "#000000")).toBeNull();
	});
});
