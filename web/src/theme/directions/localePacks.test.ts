import { describe, expect, it } from "vitest";
import { localePackFor } from "./localePacks";

describe("localePackFor", () => {
	it("正常系: 国と都市の登録別名がそろうとpackを返す", () => {
		expect(localePackFor({ city: "京都市", country: "日本" })?.id).toBe(
			"kyoto",
		);
		expect(localePackFor({ city: "Paris", country: "France" })?.id).toBe(
			"paris",
		);
	});

	it("異常系: 部分一致や国・都市の組違いでは採用しない", () => {
		expect(localePackFor({ city: "新京都", country: "日本" })).toBeNull();
		expect(localePackFor({ city: "Paris", country: "日本" })).toBeNull();
	});

	it("境界値系: NFKC、空白、小文字化後に完全一致を判定する", () => {
		expect(
			localePackFor({ city: " Ｔｏｋｙｏ ", country: " japan " })?.id,
		).toBe("tokyo");
		expect(localePackFor(null)).toBeNull();
	});
});
