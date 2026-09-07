import { applyCompatibility } from "./compatibility";
import { defineThemeRecipe } from "./recipeSafety";
import { axisRandom, formatThemeSeed } from "./seed";
import type {
	CompositionId,
	MoodDefinition,
	RequestedBookletTheme,
	ThemeCatalogReferences,
	ThemeContext,
	ThemeRecipeDefinition,
	ThemeSeed,
	TypographySafety,
	UnitFormId,
} from "./types";

function pick<T>(seedToken: string, axis: string, values: readonly T[]): T {
	const selected =
		values[Math.floor(axisRandom(seedToken, axis) * values.length)];
	if (selected === undefined) {
		throw new Error(`テーマ軸「${axis}」を選択できませんでした。`);
	}
	return selected;
}

export function pageMarginMmFor(
	densityId: ThemeRecipeDefinition["densityId"],
): number {
	return densityId === "compact" ? 10 : densityId === "airy" ? 14 : 12;
}

/**
 * Unit forms a mood may use under the given composition: the intersection of
 * the mood's allow-list and the composition's allow-list, in mood order.
 */
export function unitFormsFor(
	mood: Pick<MoodDefinition, "unitForms">,
	compositionId: CompositionId,
	references: ThemeCatalogReferences,
): readonly UnitFormId[] {
	const composition = references.compositions.get(compositionId);
	if (!composition) {
		throw new Error(`ページ構図「${compositionId}」を選択できませんでした。`);
	}
	return mood.unitForms.filter((unitFormId) =>
		composition.unitForms.includes(unitFormId),
	);
}

function typographyFor(
	densityId: ThemeRecipeDefinition["densityId"],
	unitFormId: UnitFormId,
	references: ThemeCatalogReferences,
): TypographySafety {
	const density = references.densities.get(densityId);
	if (!density) {
		throw new Error(`密度「${densityId}」を選択できませんでした。`);
	}
	const unitForm = references.unitForms.get(unitFormId);
	if (!unitForm) {
		throw new Error(`単位形式「${unitFormId}」を選択できませんでした。`);
	}
	return {
		body: { fontSizePt: 10, letterSpacingEm: 0, lineHeight: 1.65 },
		coverTitle: { fontSizePt: 34, letterSpacingEm: 0.02, lineHeight: 1.2 },
		dayTitle: { fontSizePt: 20, letterSpacingEm: 0.02, lineHeight: 1.3 },
		detailWidthMm: unitForm.minDescriptionWidthMm,
		emphasized: { fontSizePt: 11, letterSpacingEm: 0.02, lineHeight: 1.35 },
		pageMarginMm: pageMarginMmFor(densityId),
		spacingMultiplier: density.spacingMultiplier,
		spotTitle: { fontSizePt: 15, letterSpacingEm: 0.02, lineHeight: 1.35 },
		utility: { fontSizePt: 8, letterSpacingEm: 0.06, lineHeight: 1.45 },
		utilityWidthMm: unitForm.minDetailCellWidthMm,
	};
}

export function designKey(
	recipe: Pick<
		ThemeRecipeDefinition,
		| "compositionId"
		| "coverLayoutId"
		| "decorId"
		| "densityId"
		| "displayFontId"
		| "emphasisId"
		| "fontPairId"
		| "inkStyleId"
		| "itineraryTemplateId"
		| "moodId"
		| "paletteId"
		| "unitFormId"
	>,
): string {
	return [
		recipe.moodId,
		recipe.coverLayoutId,
		recipe.paletteId,
		recipe.fontPairId,
		recipe.displayFontId,
		recipe.itineraryTemplateId,
		recipe.decorId,
		recipe.densityId,
		recipe.emphasisId,
		recipe.unitFormId,
		recipe.compositionId,
		recipe.inkStyleId,
	].join(".");
}

export function sameDesign(
	left: ThemeRecipeDefinition,
	right: ThemeRecipeDefinition,
): boolean {
	return designKey(left) === designKey(right);
}

export function resolveTheme(
	seed: ThemeSeed,
	context: ThemeContext,
	moods: ReadonlyMap<MoodDefinition["id"], MoodDefinition>,
	references: ThemeCatalogReferences,
): RequestedBookletTheme {
	const seedToken = formatThemeSeed(seed);
	const mood = pick(seedToken, "mood", Array.from(moods.values()));
	const compatibleMood = applyCompatibility(mood, context);
	const densityId = pick(
		seedToken,
		"density",
		Array.from(references.densities.keys()),
	);
	const emphasisId = pick(
		seedToken,
		"emphasis",
		Array.from(references.emphasis.keys()),
	);
	const compositionId = pick(
		seedToken,
		"composition",
		compatibleMood.compositions,
	);
	const unitFormId = pick(
		seedToken,
		"unitForm",
		unitFormsFor(compatibleMood, compositionId, references),
	);
	const partialRecipe = {
		compositionId,
		coverLayoutId: pick(seedToken, "coverLayout", compatibleMood.coverLayouts),
		decorId: pick(seedToken, "decor", compatibleMood.decors),
		densityId,
		displayFontId: pick(seedToken, "displayFont", compatibleMood.displayFonts),
		emphasisId,
		fontPairId: pick(seedToken, "fontPair", compatibleMood.fontPairs),
		inkStyleId: pick(seedToken, "inkStyle", compatibleMood.inkStyles),
		itineraryTemplateId: pick(
			seedToken,
			"itineraryTemplate",
			compatibleMood.itineraryTemplates,
		),
		moodId: mood.id,
		paletteId: pick(seedToken, "palette", compatibleMood.palettes),
		typography: typographyFor(densityId, unitFormId, references),
		unitFormId,
	};
	const recipe = defineThemeRecipe(
		{ ...partialRecipe, id: designKey(partialRecipe) },
		references,
	);
	return Object.freeze({
		catalogVersion: seed.version,
		recipe,
		seed,
		seedToken,
	});
}

export function createV2BookletTheme(
	seed: ThemeSeed,
	context: ThemeContext,
	moods: ReadonlyMap<MoodDefinition["id"], MoodDefinition>,
	references: ThemeCatalogReferences,
): RequestedBookletTheme {
	return resolveTheme(seed, context, moods, references);
}
