import { defineDirection } from "../definition";

export const TOURIST_INFO_DIRECTION = defineDirection({
	id: "tourist-info",
	module: "atlas-grid",
	styleBundleId: "bright",
	touch: "geometric",
	signature: {
		label: "観光案内所パンフレット",
		description: "情報の区分と番号、交通欄を揃える",
	},
});
