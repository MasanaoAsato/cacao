import { afterEach, describe, expect, it, vi } from "vitest";
import { selectRerollSeed } from "./reroll";

afterEach(() => {
	vi.restoreAllMocks();
});

describe("selectRerollSeed", () => {
	it("正常系: cryptoのUint32を一つだけ取得してv2シードにする", () => {
		const randomValues = vi
			.spyOn(crypto, "getRandomValues")
			.mockImplementation((values) => {
				if (values instanceof Uint32Array) values[0] = 0x12345678;
				return values;
			});

		expect(selectRerollSeed()).toEqual({ value: 0x12345678, version: "v2" });
		expect(randomValues).toHaveBeenCalledTimes(1);
	});

	it("正常系: 直前と同じ値でも除外せずそのまま採用する", () => {
		const source = vi.fn((values: Uint32Array<ArrayBuffer>) => {
			values[0] = 7;
			return values;
		});

		expect(selectRerollSeed(source)).toEqual({ value: 7, version: "v2" });
		expect(selectRerollSeed(source)).toEqual({ value: 7, version: "v2" });
		expect(source).toHaveBeenCalledTimes(2);
	});

	it("境界値系: 0とuint32最大値をそのままシードにする", () => {
		for (const value of [0, 0xffffffff]) {
			expect(
				selectRerollSeed((values) => {
					values[0] = value;
					return values;
				}),
			).toEqual({ value, version: "v2" });
		}
	});

	it("異常系: cryptoが失敗したら例外を呼び出し元へ返す", () => {
		expect(() =>
			selectRerollSeed(() => {
				throw new Error("crypto unavailable");
			}),
		).toThrowError("crypto unavailable");
	});

	it("異常系: 値のない配列が返れば例外にする", () => {
		expect(() =>
			selectRerollSeed(() => new Uint32Array(new ArrayBuffer(0))),
		).toThrowError("しおりデザインの乱数を取得できませんでした。");
	});
});
