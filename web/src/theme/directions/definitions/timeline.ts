import { defineDirection } from "../definition";

export const TIMELINE_DIRECTION = defineDirection({
	id: "timeline",
	module: "atlas-grid",
	styleBundleId: "bright",
	touch: "technical",
	signature: {
		label: "タイムライン中心",
		description: "時間の一本線と時刻・内容の対置",
	},
});
