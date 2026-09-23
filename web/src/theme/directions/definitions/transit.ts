import { defineDirection } from "../definition";

export const TRANSIT_DIRECTION = defineDirection({
	id: "transit",
	module: "schematic-map",
	styleBundleId: "bright",
	touch: "geometric",
	signature: { label: "路線図", description: "連続する線、番号付き駅型ノード" },
});
