import type { ResolvedBookletDesign } from "../../booklet/family";
import { getDisplayFontDefinition, getFontPairFamilies } from "../bookletTheme";
import { designKey } from "../resolve";
import { axisRandom } from "../seed";
import type { RequestedBookletTheme } from "../types";
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
	const styleProfile =
		definition.id === "legacy"
			? null
			: pick(
					seedToken,
					`family-style:${definition.id}`,
					definition.styleProfiles,
				);
	const paletteId =
		definition.id === "legacy" ? recipe.paletteId : styleProfile.paletteId;
	const compositionId =
		definition.id === "legacy"
			? recipe.compositionId
			: pick(
					seedToken,
					`family-composition:${styleProfile.id}`,
					styleProfile.compositionIds,
				);
	const decorVariantId =
		definition.id === "legacy" ? null : styleProfile.decorVariantId;
	const comparisonKey =
		definition.id === "legacy"
			? designKey(recipe)
			: [
					definition.id,
					styleProfile.id,
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
			: [
					...new Set([
						styleProfile.fontFamilies.display,
						styleProfile.fontFamilies.body,
						styleProfile.fontFamilies.utility,
					]),
				],
	);

	return Object.freeze({
		comparisonKey,
		compositionId,
		// The selected variant owns the assets this design actually draws; the
		// family's own list is the wider registration set.
		decorAssetIds: Object.freeze(
			definition.id === "legacy" ? [] : [...styleProfile.decorAssetIds],
		),
		decorVariantId,
		familyId: definition.id,
		fontFamilies,
		paletteId,
		policyId,
		renderKey,
		requestedTheme,
		seedToken,
		styleProfile,
		styleProfileId: styleProfile?.id ?? null,
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
