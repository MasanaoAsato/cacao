import { defineDirection } from "../definition";

export const DATA_BOOK_DIRECTION = defineDirection({
	id: "data-book",
	module: "ledger",
	styleBundleId: "bright",
	touch: "technical",
	signature: {
		label: "データブック",
		description: "移動時間・予算・費用の数値列",
	},
	config: { ledgerHeading: "data-book" },
});
