import { defineDirection } from "../definition";

export const DAY_STORY_DIRECTION = defineDirection({
	id: "day-story",
	module: "photo-essay",
	styleBundleId: "quiet",
	touch: "gouache",
	signature: {
		label: "一日の物語型",
		description: "朝・昼・夕・夜の節扉と日別挿絵",
	},
	config: { storyFlow: "time-sections" },
});
