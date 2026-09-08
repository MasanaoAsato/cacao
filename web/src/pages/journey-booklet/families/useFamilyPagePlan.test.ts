import { describe, expect, it } from "vitest";
import type { ResolvedBookletDesign } from "../../../booklet/family";
import type { BookletModel } from "../../../booklet/model";
import { isCurrentFamilyPagePlan } from "./useFamilyPagePlan";

const model = {} as BookletModel;
const design = {
	renderKey: "legacy:v2-00000000:legacy-full:key",
} as ResolvedBookletDesign;

describe("isCurrentFamilyPagePlan", () => {
	it("正常系: 同じモデルとrenderKeyで準備済みならtrueを返す", () => {
		expect(
			isCurrentFamilyPagePlan(
				{ preparedModel: model, preparedRenderKey: design.renderKey },
				model,
				design,
			),
		).toBe(true);
	});

	it("異常系: 別のモデルで計測した結果を印刷準備済みにしない", () => {
		expect(
			isCurrentFamilyPagePlan(
				{
					preparedModel: {} as BookletModel,
					preparedRenderKey: design.renderKey,
				},
				model,
				design,
			),
		).toBe(false);
	});

	it("境界値: 同一モデルでもrenderKeyが異なれば印刷準備済みにしない", () => {
		expect(
			isCurrentFamilyPagePlan(
				{ preparedModel: model, preparedRenderKey: "previous-render-key" },
				model,
				design,
			),
		).toBe(false);
	});
});
