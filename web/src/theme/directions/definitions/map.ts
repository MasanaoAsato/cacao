import { defineDirection } from "../definition";

export const MAP_DIRECTION = defineDirection({
	id: "map",
	module: "schematic-map",
	styleBundleId: "ink",
	touch: "technical",
	signature: {
		label: "地図中心",
		description: "番号付き概念ルートと本文の対応",
	},
});
