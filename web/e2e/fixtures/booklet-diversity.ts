import { createBookletModel } from "../../src/booklet/fromJourney";
import { COMPARISON_BOOKLET_RESPONSES } from "./booklet.js";

/** Repeatable catalog samples: all use the same trip, cover and A5 scale. */
export const DIVERSITY_SAMPLES = [
	{ id: "comparison-6", seed: 6 },
	{ id: "comparison-16", seed: 16 },
	{ id: "comparison-19", seed: 19 },
] as const;

/** The exact API fixture that the browser opens, converted by the product mapper. */
export const COMPARISON_BOOKLET_MODEL = createBookletModel({
	coverImage: COMPARISON_BOOKLET_RESPONSES.images[0] as Parameters<
		typeof createBookletModel
	>[0]["coverImage"],
	illustrationImages: COMPARISON_BOOKLET_RESPONSES.images.slice(
		1,
	) as Parameters<typeof createBookletModel>[0]["illustrationImages"],
	journey: COMPARISON_BOOKLET_RESPONSES.journey,
	request: COMPARISON_BOOKLET_RESPONSES.request,
});
