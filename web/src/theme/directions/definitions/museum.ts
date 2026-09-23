import { defineDirection } from "../definition";

export const MUSEUM_DIRECTION = defineDirection({
	id: "museum",
	module: "woodcut-folio",
	styleBundleId: "quiet",
	touch: "engraving",
	signature: {
		label: "博物館パンフレット",
		description: "図版番号、解説中心、細い罫線",
	},
	config: { numberedEntries: true },
});
