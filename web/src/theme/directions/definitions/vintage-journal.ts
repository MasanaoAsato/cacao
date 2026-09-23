import { defineDirection } from "../definition";

export const VINTAGE_JOURNAL_DIRECTION = defineDirection({
	id: "vintage-journal",
	module: "woodcut-folio",
	styleBundleId: "ink",
	touch: "engraving",
	signature: {
		label: "ヴィンテージ旅行記",
		description: "細密な図版、欄外注、セリフ中心",
	},
});
