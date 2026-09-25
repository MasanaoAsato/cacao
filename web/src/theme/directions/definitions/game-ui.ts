import { defineDirection } from "../definition";

export const GAME_UI_DIRECTION = defineDirection({
	id: "game-ui",
	module: "quest-board",
	styleBundleId: "night",
	touch: "pixel",
	signature: {
		label: "ゲームUI",
		description: "ステージ番号、HUD状見出し、角のある面",
	},
	config: { contentStructure: "stage-panels", dayHeader: "DAY / MISSION" },
});
