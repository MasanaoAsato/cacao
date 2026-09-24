import { describe, expect, it } from "vitest";
import {
	artworkPlacementIssue,
	placeWithZeroFallback,
	TEXT_CLEARANCE_MM,
} from "./placement";

const rect = (xMm: number, yMm: number, widthMm: number, heightMm: number) => ({
	heightMm,
	widthMm,
	xMm,
	yMm,
});

describe("artworkPlacementIssue", () => {
	const within = rect(98, 44, 40, 46);

	it("正常系: slot内で文字から1mm以上離れていれば配置できる", () => {
		expect(
			artworkPlacementIssue({
				bounds: rect(100, 46, 36, 36),
				protectedTexts: [{ rect: rect(10, 96, 128, 10), role: "spot-name" }],
				slotId: "day-art",
				within,
			}),
		).toBeNull();
	});

	it("境界値系: 文字との距離がちょうど1mmなら可、それより近ければ不可", () => {
		const text = { rect: rect(10, 90 + TEXT_CLEARANCE_MM, 128, 5), role: "x" };
		const check = (bottom: number) =>
			artworkPlacementIssue({
				bounds: rect(100, 50, 30, bottom - 50),
				protectedTexts: [text],
				slotId: "s",
				within: rect(98, 44, 40, 60),
			});
		expect(check(90)).toBeNull();
		expect(check(90.5)).toContain("1mm");
	});

	it("異常系: slotやページからはみ出す・計測できない矩形は拒否する（SVGもWebPも同じ）", () => {
		expect(
			artworkPlacementIssue({
				bounds: rect(96, 44, 44, 46),
				protectedTexts: [],
				slotId: "s",
				within,
			}),
		).toContain("はみ出し");
		expect(
			artworkPlacementIssue({
				bounds: rect(100, 46, Number.NaN, 10),
				protectedTexts: [],
				slotId: "s",
				within,
			}),
		).toContain("計測できません");
		expect(
			artworkPlacementIssue({
				bounds: rect(100, 46, 10, 10),
				protectedTexts: [{ rect: rect(0, 0, -1, 1), role: "bad" }],
				slotId: "s",
				within,
			}),
		).toContain("bad");
	});
});

describe("placeWithZeroFallback", () => {
	it("正常系・境界値系: seed回転で衝突すれば0度だけを試し、縮小や削除はしない", () => {
		const tried: number[] = [];
		const placed = placeWithZeroFallback(12, (deg) => {
			tried.push(deg);
			return deg === 0 ? "ok" : null;
		});
		expect(tried).toEqual([12, 0]);
		expect(placed).toEqual({ result: "ok", rotateDeg: 0 });
		expect(placeWithZeroFallback(0, () => null)).toBeNull();
	});
});
