import { describe, expect, it } from "vitest";
import {
	PLAYFUL_ROUTE_FAMILY,
	playfulRouteCompositionFor,
	playfulRoutePaletteFor,
} from "./playfulRoute";

describe("playful-routeのテーマ定義", () => {
	it("正常系: 2配色・2構図・4素材とroute方針を登録する", () => {
		expect(PLAYFUL_ROUTE_FAMILY).toMatchObject({
			compositionIds: ["zigzag", "ribbon"],
			decorAssetIds: [
				"playful-bag",
				"playful-sun",
				"playful-squiggle",
				"playful-burst",
			],
			moodIds: ["postcard", "festival-ticket"],
			paletteIds: ["berry-sun", "harbor-play"],
			policyId: "route",
		});
	});

	it("異常系: 未登録の配色と構図を拒否する", () => {
		expect(() => playfulRoutePaletteFor("unknown")).toThrow("配色");
		expect(() => playfulRouteCompositionFor("unknown")).toThrow("構図");
	});

	it("境界値: zigzagとribbonの本文幅を設計どおり返す", () => {
		expect(playfulRouteCompositionFor("zigzag").blockWidthMm).toBe(104);
		expect(playfulRouteCompositionFor("ribbon").blockWidthMm).toBe(128);
	});
});
