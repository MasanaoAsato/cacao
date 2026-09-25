import { describe, expect, it } from "vitest";
import { ARTWORK_TOUCH_IDS, canonicalArtworkTouchId } from "./types";

describe("artwork touch IDs", () => {
	it("正常系: 制作タッチは12種で方向の別名を既存素材へ解決する", () => {
		expect(ARTWORK_TOUCH_IDS).toHaveLength(12);
		expect(canonicalArtworkTouchId("charcoal")).toBe("chalk");
		expect(canonicalArtworkTouchId("geometric")).toBe("screenprint");
		expect(canonicalArtworkTouchId("woodcut")).toBe("woodcut");
	});

	it("異常系: 未定義のタッチを公開しない", () => {
		expect(canonicalArtworkTouchId("unknown")).toBeNull();
	});
});
