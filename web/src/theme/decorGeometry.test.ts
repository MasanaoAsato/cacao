import { describe, expect, it } from "vitest";
import { motifColorVariable, rotatedBounds } from "./decorGeometry";

describe("rotatedBounds", () => {
	it("正常系: 0度なら元の箱と同じ外接矩形を返す", () => {
		expect(rotatedBounds(10, 20, 8, 4, 0)).toEqual({
			heightMm: 4,
			widthMm: 8,
			xMm: 10,
			yMm: 20,
		});
	});

	it("境界値系: 回転した図形の外接矩形は中心を保ったまま回転前より広がる", () => {
		const bounds = rotatedBounds(4, 4, 4, 4, 45);
		expect(bounds.widthMm).toBeCloseTo(4 * Math.SQRT2, 5);
		expect(bounds.heightMm).toBeCloseTo(4 * Math.SQRT2, 5);
		expect(bounds.xMm).toBeCloseTo(4 + 2 - 2 * Math.SQRT2, 5);
		expect(bounds.yMm + bounds.heightMm / 2).toBeCloseTo(6, 5);
	});

	it("境界値系: 90度では幅と高さが入れ替わる", () => {
		const bounds = rotatedBounds(0, 0, 8, 4, 90);
		expect(bounds.widthMm).toBeCloseTo(4, 5);
		expect(bounds.heightMm).toBeCloseTo(8, 5);
	});
});

describe("motifColorVariable", () => {
	it("正常系: 本文ページの色変数へ対応づける", () => {
		expect(motifColorVariable("accent")).toBe(
			"var(--booklet-itinerary-accent)",
		);
		expect(motifColorVariable("border")).toBe(
			"var(--booklet-itinerary-border)",
		);
		expect(motifColorVariable("muted")).toBe("var(--booklet-itinerary-muted)");
	});

	it("境界値系: 素材自身の色はnullで塗り替えない", () => {
		expect(motifColorVariable("own")).toBeNull();
	});
});
