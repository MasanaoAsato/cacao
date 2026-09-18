import { describe, expect, it } from "vitest";
import { createFamilyRegistry, familyDefinitionFor } from "./registry";

describe("BOOKLET_FAMILY_REGISTRY", () => {
	it.each(["field-notes", "quiet-gallery"] as const)(
		"正常系: %sをpaper-collageへ割り当てる",
		(moodId) => {
			expect(familyDefinitionFor(moodId)).toMatchObject({
				compositionIds: ["photo-left", "photo-right"],
				decorAssetIds: [
					"paper-torn-sheet",
					"paper-tape",
					"paper-leaf",
					"paper-postage",
				],
				fontFamilies: ["Kaisei Decol", "Noto Serif JP", "Noto Sans JP"],
				id: "paper-collage",
				moodIds: ["field-notes", "quiet-gallery"],
				paletteIds: ["sage-paper", "lilac-paper"],
				policyId: "captions",
			});
		},
	);

	it.each(["wayfinder", "night-train"] as const)(
		"正常系: %sをatlas-gridへ割り当てる",
		(moodId) => {
			expect(familyDefinitionFor(moodId)).toMatchObject({
				compositionIds: ["wide-image", "side-index"],
				decorAssetIds: [
					"atlas-compass",
					"atlas-route-mark",
					"atlas-perforation",
				],
				fontFamilies: ["Zen Kaku Gothic New", "Noto Sans JP"],
				id: "atlas-grid",
				moodIds: ["wayfinder", "night-train"],
				paletteIds: ["blueprint", "forest-atlas"],
				policyId: "timetable",
			});
		},
	);
});

describe("createFamilyRegistry", () => {
	it("正常系: legacyが全moodを担当できる", () => {
		const registry = createFamilyRegistry([
			{
				id: "legacy",
				moodIds: [
					"field-notes",
					"wayfinder",
					"postcard",
					"night-train",
					"quiet-gallery",
					"festival-ticket",
				],
				policyId: "legacy-full",
			},
		]);

		expect(registry.get("wayfinder")?.id).toBe("legacy");
	});

	it("異常系: 同じmoodを複数の系統へ登録できない", () => {
		expect(() =>
			createFamilyRegistry([
				{
					id: "legacy",
					moodIds: [
						"field-notes",
						"wayfinder",
						"postcard",
						"night-train",
						"quiet-gallery",
						"festival-ticket",
					],
					policyId: "legacy-full",
				},
				{
					compositionIds: ["table"],
					decorAssetIds: ["atlas-compass"],
					fontFamilies: ["Noto Sans JP"],
					id: "atlas-grid",
					moodIds: ["wayfinder"],
					paletteIds: ["atlas-blue"],
					policyId: "timetable",
				},
			]),
		).toThrow("複数の系統");
	});

	it("境界値: 空の配色候補を持つ新系統を拒否する", () => {
		expect(() =>
			createFamilyRegistry([
				{
					id: "legacy",
					moodIds: [
						"field-notes",
						"postcard",
						"night-train",
						"quiet-gallery",
						"festival-ticket",
					],
					policyId: "legacy-full",
				},
				{
					compositionIds: ["table"],
					decorAssetIds: ["atlas-compass"],
					fontFamilies: ["Noto Sans JP"],
					id: "atlas-grid",
					moodIds: ["wayfinder"],
					paletteIds: [],
					policyId: "timetable",
				},
			]),
		).toThrow("配色・構図・素材・書体が不足しています");
	});
});
