import { defineDirection } from "../definition";

export const MINIMAL_DIRECTION = defineDirection({
	id: "minimal",
	module: "woodcut-folio",
	styleBundleId: "bright",
	touch: "none",
	signature: {
		label: "ミニマル",
		description: "装飾なし、罫線を減らし名称と時間を優先",
	},
	config: { minimalDecoration: true },
});
