import { defineDirection } from "../definition";

export const ROAD_TRIP_DIRECTION = defineDirection({
	id: "road-trip",
	module: "schematic-map",
	styleBundleId: "ink",
	touch: "screenprint",
	signature: {
		label: "ロードトリップ",
		description: "太い道と標識形の節、経路に沿う順序",
	},
});
