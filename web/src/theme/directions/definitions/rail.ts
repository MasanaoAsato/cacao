import { defineDirection } from "../definition";

export const RAIL_DIRECTION = defineDirection({
	id: "rail",
	module: "ledger",
	styleBundleId: "bright",
	touch: "technical",
	signature: { label: "鉄道旅行", description: "時刻表の列、駅名標の見出し" },
	config: { headingSystem: "station-sign", ledgerHeading: "rail" },
});
