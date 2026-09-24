import { describe, expect, it } from "vitest";
import { formatTransportMode } from "./itineraryFormat";

describe("旅程表示整形", () => {
	it("正常系: 交通手段を日本語表示へ変換する", () => {
		expect(formatTransportMode("train")).toBe("電車");
		expect(formatTransportMode("walk")).toBe("徒歩");
		expect(formatTransportMode("ferry")).toBe("フェリー");
	});

	it("異常系: 未知値を隠さず返す", () => {
		expect(formatTransportMode("space-shuttle")).toBe("space-shuttle");
	});

	it("境界値系: 空文字は空文字のまま返す", () => {
		expect(formatTransportMode("")).toBe("");
	});
});
