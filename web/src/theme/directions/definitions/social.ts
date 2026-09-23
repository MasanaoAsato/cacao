import { defineDirection } from "../definition";

export const SOCIAL_DIRECTION = defineDirection({
	id: "social",
	module: "paper-collage",
	styleBundleId: "bright",
	touch: "screenprint",
	signature: {
		label: "SNS投稿",
		description: "画像と短文の投稿単位、場所ラベル",
	},
});
