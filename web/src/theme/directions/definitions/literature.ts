import { defineDirection } from "../definition";

export const LITERATURE_DIRECTION = defineDirection({
	id: "literature",
	module: "woodcut-folio",
	styleBundleId: "ink",
	touch: "brush",
	config: { headingSystem: "literary" },
	signature: {
		label: "紀行文・文学作品",
		description: "明朝本文、短い旅程文、欄外日番号",
	},
});
