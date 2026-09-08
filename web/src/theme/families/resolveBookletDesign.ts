import type { ResolvedBookletDesign } from "../../booklet/family";
import { getDisplayFontDefinition, getFontPairFamilies } from "../bookletTheme";
import { designKey } from "../resolve";
import { axisRandom } from "../seed";
import type { RequestedBookletTheme } from "../types";
import { familyDefinitionFor } from "./registry";

function pick<T>(seedToken: string, axis: string, values: readonly T[]): T {
	const selected =
		values[Math.floor(axisRandom(seedToken, axis) * values.length)];
	if (selected === undefined) {
		throw new Error(`系統軸「${axis}」を選択できませんでした。`);
	}
	return selected;
}

export function resolveBookletDesign(
	requestedTheme: RequestedBookletTheme,
): ResolvedBookletDesign {
	const definition = familyDefinitionFor(requestedTheme.recipe.moodId);
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
	const comparisonKey =
		definition.id === "legacy"
			? designKey(recipe)
			: [definition.id, paletteId, compositionId].join(".");
	const policyId = definition.policyId;
	const renderKey = [definition.id, seedToken, policyId, comparisonKey].join(
		":",
	);
	const displayFont = getDisplayFontDefinition(recipe.displayFontId);
	const fontFamilies = Object.freeze(
		[...getFontPairFamilies(recipe.fontPairId), displayFont.family].filter(
			(family): family is string => family !== null,
		),
	);

	return Object.freeze({
		comparisonKey,
		compositionId,
		decorAssetIds: Object.freeze([]),
		familyId: definition.id,
		fontFamilies,
		paletteId,
		policyId,
		renderKey,
		requestedTheme,
		seedToken,
	});
}
