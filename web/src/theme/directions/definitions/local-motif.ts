import { defineDirection } from "../definition";

export const LOCAL_MOTIF_DIRECTION = defineDirection({
	id: "local-motif",
	module: "specimen-board",
	styleBundleId: "warm",
	touch: "cut-paper",
	signature: {
		label: "ご当地モチーフ中心",
		description: "登録された場所の大きい図版と余白",
	},
	coverModule: "paper-collage",
	eligibility: {
		kind: "locale-pack",
		localePackIds: ["kyoto", "tokyo", "paris"],
	},
});
