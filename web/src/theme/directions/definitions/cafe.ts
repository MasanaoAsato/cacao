import { defineDirection } from "../definition";

export const CAFE_DIRECTION = defineDirection({
	id: "cafe",
	module: "ledger",
	styleBundleId: "night",
	touch: "chalk",
	config: { headingSystem: "chalkboard" },
	signature: {
		label: "カフェメニュー",
		description: "黒板面、手描きのカテゴリ罫線",
	},
});
