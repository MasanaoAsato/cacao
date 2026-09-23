import { defineDirection } from "../definition";

export const PHOTO_BOOK_DIRECTION = defineDirection({
	id: "photo-book",
	module: "photo-essay",
	styleBundleId: "quiet",
	touch: "none",
	signature: {
		label: "写真集",
		description: "大きい旅程画像、短いcaption、画像ごとの余白",
	},
});
