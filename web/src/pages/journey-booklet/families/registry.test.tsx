import { describe, expect, it } from "vitest";
import { createFamilyAdapterRegistry } from "./registry";

describe("createFamilyAdapterRegistry", () => {
	it("正常系: 登録済み系統に対応するアダプターを受け付ける", () => {
		const registry = createFamilyAdapterRegistry(
			[
				{
					familyId: "legacy",
					renderer: () => null,
					usePagePlan: () => null as never,
				},
			],
			["legacy"],
		);

		expect(registry.get("legacy")).toBeDefined();
	});

	it("異常系: 登録済み系統のアダプターがなければ拒否する", () => {
		expect(() => createFamilyAdapterRegistry([], ["legacy"])).toThrow(
			"アダプターが登録されていません",
		);
	});

	it("境界値: 同じ系統のアダプターを重複登録できない", () => {
		expect(() =>
			createFamilyAdapterRegistry(
				[
					{
						familyId: "legacy",
						renderer: () => null,
						usePagePlan: () => null as never,
					},
					{
						familyId: "legacy",
						renderer: () => null,
						usePagePlan: () => null as never,
					},
				],
				["legacy"],
			),
		).toThrow("アダプターが重複しています");
	});
});
