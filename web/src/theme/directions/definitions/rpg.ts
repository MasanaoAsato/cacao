import { defineDirection } from "../definition";

export const RPG_DIRECTION = defineDirection({
	id: "rpg",
	module: "quest-board",
	styleBundleId: "ink",
	touch: "engraving",
	signature: {
		label: "RPG冒険の書",
		description: "冒険の章、地図風図版、紋章と余白",
	},
	config: { dayHeader: "第○章 / 訪問地点" },
});
