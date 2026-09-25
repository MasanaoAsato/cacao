import { defineDirection } from "../definition";

export const BOARD_GAME_DIRECTION = defineDirection({
	id: "board-game",
	module: "playful-route",
	styleBundleId: "play",
	touch: "cut-paper",
	signature: {
		label: "ボードゲーム",
		description: "マスの連続、イベント単位、ゲーム盤の面",
	},
	config: { contentStructure: "board-squares", dayHeader: "DAY / EVENT" },
});
