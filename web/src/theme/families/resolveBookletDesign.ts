import type { ResolvedBookletDesign } from "../../booklet/family";
import { getDisplayFontDefinition, getFontPairFamilies } from "../bookletTheme";
import { designKey } from "../resolve";
import { axisRandom } from "../seed";
import type { RequestedBookletTheme } from "../types";
import {
	PLAYFUL_ROUTE_DECOR_VARIANT_IDS,
	playfulRouteDecorVariantFor,
} from "./playfulRoute";
import { type BookletFamilyDefinition, familyDefinitionFor } from "./registry";

function pick<T>(seedToken: string, axis: string, values: readonly T[]): T {
	const selected =
		values[Math.floor(axisRandom(seedToken, axis) * values.length)];
	if (selected === undefined) {
		throw new Error(`系統軸「${axis}」を選択できませんでした。`);
	}
	return selected;
}

export function resolveBookletDesignForFamily(
	requestedTheme: RequestedBookletTheme,
	definition: BookletFamilyDefinition,
): ResolvedBookletDesign {
	const { recipe, seedToken } = requestedTheme;
	const paletteId =
		definition.id === "legacy"
			? recipe.paletteId
			: pick(
					seedToken,
					`family:${definition.id}:palette`,
					definition.paletteIds,
				);
	const compositionId =
		definition.id === "legacy"
			? recipe.compositionId
			: pick(
					seedToken,
					`family:${definition.id}:composition`,
					definition.compositionIds,
				);
	// Only playful-route publishes decor variants, so only its comparison key
	// gains a segment; every other family's key text stays as it was (20.11).
	const decorVariantId =
		definition.id === "playful-route"
			? pick(
					seedToken,
					`family:${definition.id}:decor-variant`,
					PLAYFUL_ROUTE_DECOR_VARIANT_IDS,
				)
			: null;
	const comparisonKey =
		definition.id === "legacy"
			? designKey(recipe)
			: [
					definition.id,
					paletteId,
					compositionId,
					...(decorVariantId === null ? [] : [decorVariantId]),
				].join(".");
	const policyId = definition.policyId;
	const renderKey = [definition.id, seedToken, policyId, comparisonKey].join(
		":",
	);
	const displayFont = getDisplayFontDefinition(recipe.displayFontId);
	const fontFamilies = Object.freeze(
		definition.id === "legacy"
			? [...getFontPairFamilies(recipe.fontPairId), displayFont.family].filter(
					(family): family is string => family !== null,
				)
			: [...definition.fontFamilies],
	);

	return Object.freeze({
		comparisonKey,
		compositionId,
		// The selected variant owns the assets this design actually draws; the
		// family's own list is the wider registration set.
		decorAssetIds: Object.freeze(
			definition.id === "legacy"
				? []
				: decorVariantId === null
					? [...definition.decorAssetIds]
					: [...playfulRouteDecorVariantFor(decorVariantId).decorAssetIds],
		),
		decorVariantId,
		familyId: definition.id,
		fontFamilies,
		paletteId,
		policyId,
		renderKey,
		requestedTheme,
		seedToken,
	});
}

export function resolveBookletDesign(
	requestedTheme: RequestedBookletTheme,
): ResolvedBookletDesign {
	return resolveBookletDesignForFamily(
		requestedTheme,
		familyDefinitionFor(requestedTheme.recipe.moodId),
	);
}
