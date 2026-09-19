import { describe, expect, it } from "vitest";
import {
	PLAYFUL_ROUTE_COVER_SUN_ASSET_ID,
	PLAYFUL_ROUTE_DECOR_ASSET_IDS,
	PLAYFUL_ROUTE_DECOR_VARIANT_IDS,
	PLAYFUL_ROUTE_DECOR_VARIANTS,
	PLAYFUL_ROUTE_FAMILY,
	playfulRouteCompositionFor,
	playfulRouteDecorVariantFor,
	playfulRoutePaletteFor,
} from "./playfulRoute";
import { styleProfilesForFamily } from "./styleProfiles";

describe("playful-routeのテーマ定義", () => {
	it("正常系: 2配色・2構図・全パターンの6素材とroute方針を登録する", () => {
		expect(PLAYFUL_ROUTE_FAMILY).toMatchObject({
			compositionIds: ["zigzag", "ribbon"],
			decorAssetIds: [
				"playful-bag",
				"playful-sun",
				"playful-squiggle",
				"playful-burst",
				"playful-footprints",
				"playful-curved-arrow",
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

describe("playful-routeの装飾パターン", () => {
	it("正常系: 候補順はsunny・walkingで、sunnyが20.9の初期配置を保つ", () => {
		expect(PLAYFUL_ROUTE_DECOR_VARIANT_IDS).toEqual(["sunny", "walking"]);
		expect(playfulRouteDecorVariantFor("sunny")).toMatchObject({
			decorAssetIds: [
				"playful-bag",
				"playful-sun",
				"playful-squiggle",
				"playful-burst",
			],
			slots: {
				"playful-cover-bag": {
					assetId: "playful-bag",
					color: "accent",
					offsetMm: [0, 0],
					sizeMm: 24,
				},
				"playful-cover-burst": {
					assetId: "playful-burst",
					color: "border",
					offsetMm: [0, 0],
					sizeMm: 12,
				},
				"playful-day-squiggle": {
					assetId: "playful-squiggle",
					color: "accent",
					offsetMm: [0, 0],
					sizeMm: 8,
				},
			},
		});
	});

	it("正常系: walkingは同じ予約領域を足跡と曲がった矢印で埋める", () => {
		expect(playfulRouteDecorVariantFor("walking")).toMatchObject({
			decorAssetIds: [
				"playful-sun",
				"playful-footprints",
				"playful-curved-arrow",
			],
			slots: {
				"playful-cover-bag": {
					assetId: "playful-footprints",
					color: "accent",
					offsetMm: [0, 0],
					sizeMm: 24,
				},
				"playful-cover-burst": {
					assetId: "playful-curved-arrow",
					color: "border",
					offsetMm: [0, 2],
					sizeMm: 8,
				},
				"playful-day-squiggle": {
					assetId: "playful-curved-arrow",
					color: "accent",
					offsetMm: [0, 0],
					sizeMm: 8,
				},
			},
		});
	});

	it("正常系: 素材集合は実際に描く素材と一致し、矢印を重複登録しない", () => {
		for (const variant of PLAYFUL_ROUTE_DECOR_VARIANTS) {
			const drawn = new Set([
				PLAYFUL_ROUTE_COVER_SUN_ASSET_ID,
				...Object.values(variant.slots).map((slot) => slot.assetId),
			]);
			expect(new Set(variant.decorAssetIds)).toEqual(drawn);
			expect(variant.decorAssetIds).toHaveLength(drawn.size);
		}
		expect(playfulRouteDecorVariantFor("walking").decorAssetIds).toHaveLength(
			3,
		);
	});

	it("正常系: profileの装飾パターンと実使用素材を同じ集合として登録する", () => {
		for (const profile of styleProfilesForFamily("playful-route")) {
			expect(profile.decorVariantId).not.toBeNull();
			expect(profile.decorAssetIds).toEqual(
				playfulRouteDecorVariantFor(profile.decorVariantId).decorAssetIds,
			);
		}
	});

	it("正常系: 表紙だけの読み込み対象は本文専用素材を含めない", () => {
		expect(playfulRouteDecorVariantFor("sunny").coverAssetIds).toEqual([
			"playful-bag",
			"playful-sun",
			"playful-burst",
		]);
		expect(playfulRouteDecorVariantFor("walking").coverAssetIds).toEqual([
			"playful-sun",
			"playful-footprints",
			"playful-curved-arrow",
		]);
	});

	it("正常系: 登録素材の集合は全パターンの重複を除いた和集合になる", () => {
		expect(PLAYFUL_ROUTE_DECOR_ASSET_IDS).toEqual([
			...new Set(
				PLAYFUL_ROUTE_DECOR_VARIANTS.flatMap(
					(variant) => variant.decorAssetIds,
				),
			),
		]);
		expect(PLAYFUL_ROUTE_DECOR_ASSET_IDS).toHaveLength(6);
	});

	it("異常系: nullと未登録のパターンIDを拒否し、sunnyへ補完しない", () => {
		expect(() => playfulRouteDecorVariantFor(null)).toThrow("装飾パターン");
		expect(() => playfulRouteDecorVariantFor("")).toThrow("装飾パターン");
		expect(() => playfulRouteDecorVariantFor("rainy")).toThrow(
			"装飾パターン「rainy」がありません。",
		);
	});
});
