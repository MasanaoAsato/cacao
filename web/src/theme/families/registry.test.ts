import { describe, expect, it } from "vitest";
import type { BookletFamilyDefinition } from "./registry";
import {
	ACTIVE_BOOKLET_FAMILY_IDS,
	BOOKLET_FAMILY_REGISTRY,
	createFamilyRegistry,
	familyDefinitionById,
} from "./registry";
import { styleProfilesForFamily } from "./styleProfiles";

function validAtlas(
	overrides: Partial<
		Extract<BookletFamilyDefinition, { id: "atlas-grid" }>
	> = {},
): Extract<BookletFamilyDefinition, { id: "atlas-grid" }> {
	return {
		compositionIds: ["table"],
		decorAssetIds: ["atlas-compass"],
		fontFamilies: ["Noto Sans JP"],
		id: "atlas-grid",
		paletteIds: ["atlas-blue"],
		policyId: "timetable",
		styleProfiles: styleProfilesForFamily("atlas-grid"),
		...overrides,
	};
}

describe("BOOKLET_FAMILY_REGISTRY", () => {
	it("正常系: active候補を固定順でID lookupできる", () => {
		expect(ACTIVE_BOOKLET_FAMILY_IDS).toEqual([
			"atlas-grid",
			"paper-collage",
			"playful-route",
			"editorial-magazine",
			"travel-newspaper",
		]);
		for (const familyId of ACTIVE_BOOKLET_FAMILY_IDS) {
			expect(familyDefinitionById(familyId).id).toBe(familyId);
			expect(BOOKLET_FAMILY_REGISTRY.get(familyId)?.id).toBe(familyId);
		}
	});

	it("正常系: legacyはcatalogのID lookupへ残る", () => {
		expect(familyDefinitionById("legacy")).toMatchObject({
			id: "legacy",
			policyId: "legacy-full",
		});
	});

	it("異常系: 未登録IDを拒否する", () => {
		expect(() => familyDefinitionById("unknown" as never)).toThrow(
			"系統「unknown」が登録されていません",
		);
	});

	it("異常系: 同じfamily IDを複数登録できない", () => {
		expect(() => createFamilyRegistry([validAtlas(), validAtlas()])).toThrow(
			"系統「atlas-grid」が重複しています",
		);
	});

	it("境界値: moodなしのfamily定義を受け付ける", () => {
		const registry = createFamilyRegistry([validAtlas()]);
		expect(registry.get("atlas-grid")?.id).toBe("atlas-grid");
		expect(registry.get("wayfinder" as never)).toBeUndefined();
	});

	it("異常系: 空のstyle候補を拒否する", () => {
		expect(() =>
			createFamilyRegistry([validAtlas({ styleProfiles: [] })]),
		).toThrow("配色・構図・素材・書体が不足しています");
	});
});
