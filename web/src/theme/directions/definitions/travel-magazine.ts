import { defineDirection } from "../definition";

export const TRAVEL_MAGAZINE_DIRECTION = defineDirection({
	id: "travel-magazine",
	module: "editorial-magazine",
	styleBundleId: "bright",
	touch: "screenprint",
	signature: {
		label: "旅行雑誌",
		description: "大型写真・細い見出し・特集の段組",
	},
});
