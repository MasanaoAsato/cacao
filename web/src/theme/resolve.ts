import { applyCompatibility } from "./compatibility";
import { defineThemeRecipe } from "./recipeSafety";
import { axisRandom, formatThemeSeed } from "./seed";
import type {
	MoodDefinition,
	RequestedBookletTheme,
	ThemeCatalogReferences,
	ThemeContext,
	ThemeRecipeDefinition,
	ThemeSeed,
	TypographySafety,
} from "./types";

function pick<T>(seedToken: string, axis: string, values: readonly T[]): T {
	const selected =
		values[Math.floor(axisRandom(seedToken, axis) * values.length)];
	if (selected === undefined) {
		throw new Error(`テーマ軸「${axis}」を選択できませんでした。`);
	}
	return selected;
}

function typographyFor(
	densityId: ThemeRecipeDefinition["densityId"],
	references: ThemeCatalogReferences,
): TypographySafety {
	const density = references.densities.get(densityId);
	if (!density) {
		throw new Error(`密度「${densityId}」を選択できませんでした。`);
	}
	const pageMarginMm =
		densityId === "compact" ? 10 : densityId === "airy" ? 14 : 12;
	return {
		body: { fontSizePt: 10, letterSpacingEm: 0, lineHeight: 1.65 },
		coverTitle: { fontSizePt: 34, letterSpacingEm: 0.02, lineHeight: 1.2 },
		dayTitle: { fontSizePt: 20, letterSpacingEm: 0.02, lineHeight: 1.3 },
		detailWidthMm: 76,
		emphasized: { fontSizePt: 11, letterSpacingEm: 0.02, lineHeight: 1.35 },
		pageMarginMm,
		spacingMultiplier: density.spacingMultiplier,
		spotTitle: { fontSizePt: 15, letterSpacingEm: 0.02, lineHeight: 1.35 },
		utility: { fontSizePt: 8, letterSpacingEm: 0.06, lineHeight: 1.45 },
		utilityWidthMm: 22,
	};
}

export function designKey(
	recipe: Pick<
		ThemeRecipeDefinition,
		| "coverLayoutId"
		| "decorId"
		| "densityId"
		| "displayFontId"
		| "emphasisId"
		| "fontPairId"
		| "itineraryTemplateId"
		| "moodId"
		| "paletteId"
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
	const partialRecipe = {
		coverLayoutId: pick(seedToken, "coverLayout", compatibleMood.coverLayouts),
		decorId: pick(seedToken, "decor", compatibleMood.decors),
		densityId,
		displayFontId: pick(seedToken, "displayFont", compatibleMood.displayFonts),
		emphasisId,
		fontPairId: pick(seedToken, "fontPair", compatibleMood.fontPairs),
		itineraryTemplateId: pick(
			seedToken,
			"itineraryTemplate",
			compatibleMood.itineraryTemplates,
		),
		moodId: mood.id,
		paletteId: pick(seedToken, "palette", compatibleMood.palettes),
		typography: typographyFor(densityId, references),
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
