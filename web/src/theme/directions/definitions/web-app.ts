import { defineDirection } from "../definition";

export const WEB_APP_DIRECTION = defineDirection({
	id: "web-app",
	module: "quest-board",
	styleBundleId: "bright",
	touch: "geometric",
	signature: {
		label: "Webアプリ",
		description: "タブ風節見出し・ラベルと情報面",
	},
});
