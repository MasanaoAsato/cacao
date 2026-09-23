import { describe, expect, it } from "vitest";
import { ARTWORK_TOUCH_IDS, canonicalArtworkTouchId } from "./types";

describe("artwork touch IDs", () => {
	it("正常系: 制作タッチは12種でcharcoalはchalkを参照する", () => {
		expect(ARTWORK_TOUCH_IDS).toHaveLength(12);
		expect(canonicalArtworkTouchId("charcoal")).toBe("chalk");
		expect(canonicalArtworkTouchId("woodcut")).toBe("woodcut");
	});

	it("異常系: 未定義のタッチを公開しない", () => {
		expect(canonicalArtworkTouchId("unknown")).toBeNull();
	});
});
