import { defineDirection } from "../definition";

export const POLAROID_DIRECTION = defineDirection({
	id: "polaroid",
	module: "paper-collage",
	styleBundleId: "warm",
	touch: "pencil",
	signature: {
		label: "ポラロイドアルバム",
		description: "写真の白枠と下の書込み余白",
	},
	config: { imageTreatment: "polaroid" },
});
