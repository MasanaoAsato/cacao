import { defineDirection } from "../definition";

export const TRAVEL_NOTE_DIRECTION = defineDirection({
	id: "travel-note",
	module: "atlas-grid",
	styleBundleId: "warm",
	touch: "pencil",
	signature: {
		label: "トラベルノート",
		description: "方眼、余白の書込み、鉛筆の観察線",
	},
});
