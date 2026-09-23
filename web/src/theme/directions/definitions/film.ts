import { defineDirection } from "../definition";

export const FILM_DIRECTION = defineDirection({
	id: "film",
	module: "photo-essay",
	styleBundleId: "warm",
	touch: "charcoal",
	signature: {
		label: "フィルム写真",
		description: "余白とフィルム縁、画像だけに粒子処理",
	},
});
