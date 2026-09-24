import { describe, expect, it } from "vitest";
import {
	BOOKLET_STYLE_PROFILES,
	styleProfilesForFamily,
} from "./styleProfiles";

describe("旅程しおりの作風プロファイル", () => {
	it("正常系: 既存3familyにレビュー済みの2作風ずつを登録する", () => {
		expect(BOOKLET_STYLE_PROFILES).toHaveLength(6);
		expect(
			styleProfilesForFamily("atlas-grid").map((profile) => profile.id),
		).toEqual(["atlas-grid.atlas-wayfinder", "atlas-grid.atlas-field-record"]);
		expect(
			styleProfilesForFamily("paper-collage").map((profile) => profile.id),
		).toEqual(["paper-collage.paper-cut", "paper-collage.paper-scrapbook"]);
		expect(
			styleProfilesForFamily("playful-route").map((profile) => profile.id),
		).toEqual([
			"playful-route.playful-pop",
			"playful-route.playful-travel-diary",
		]);
	});
});
