import { describe, expect, it } from "vitest";
import {
	axisRandom,
	createDefaultThemeSeed,
	createRerollSeed,
	formatThemeSeed,
	parseThemeSeed,
} from "./seed";

describe("テーマシード", () => {
	it("正常系: 大文字のV2 URLシードを小文字へ正規化する", () => {
		expect(parseThemeSeed("v2-ABCDEF01")).toEqual({
			kind: "valid",
			seed: { value: 0xabcdef01, version: "v2" },
			token: "v2-abcdef01",
		});
	});

	it("異常系: V1と桁不足のシードを拒否する", () => {
		expect(parseThemeSeed("v1-00000000")).toEqual({ kind: "invalid" });
		expect(parseThemeSeed("v2-1234")).toEqual({ kind: "invalid" });
	});

	it("境界値系: 0とuint32最大値をV2シードとして書式化する", () => {
		expect(formatThemeSeed({ value: 0, version: "v2" })).toBe("v2-00000000");
		expect(formatThemeSeed({ value: 0xffffffff, version: "v2" })).toBe(
			"v2-ffffffff",
		);
	});

	it("正常系: 軸別乱数と既定シードは決定的に導出される", () => {
		expect(createDefaultThemeSeed("journey-1")).toEqual(
			createDefaultThemeSeed("journey-1"),
		);
		expect(axisRandom("v2-00000007", "palette")).toBe(
			axisRandom("v2-00000007", "palette"),
		);
		expect(axisRandom("v2-00000007", "palette")).not.toBe(
			axisRandom("v2-00000007", "coverLayout"),
		);
	});

	it("正常系: 再抽選は異なるデザインになる最初の乱数値を選ぶ", () => {
		const values = [7, 8];
		const seed = createRerollSeed(
			{ value: 1, version: "v2" },
			(candidate) => candidate.value === 8,
			(target) => {
				target[0] = values.shift() ?? 0;
				return target;
			},
		);
		expect(seed).toEqual({ value: 8, version: "v2" });
	});
});
