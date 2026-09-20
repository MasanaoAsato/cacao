import { describe, expect, it } from "vitest";
import {
	COVER_VISUAL_STYLES,
	HANDCRAFTED_COVER_VISUAL_STYLES,
	SOFT_COVER_VISUAL_STYLES,
} from "./coverVisualStyles";

describe("cover visual styles", () => {
	it("contains the six legacy and forty v2 visual styles", () => {
		expect(COVER_VISUAL_STYLES).toHaveLength(46);
		expect(new Set(COVER_VISUAL_STYLES)).toHaveLength(
			COVER_VISUAL_STYLES.length,
		);
	});

	it("keeps every compatibility style in the known catalog", () => {
		for (const style of [
			...SOFT_COVER_VISUAL_STYLES,
			...HANDCRAFTED_COVER_VISUAL_STYLES,
		]) {
			expect(COVER_VISUAL_STYLES).toContain(style);
		}
	});
});
