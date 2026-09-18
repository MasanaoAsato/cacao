import { describe, expect, it } from "vitest";
import {
	paperCollageCompositionFor,
	paperCollagePaletteFor,
} from "./paperCollage";

describe("paperCollage family", () => {
	it("正常系: 2配色と2構図を解決する", () => {
		expect(paperCollagePaletteFor("sage-paper")).toMatchObject({
			ink: "#26362D",
			paper: "#EFF4F2",
		});
		expect(paperCollageCompositionFor("photo-right").dayImage).toEqual({
			heightMm: 36,
			widthMm: 42,
			xMm: 96,
			yMm: 10,
		});
	});

	it("異常系: 未登録の配色を拒否する", () => {
		expect(() => paperCollagePaletteFor("unknown")).toThrow(
			"paper-collageの配色",
		);
	});

	it("境界値: 表紙画像は外周10mmを越えない", () => {
		const left = paperCollageCompositionFor("photo-left").coverImage;
		const right = paperCollageCompositionFor("photo-right").coverImage;

		expect(left.xMm).toBe(10);
		expect(right.xMm + right.widthMm).toBe(138);
	});
});
