import type {
	PlayfulRouteCompositionId,
	PlayfulRouteDecorVariantId,
	PlayfulRoutePaletteId,
} from "../../src/theme/families/playfulRoute.js";

export type PlayfulRouteSample = {
	readonly compositionId: PlayfulRouteCompositionId;
	readonly decorVariantId: PlayfulRouteDecorVariantId;
	readonly paletteId: PlayfulRoutePaletteId;
	readonly seed: number;
};

/**
 * One fixed seed per palette × composition × decor variant. Found by walking
 * the product resolver upwards from 0 at implementation time (20.11) and
 * frozen here, so the spec checks the selection rules instead of repeating
 * them. The four seeds 20.9 already used keep their meaning.
 */
export const PLAYFUL_ROUTE_SAMPLES: readonly PlayfulRouteSample[] = [
	{
		compositionId: "ribbon",
		decorVariantId: "sunny",
		paletteId: "berry-sun",
		seed: 2,
	},
	{
		compositionId: "zigzag",
		decorVariantId: "walking",
		paletteId: "berry-sun",
		seed: 15,
	},
	{
		compositionId: "zigzag",
		decorVariantId: "walking",
		paletteId: "harbor-play",
		seed: 20,
	},
	{
		compositionId: "ribbon",
		decorVariantId: "sunny",
		paletteId: "harbor-play",
		seed: 21,
	},
	{
		compositionId: "ribbon",
		decorVariantId: "walking",
		paletteId: "harbor-play",
		seed: 23,
	},
	{
		compositionId: "zigzag",
		decorVariantId: "sunny",
		paletteId: "harbor-play",
		seed: 38,
	},
	{
		compositionId: "ribbon",
		decorVariantId: "walking",
		paletteId: "berry-sun",
		seed: 53,
	},
	{
		compositionId: "zigzag",
		decorVariantId: "sunny",
		paletteId: "berry-sun",
		seed: 58,
	},
];

/** The pair that differs only in the decor variant, for the visual comparison. */
export const PLAYFUL_ROUTE_VARIANT_PAIR_SEEDS = {
	sunny: 58,
	walking: 15,
} as const;
