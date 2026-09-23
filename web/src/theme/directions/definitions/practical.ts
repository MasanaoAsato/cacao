import { defineDirection } from "../definition";

export const PRACTICAL_DIRECTION = defineDirection({
	id: "practical",
	module: "ledger",
	styleBundleId: "quiet",
	touch: "none",
	signature: {
		label: "同行者向け実用",
		description: "日付・時刻・場所を常に同じ列に固定",
	},
	config: { ledgerHeading: "practical" },
});
