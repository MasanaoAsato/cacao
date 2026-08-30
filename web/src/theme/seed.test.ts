import { describe, expect, it } from "vitest";
import {
	createDefaultThemeSeed,
	createRerollSeed,
	fnv1a32,
	formatThemeSeed,
	mulberry32,
	parseThemeSeed,
} from "./seed";

describe("テーマシード", () => {
	it("正常系: 大文字のURLシードを小文字へ正規化する", () => {
		expect(parseThemeSeed("v1-ABCDEF01")).toEqual({
			kind: "valid",
			seed: { value: 0xabcdef01, version: "v1" },
			token: "v1-abcdef01",
		});
	});

	it("異常系: 未対応版と桁不足を拒否する", () => {
		expect(parseThemeSeed("v2-00000000")).toEqual({ kind: "invalid" });
		expect(parseThemeSeed("v1-1234")).toEqual({ kind: "invalid" });
	});

	it("境界値系: 0と32bit最大値を往復できる", () => {
		expect(formatThemeSeed({ value: 0, version: "v1" })).toBe("v1-00000000");
		expect(formatThemeSeed({ value: 0xffffffff, version: "v1" })).toBe(
			"v1-ffffffff",
		);
	});

	it("同じ旅程IDからは安定した既定シードを導出する", () => {
		expect(createDefaultThemeSeed("journey-1")).toEqual(
			createDefaultThemeSeed("journey-1"),
		);
		expect(fnv1a32("booklet-theme:v1:journey-1")).toBe(
			createDefaultThemeSeed("journey-1").value,
		);
		expect(mulberry32(7)()).toBe(mulberry32(7)());
	});

	it("再抽選は異なるレシピになる最初の暗号学的乱数値を選ぶ", () => {
		const values = [7, 8];
		const seed = createRerollSeed(
			{ value: 1, version: "v1" },
			(candidate) => candidate.value === 8,
			(target) => {
				target[0] = values.shift() ?? 0;
				return target;
			},
		);
		expect(seed).toEqual({ value: 8, version: "v1" });
	});
});
