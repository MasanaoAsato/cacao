import { describe, expect, it, vi } from "vitest";
import { createBookletTheme, getFontPairFamilies } from "../bookletTheme";
import { designKey } from "../resolve";
import type { MoodId } from "../types";
import {
	resolveBookletDesign,
	resolveBookletDesignForFamily,
} from "./resolveBookletDesign";

/** Forces one value on the decor-variant axis so its boundaries are testable. */
const axisStub = vi.hoisted(() => ({
	axis: "family-style:playful-route",
	value: null as number | null,
}));

vi.mock("../seed", async (importOriginal) => {
	const actual = await importOriginal<typeof import("../seed")>();
	return {
		...actual,
		axisRandom: (seedToken: string, axis: string) =>
			axis === axisStub.axis && axisStub.value !== null
				? axisStub.value
				: actual.axisRandom(seedToken, axis),
	};
});

function designForMood(seed: number, moodId: MoodId) {
	const requested = createBookletTheme({ value: seed, version: "v2" });
	return resolveBookletDesign({
		...requested,
		recipe: { ...requested.recipe, moodId },
	});
}

const LEGACY_FAMILY = {
	id: "legacy",
	moodIds: ["postcard"],
	policyId: "legacy-full",
} as const;

describe("resolveBookletDesign", () => {
	it("正常系: 同じv2シードから同じ設計を解決する", () => {
		const requested = createBookletTheme({ value: 7, version: "v2" });

		expect(resolveBookletDesign(requested)).toEqual(
			resolveBookletDesign(requested),
		);
	});

	it("異常系: 未登録moodは系統の解決時に拒否される", () => {
		const requested = createBookletTheme({ value: 7, version: "v2" });
		const invalid = {
			...requested,
			recipe: { ...requested.recipe, moodId: "unknown" },
		};

		expect(() => resolveBookletDesign(invalid as typeof requested)).toThrow(
			"系統が登録されていません",
		);
	});

	it("境界値: legacyの比較キーは既存designKeyを維持する", () => {
		const requested = createBookletTheme({ value: 0, version: "v2" });
		const legacyRequested = {
			...requested,
			recipe: { ...requested.recipe, moodId: "postcard" as const },
		};
		const design = resolveBookletDesignForFamily(
			legacyRequested,
			LEGACY_FAMILY,
		);

		expect(design.comparisonKey).toBe(designKey(legacyRequested.recipe));
		expect(design.renderKey).toBe(
			`legacy:${legacyRequested.seedToken}:legacy-full:${design.comparisonKey}`,
		);
	});

	it("境界値: 表示書体を持たないテーマではnullを必要書体へ含めない", () => {
		const requested = createBookletTheme({ value: 0, version: "v2" });
		const legacyRequested = {
			...requested,
			recipe: {
				...requested.recipe,
				displayFontId: "inherit" as const,
				moodId: "postcard" as const,
			},
		};
		const design = resolveBookletDesignForFamily(
			legacyRequested,
			LEGACY_FAMILY,
		);

		expect(design.fontFamilies).toEqual(
			getFontPairFamilies(legacyRequested.recipe.fontPairId),
		);
	});

	it("正常系: atlas-gridの素材・書体・掲載方針を解決する", () => {
		const design = designForMood(7, "wayfinder");

		expect(design).toMatchObject({
			comparisonKey: `atlas-grid.${design.styleProfileId}.${design.paletteId}.${design.compositionId}`,
			decorAssetIds: ["atlas-compass", "atlas-route-mark", "atlas-perforation"],
			decorVariantId: null,
			familyId: "atlas-grid",
			fontFamilies: ["Zen Kaku Gothic New", "Noto Sans JP"],
			policyId: "timetable",
			styleProfileId: "atlas-grid.atlas-wayfinder",
		});
	});

	it("正常系: paper-collageの素材・書体・掲載方針を解決する", () => {
		const design = designForMood(7, "field-notes");

		expect(design).toMatchObject({
			comparisonKey: `paper-collage.${design.styleProfileId}.${design.paletteId}.${design.compositionId}`,
			decorAssetIds: [
				"paper-torn-sheet",
				"paper-tape",
				"paper-leaf",
				"paper-postage",
			],
			decorVariantId: null,
			familyId: "paper-collage",
			fontFamilies: ["Kaisei Decol", "Noto Serif JP", "Noto Sans JP"],
			policyId: "captions",
			styleProfileId: "paper-collage.paper-cut",
		});
	});

	it("正常系: playful-routeは選んだパターンの素材だけを解決する", () => {
		const design = designForMood(7, "postcard");

		expect(design).toMatchObject({
			comparisonKey:
				"playful-route.playful-route.playful-travel-diary.harbor-play.ribbon.walking",
			decorAssetIds: [
				"playful-sun",
				"playful-footprints",
				"playful-curved-arrow",
			],
			decorVariantId: "walking",
			familyId: "playful-route",
			fontFamilies: ["Dela Gothic One", "Noto Sans JP"],
			policyId: "route",
			styleProfileId: "playful-route.playful-travel-diary",
		});
		expect(design.renderKey).toBe(
			`playful-route:${design.seedToken}:route:${design.comparisonKey}`,
		);
		expect(design).toEqual(designForMood(7, "postcard"));
	});

	it("正常系: sunnyのprofileは20.9の4素材を解決する", () => {
		const requested = createBookletTheme({ value: 58, version: "v2" });
		axisStub.value = 0;
		const design = resolveBookletDesign(requested);
		axisStub.value = null;

		expect(design).toMatchObject({
			comparisonKey:
				"playful-route.playful-route.playful-pop.berry-sun.ribbon.sunny",
			decorAssetIds: [
				"playful-bag",
				"playful-sun",
				"playful-squiggle",
				"playful-burst",
			],
			decorVariantId: "sunny",
			styleProfileId: "playful-route.playful-pop",
		});
	});

	it("正常系: profileの違いを比較キーと実使用素材が区別する", () => {
		const requested = createBookletTheme({ value: 58, version: "v2" });
		axisStub.value = 0;
		const sunny = resolveBookletDesign(requested);
		axisStub.value = 0.5;
		const walking = resolveBookletDesign(requested);
		axisStub.value = null;

		expect(walking.styleProfileId).not.toBe(sunny.styleProfileId);
		expect(walking.comparisonKey).not.toBe(sunny.comparisonKey);
		expect(walking.decorAssetIds).not.toEqual(sunny.decorAssetIds);
	});

	it("境界値: 抽選値0・0.5未満はpop、0.5・1未満はtravel diaryを選ぶ", () => {
		const requested = createBookletTheme({ value: 28, version: "v2" });
		const expected: readonly [number, string][] = [
			[0, "playful-route.playful-pop"],
			[0.5 - Number.EPSILON, "playful-route.playful-pop"],
			[0.5, "playful-route.playful-travel-diary"],
			[1 - Number.EPSILON, "playful-route.playful-travel-diary"],
		];

		try {
			for (const [axisValue, styleProfileId] of expected) {
				axisStub.value = axisValue;
				expect(resolveBookletDesign(requested).styleProfileId).toBe(
					styleProfileId,
				);
			}
		} finally {
			axisStub.value = null;
		}
	});
});
