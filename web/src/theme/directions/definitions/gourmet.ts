import { defineDirection } from "../definition";

export const GOURMET_DIRECTION = defineDirection({
	id: "gourmet",
	module: "specimen-board",
	styleBundleId: "warm",
	touch: "gouache",
	signature: {
		label: "グルメガイド",
		description: "料理を描いた装飾と店舗紹介風の説明枠",
	},
	config: { numberedEntries: true },
	coverModule: "paper-collage",
});
