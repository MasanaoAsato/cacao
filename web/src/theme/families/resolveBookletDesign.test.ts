import { describe, expect, it, vi } from "vitest";
import { createBookletTheme, getFontPairFamilies } from "../bookletTheme";
import { designKey } from "../resolve";
import {
	ACTIVE_BOOKLET_FAMILY_IDS,
	BOOKLET_FAMILY_REGISTRY,
	familyDefinitionById,
} from "./registry";
import {
	resolveBookletDesign,
	resolveBookletDesignForFamily,
} from "./resolveBookletDesign";

const axisStub = vi.hoisted(() => ({
	values: {} as Record<string, number>,
}));

vi.mock("../seed", async (importOriginal) => {
	const actual = await importOriginal<typeof import("../seed")>();
	return {
		...actual,
		axisRandom: (seedToken: string, axis: string) =>
			axisStub.values[axis] ?? actual.axisRandom(seedToken, axis),
	};
});

function setAxis(axis: string, value: number | null): void {
	if (value === null) {
		delete axisStub.values[axis];
	} else {
		axisStub.values[axis] = value;
	}
}

function requested(seed = 7) {
	return createBookletTheme({ value: seed, version: "v2" });
}

function designForFamilyIndex(index: number, style = 0) {
	setAxis("booklet-family", index / ACTIVE_BOOKLET_FAMILY_IDS.length);
	setAxis(`family-style:${ACTIVE_BOOKLET_FAMILY_IDS[index]}`, style);
	return resolveBookletDesign(requested());
}

function clearAxes(): void {
	axisStub.values = {};
}

const LEGACY_FAMILY = {
	id: "legacy",
	moodIds: ["postcard"],
	policyId: "legacy-full",
} as const;

describe("resolveBookletDesign", () => {
	it("正常系: 同じv2シードから同じ設計を解決する", () => {
		clearAxes();
		const theme = requested();
		expect(resolveBookletDesign(theme)).toEqual(resolveBookletDesign(theme));
	});

	it("正常系: family選択はmoodから独立している", () => {
		setAxis("booklet-family", 0.21);
		setAxis("family-style:paper-collage", 0);
		const theme = requested();
		const fieldNotes = resolveBookletDesign({
			...theme,
			recipe: { ...theme.recipe, moodId: "field-notes" },
		});
		const unknownMood = resolveBookletDesign({
			...theme,
			recipe: { ...theme.recipe, moodId: "unknown" },
		} as typeof theme);
		expect(fieldNotes.familyId).toBe("paper-collage");
		expect(unknownMood.familyId).toBe(fieldNotes.familyId);
		clearAxes();
	});

	it.each([
		[0, "atlas-grid"],
		[1 / 5 - Number.EPSILON, "atlas-grid"],
		[1 / 5, "paper-collage"],
		[2 / 5, "playful-route"],
		[3 / 5, "editorial-magazine"],
		[4 / 5 - Number.EPSILON, "editorial-magazine"],
		[4 / 5, "travel-newspaper"],
		[1 - Number.EPSILON, "travel-newspaper"],
	] as const)("境界値: family軸 %s は固定順の %sを選ぶ", (axis, familyId) => {
		setAxis("booklet-family", axis);
		expect(resolveBookletDesign(requested()).familyId).toBe(familyId);
		clearAxes();
	});

	it("正常系: 固定順の5候補をすべて選べる", () => {
		const selected = ACTIVE_BOOKLET_FAMILY_IDS.map(
			(_, index) => designForFamilyIndex(index).familyId,
		);
		expect(selected).toEqual([...ACTIVE_BOOKLET_FAMILY_IDS]);
		clearAxes();
	});

	it("正常系: style候補数はfamilyの抽選確率を変えない", () => {
		setAxis("booklet-family", 0.4);
		setAxis("family-style:playful-route", 0);
		const first = resolveBookletDesign(requested());
		setAxis("family-style:playful-route", 1 - Number.EPSILON);
		const last = resolveBookletDesign(requested());
		expect(first.familyId).toBe("playful-route");
		expect(last.familyId).toBe("playful-route");
		expect(first.styleProfileId).not.toBe(last.styleProfileId);
		clearAxes();
	});

	it("正常系: atlas-gridの素材・書体・掲載方針を解決する", () => {
		const design = designForFamilyIndex(0);
		expect(design).toMatchObject({
			comparisonKey: `atlas-grid.${design.styleProfileId}.${design.paletteId}.${design.compositionId}`,
			decorAssetIds: ["atlas-compass", "atlas-route-mark", "atlas-perforation"],
			familyId: "atlas-grid",
			fontFamilies: ["Zen Kaku Gothic New", "Noto Sans JP"],
			policyId: "timetable",
			styleProfileId: "atlas-grid.atlas-wayfinder",
		});
		clearAxes();
	});

	it("正常系: CSS-only familyは空のdecorを解決する", () => {
		const design = designForFamilyIndex(3);
		expect(design.familyId).toBe("editorial-magazine");
		expect(design.decorAssetIds).toEqual([]);
		clearAxes();
	});

	it("境界値: legacyの比較キーと必要書体は既存契約を維持する", () => {
		const theme = requested(0);
		const legacyTheme = {
			...theme,
			recipe: {
				...theme.recipe,
				moodId: "postcard" as const,
				displayFontId: "inherit" as const,
			},
		};
		const design = resolveBookletDesignForFamily(legacyTheme, LEGACY_FAMILY);
		expect(design.comparisonKey).toBe(designKey(legacyTheme.recipe));
		expect(design.renderKey).toBe(
			`legacy:${legacyTheme.seedToken}:legacy-full:${design.comparisonKey}`,
		);
		expect(design.fontFamilies).toEqual(
			getFontPairFamilies(legacyTheme.recipe.fontPairId),
		);
	});

	it("正常系: family registryの全IDが解決できる", () => {
		for (const [familyId, definition] of BOOKLET_FAMILY_REGISTRY) {
			expect(familyDefinitionById(familyId)).toBe(definition);
		}
	});
});
