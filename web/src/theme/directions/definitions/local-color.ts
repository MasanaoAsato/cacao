import { defineDirection } from "../definition";

export const LOCAL_COLOR_DIRECTION = defineDirection({
	id: "local-color",
	module: "editorial-magazine",
	styleBundleId: "bright",
	touch: "none",
	signature: {
		label: "ご当地カラー中心",
		description: "登録された場所の配色と大型画像",
	},
	eligibility: {
		kind: "locale-pack",
		localePackIds: ["kyoto", "tokyo", "paris"],
	},
});
