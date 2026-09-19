import { describe, expect, it } from "vitest";
import {
	BOOKLET_STYLE_PROFILES,
	derivedStyleProfileFields,
	styleProfileFor,
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

	it("異常系: 未登録profile IDを黙って別の作風に補完しない", () => {
		expect(() => styleProfileFor("atlas-grid.unknown")).toThrow(
			"作風プロファイル",
		);
	});

	it("境界値: profileから導出する候補集合は重複を除き、実使用素材を保つ", () => {
		const fields = derivedStyleProfileFields(
			styleProfilesForFamily("playful-route"),
		);

		expect(fields.paletteIds).toEqual(["berry-sun", "harbor-play"]);
		expect(fields.compositionIds).toEqual(["zigzag", "ribbon"]);
		expect(fields.decorAssetIds).toEqual([
			"playful-bag",
			"playful-sun",
			"playful-squiggle",
			"playful-burst",
			"playful-footprints",
			"playful-curved-arrow",
		]);
		expect(() => derivedStyleProfileFields([])).toThrow(
			"作風プロファイルがありません",
		);
	});
});
