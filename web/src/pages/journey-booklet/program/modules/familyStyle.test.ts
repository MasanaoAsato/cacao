import { describe, expect, it } from "vitest";
import { familyProfileById } from "./familyStyle";

describe("familyProfileById", () => {
	it("正常系: 指定familyに登録された作風を返す", () => {
		const profile = familyProfileById(
			"playful-route",
			"playful-route.playful-pop",
		);
		expect(profile.familyId).toBe("playful-route");
		expect(profile.decorVariantId).toBe("sunny");
	});

	it("異常系: 未登録profile IDを黙って別の作風に補完しない", () => {
		expect(() => familyProfileById("atlas-grid", "atlas-grid.unknown")).toThrow(
			"作風プロファイル",
		);
	});

	it("境界値系: 登録済みでも別familyの作風は返さない", () => {
		expect(() =>
			familyProfileById("atlas-grid", "paper-collage.paper-cut"),
		).toThrow("atlas-gridの作風プロファイル");
	});
});
