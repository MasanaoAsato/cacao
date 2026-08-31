import { describe, expect, it } from "vitest";
import {
	formatBookletDate,
	formatBookletTime,
	formatTransportMode,
} from "./itineraryFormat";

describe("旅程表示整形", () => {
	it("正常系: ISO日時の日付と時刻を旅程向けに分ける", () => {
		expect(formatBookletDate("2026-08-28T10:05:00+09:00")).toBe("2026/08/28");
		expect(formatBookletTime("2026-08-28T10:05:00+09:00")).toBe("10:05");
	});

	it("正常系: 交通手段を日本語表示へ変換する", () => {
		expect(formatTransportMode("train")).toBe("電車");
		expect(formatTransportMode("walk")).toBe("徒歩");
		expect(formatTransportMode("ferry")).toBe("フェリー");
	});

	it("異常系: 未知値とISO形式外の値を隠さず返す", () => {
		expect(formatTransportMode("space-shuttle")).toBe("space-shuttle");
		expect(formatBookletDate("日付不明T時刻不明")).toBe("日付不明 時刻不明");
		expect(formatBookletTime("時刻不明")).toBe("時刻不明");
	});

	it("境界値系: 日付の月初と時刻の端点を保持する", () => {
		expect(formatBookletDate("2026-01-01T00:00:00+09:00")).toBe("2026/01/01");
		expect(formatBookletTime("2026-12-31T23:59:00+09:00")).toBe("23:59");
	});
});
