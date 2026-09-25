import { defineDirection } from "../definition";

export const MISSION_DIRECTION = defineDirection({
	id: "mission",
	module: "quest-board",
	styleBundleId: "play",
	touch: "pixel",
	signature: {
		label: "旅のミッションブック",
		description: "予定名を使った訪問ミッションと達成欄",
	},
	config: { participation: "mission" },
});
