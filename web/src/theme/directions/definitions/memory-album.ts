import { defineDirection } from "../definition";

export const MEMORY_ALBUM_DIRECTION = defineDirection({
	id: "memory-album",
	module: "paper-collage",
	styleBundleId: "warm",
	touch: "pencil",
	signature: {
		label: "アルバム兼用",
		description: "今日の一枚・感想の紙上記入欄",
	},
	config: { participation: "memory-album" },
});
