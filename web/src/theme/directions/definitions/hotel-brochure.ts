import { defineDirection } from "../definition";

export const HOTEL_BROCHURE_DIRECTION = defineDirection({
	id: "hotel-brochure",
	module: "atlas-grid",
	styleBundleId: "night",
	touch: "geometric",
	signature: {
		label: "ホテルパンフレット",
		description: "整列した情報帯と写真、金色の罫線",
	},
});
