import { describe, expect, it } from "vitest";
import { formatBookletDate, formatBookletDateTime } from "./dateFormat";

describe("しおりの日時表示", () => {
	it.each([
		["UTC", "2026-09-02T00:00:00Z", "2026/09/02", "2026/09/02 00:00"],
		[
			"正の最大オフセット",
			"2026-12-31T23:59:59.123+14:00",
			"2026/12/31",
			"2026/12/31 23:59",
		],
		[
			"負の最大オフセット",
			"2026-01-01T00:01:02-12:00",
			"2026/01/01",
			"2026/01/01 00:01",
		],
		["閏日", "2028-02-29T12:30:00Z", "2028/02/29", "2028/02/29 12:30"],
	])(
		"正常系: %sをタイムゾーン変換せず整形する",
		(_label, value, date, dateTime) => {
			expect(formatBookletDate(value)).toBe(date);
			expect(formatBookletDateTime(value)).toBe(dateTime);
		},
	);

	it.each([
		"2026-09-02",
		"2026-09-02 00:00:00Z",
		"2026-02-29T00:00:00Z",
		"2026-01-01T24:00:00Z",
		"2026-01-01T00:00:00+24:00",
	])("異常系: RFC 3339ではない値を拒否する", (value) => {
		expect(() => formatBookletDate(value)).toThrow("RFC 3339");
		expect(() => formatBookletDateTime(value)).toThrow("RFC 3339");
	});

	it("境界値系: 月末と年末の暦日を維持する", () => {
		expect(formatBookletDate("2026-04-30T23:59:59-12:00")).toBe("2026/04/30");
		expect(formatBookletDateTime("2026-12-31T23:59:59+14:00")).toBe(
			"2026/12/31 23:59",
		);
	});
});
