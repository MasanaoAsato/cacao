import { defineDirection } from "../definition";

export const CHECKLIST_DIRECTION = defineDirection({
	id: "checklist",
	module: "ledger",
	styleBundleId: "bright",
	touch: "pencil",
	signature: {
		label: "チェックリスト中心",
		description: "予定ごとのチェック欄と一覧性",
	},
	config: { participation: "checklist" },
});
