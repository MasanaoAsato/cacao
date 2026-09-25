import { defineDirection } from "../definition";

export const LUXURY_MAGAZINE_DIRECTION = defineDirection({
	id: "luxury-magazine",
	module: "photo-essay",
	styleBundleId: "quiet",
	touch: "ink-wash",
	config: { imageTreatment: "gallery-margin" },
	signature: {
		label: "高級旅行誌",
		description: "大きな余白、見出しと一枚絵の距離",
	},
});
