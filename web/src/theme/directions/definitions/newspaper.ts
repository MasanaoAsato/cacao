import { defineDirection } from "../definition";

export const NEWSPAPER_DIRECTION = defineDirection({
	id: "newspaper",
	module: "travel-newspaper",
	styleBundleId: "ink",
	touch: "risograph",
	signature: { label: "新聞", description: "題字、記事見出し、複数段と罫線" },
});
