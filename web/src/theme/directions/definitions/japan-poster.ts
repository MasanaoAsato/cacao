import { defineDirection } from "../definition";

export const JAPAN_POSTER_DIRECTION = defineDirection({
	id: "japan-poster",
	module: "vertical-poster",
	styleBundleId: "ink",
	touch: "brush",
	signature: {
		label: "日本の観光ポスター",
		description: "縦書き題名と静かな大きい図版",
	},
});
