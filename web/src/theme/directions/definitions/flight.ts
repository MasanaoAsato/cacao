import { defineDirection } from "../definition";

export const FLIGHT_DIRECTION = defineDirection({
	id: "flight",
	module: "ledger",
	styleBundleId: "bright",
	touch: "geometric",
	signature: {
		label: "飛行機旅行",
		description: "搭乗券風の区切り、荷物タグ、日番号",
	},
	config: { headingSystem: "boarding-pass", ledgerHeading: "flight" },
});
