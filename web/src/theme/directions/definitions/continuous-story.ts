import { defineDirection } from "../definition";

export const CONTINUOUS_STORY_DIRECTION = defineDirection({
	id: "continuous-story",
	module: "schematic-map",
	styleBundleId: "quiet",
	touch: "woodcut",
	signature: {
		label: "表紙から裏表紙まで一枚の旅",
		description: "出発から旅程、帰路へ進む連続線と終章",
	},
	config: { storyFlow: "continuous-story" },
});
