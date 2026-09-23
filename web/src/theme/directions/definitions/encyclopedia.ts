import { defineDirection } from "../definition";

export const ENCYCLOPEDIA_DIRECTION = defineDirection({
	id: "encyclopedia",
	module: "specimen-board",
	styleBundleId: "ink",
	touch: "engraving",
	signature: { label: "図鑑", description: "番号付き標本と揃った解説項目" },
	config: { numberedEntries: true },
	coverModule: "paper-collage",
});
