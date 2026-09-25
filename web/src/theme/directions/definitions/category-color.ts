import { defineDirection } from "../definition";

export const CATEGORY_COLOR_DIRECTION = defineDirection({
	id: "category-color",
	module: "atlas-grid",
	styleBundleId: "bright",
	touch: "geometric",
	config: { contentStructure: "category-bands" },
	signature: {
		label: "色分けスケジュール型",
		description: "交通欄と訪問欄の帯、色に文字ラベルを併記",
	},
});
