import { defineDirection } from "../definition";

export const SCRAPBOOK_DIRECTION = defineDirection({
	id: "scrapbook",
	module: "paper-collage",
	styleBundleId: "warm",
	touch: "cut-paper",
	signature: {
		label: "スクラップブック",
		description: "写真と紙片の重なり、独立した台紙",
	},
	config: { imageTreatment: "collage" },
});
