import { defineDirection } from "../definition";

export const STORYBOOK_DIRECTION = defineDirection({
	id: "storybook",
	module: "photo-essay",
	styleBundleId: "play",
	touch: "gouache",
	signature: {
		label: "絵本",
		description: "大きな挿絵と独立した物語風の本文帯",
	},
});
