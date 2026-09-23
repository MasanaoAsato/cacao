import { defineDirection } from "../definition";

export const CHAPTERS_DIRECTION = defineDirection({
	id: "chapters",
	module: "woodcut-folio",
	styleBundleId: "ink",
	touch: "woodcut",
	signature: { label: "章立て型", description: "出発・日別・帰路の章扉" },
	config: { storyFlow: "chapters" },
});
