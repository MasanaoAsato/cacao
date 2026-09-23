import { defineDirection } from "../definition";

export const STAMP_DIRECTION = defineDirection({
	id: "stamp",
	module: "quest-board",
	styleBundleId: "bright",
	touch: "screenprint",
	signature: { label: "スタンプラリー", description: "予定ごとに紙上の押印欄" },
});
