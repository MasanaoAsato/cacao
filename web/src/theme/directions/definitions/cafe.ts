import { defineDirection } from "../definition";

export const CAFE_DIRECTION = defineDirection({
	id: "cafe",
	module: "ledger",
	styleBundleId: "warm",
	touch: "chalk",
	signature: {
		label: "カフェメニュー",
		description: "黒板面、手描きのカテゴリ罫線",
	},
});
