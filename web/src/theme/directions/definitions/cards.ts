import { defineDirection } from "../definition";

export const CARDS_DIRECTION = defineDirection({
	id: "cards",
	module: "quest-board",
	styleBundleId: "bright",
	touch: "geometric",
	config: { contentStructure: "cards" },
	signature: {
		label: "カードUI",
		description: "情報の独立した矩形、一定の余白",
	},
});
