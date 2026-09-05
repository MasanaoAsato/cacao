import type {
	BookletThemeCandidate,
	CoverLayoutDefinition,
	DensityId,
	DisplayFontDefinition,
	FallbackStep,
	FontPairDefinition,
	PaletteDefinition,
	RequestedBookletTheme,
	ThemeCatalogReferences,
	ThemeRecipeDefinition,
	TypographySafety,
} from "./types";

const MINIMUM_CONTRAST_RATIO = 4.5;
const MINIMUM_ITINERARY_TEXT_CONTRAST_RATIO = 7;
const COVER_VEIL_OPACITY_RANGE = [0.36, 0.42] as const;

export class ThemeRecipeValidationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "ThemeRecipeValidationError";
	}
}

function requireRange(
	value: number,
	minimum: number,
	maximum: number,
	name: string,
): void {
	if (!Number.isFinite(value) || value < minimum || value > maximum) {
		throw new ThemeRecipeValidationError(
			`${name}は${minimum}から${maximum}の範囲で指定してください。`,
		);
	}
}

function validateTextStyle(
	style: TypographySafety[keyof Pick<
		TypographySafety,
		"body" | "coverTitle" | "dayTitle" | "emphasized" | "spotTitle" | "utility"
	>],
	name: string,
	fontSizeRange: readonly [number, number],
	lineHeightRange: readonly [number, number],
	letterSpacingRange: readonly [number, number],
): void {
	requireRange(style.fontSizePt, ...fontSizeRange, `${name}の文字サイズ`);
	requireRange(style.lineHeight, ...lineHeightRange, `${name}の行高`);
	requireRange(style.letterSpacingEm, ...letterSpacingRange, `${name}の字間`);
}

function parseHexColor(
	color: string,
): readonly [number, number, number] | null {
	const match = /^#([0-9a-f]{6})$/i.exec(color.trim());
	if (!match) {
		return null;
	}

	const hex = match[1];
	return [
		Number.parseInt(hex.slice(0, 2), 16),
		Number.parseInt(hex.slice(2, 4), 16),
		Number.parseInt(hex.slice(4, 6), 16),
	];
}

function linearize(value: number): number {
	const normalized = value / 255;
	return normalized <= 0.03928
		? normalized / 12.92
		: ((normalized + 0.055) / 1.055) ** 2.4;
}

function luminance(color: readonly [number, number, number]): number {
	return (
		0.2126 * linearize(color[0]) +
		0.7152 * linearize(color[1]) +
		0.0722 * linearize(color[2])
	);
}

function contrastRatio(foreground: string, background: string): number | null {
	const foregroundRgb = parseHexColor(foreground);
	const backgroundRgb = parseHexColor(background);
	if (!foregroundRgb || !backgroundRgb) {
		return null;
	}

	return contrastRatioRgb(foregroundRgb, backgroundRgb);
}

function contrastRatioRgb(
	foreground: readonly [number, number, number],
	background: readonly [number, number, number],
): number {
	const foregroundLuminance = luminance(foreground);
	const backgroundLuminance = luminance(background);
	return (
		(Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
		(Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
	);
}

function backgroundEndpoints(background: string): readonly string[] {
	const colors = background.match(/#[0-9a-f]{6}/gi);
	return colors ?? [];
}

function validatePaletteContrast(
	recipe: ThemeRecipeDefinition,
	references: ThemeCatalogReferences,
): void {
	const palette = references.palettes.get(recipe.paletteId);
	if (!palette) {
		throw new ThemeRecipeValidationError(
			`未登録の配色「${recipe.paletteId}」です。`,
		);
	}
	validatePaletteDefinition(palette);
}

function validatePaletteDefinition(palette: PaletteDefinition): void {
	requireRange(
		palette.coverVeilOpacity,
		...COVER_VEIL_OPACITY_RANGE,
		"表紙ベール不透明度",
	);

	const pageBackgrounds = backgroundEndpoints(palette.background);
	if (pageBackgrounds.length === 0) {
		throw new ThemeRecipeValidationError(
			`配色「${palette.id}」の背景色が不正です。`,
		);
	}
	const backgrounds = [
		...pageBackgrounds,
		...palette.surfaceStops,
		palette.coverVeil,
	];
	const itinerary = palette.itinerary ?? palette;
	for (const background of itinerary.surfaceStops) {
		const textContrast = contrastRatio(itinerary.text, background);
		if (
			textContrast === null ||
			textContrast < MINIMUM_ITINERARY_TEXT_CONTRAST_RATIO
		) {
			throw new ThemeRecipeValidationError(
				`配色「${palette.id}」の本文文字コントラストは${MINIMUM_ITINERARY_TEXT_CONTRAST_RATIO}:1以上にしてください。`,
			);
		}
		for (const foreground of [itinerary.muted, itinerary.accent]) {
			const contrast = contrastRatio(foreground, background);
			if (contrast === null || contrast < MINIMUM_CONTRAST_RATIO) {
				throw new ThemeRecipeValidationError(
					`配色「${palette.id}」の補助文字コントラストは${MINIMUM_CONTRAST_RATIO}:1以上にしてください。`,
				);
			}
		}
	}

	for (const foreground of [palette.text, palette.muted, palette.accent]) {
		for (const background of backgrounds) {
			const contrast = contrastRatio(foreground, background);
			if (contrast === null || contrast < MINIMUM_CONTRAST_RATIO) {
				throw new ThemeRecipeValidationError(
					`配色「${palette.id}」の文字コントラストは${MINIMUM_CONTRAST_RATIO}:1以上にしてください。`,
				);
			}
		}
	}

	const coverContrast = contrastRatio(palette.coverInk, palette.coverVeil);
	if (coverContrast === null || coverContrast < MINIMUM_CONTRAST_RATIO) {
		throw new ThemeRecipeValidationError(
			`配色「${palette.id}」の表紙文字コントラストは${MINIMUM_CONTRAST_RATIO}:1以上にしてください。`,
		);
	}
	for (const background of palette.surfaceStops) {
		const contrast = contrastRatio(palette.coverInk, background);
		if (contrast === null || contrast < MINIMUM_CONTRAST_RATIO) {
			throw new ThemeRecipeValidationError(
				`配色「${palette.id}」の表紙紙面文字コントラストは${MINIMUM_CONTRAST_RATIO}:1以上にしてください。`,
			);
		}
	}
}

export function validatePaletteDefinitions(
	references: ThemeCatalogReferences,
): void {
	for (const palette of references.palettes.values()) {
		validatePaletteDefinition(palette);
	}
}

function validateCoverLayoutDefinition(cover: CoverLayoutDefinition): void {
	if (
		cover.selectable &&
		(cover.safeArea.widthMm < 34 || cover.safeArea.heightMm < 62)
	) {
		throw new ThemeRecipeValidationError(
			"表紙文字領域は幅34mm、高さ62mm以上にしてください。",
		);
	}
	if (cover.titleSizePt !== null) {
		requireRange(cover.titleSizePt, 22, 56, "表紙見出し文字サイズ");
	}
}

const GENERIC_FONT_FAMILIES = new Set([
	"cursive",
	"fantasy",
	"monospace",
	"sans-serif",
	"serif",
	"system-ui",
	"ui-monospace",
	"ui-rounded",
	"ui-sans-serif",
	"ui-serif",
]);

function normalizeFontFamily(family: string): string {
	return family.trim().replace(/^(?:"([^"]*)"|'([^']*)')$/, "$1$2");
}

function namedFontFamilies(family: string | null): readonly string[] {
	if (family === null) {
		return [];
	}
	return family
		.split(",")
		.map(normalizeFontFamily)
		.filter(
			(value) =>
				value.length > 0 && !GENERIC_FONT_FAMILIES.has(value.toLowerCase()),
		);
}

function validateFontFamilyCombination(
	font: FontPairDefinition,
	displayFont: DisplayFontDefinition,
): void {
	const fontFamilies = font.families.flatMap(namedFontFamilies);
	if (new Set(fontFamilies).size > 2) {
		throw new ThemeRecipeValidationError(
			"1冊で使用できる書体ファミリーは2種類までです。",
		);
	}
	const familyCount = new Set([
		...fontFamilies,
		...namedFontFamilies(displayFont.family),
	]).size;
	if (familyCount > 3) {
		throw new ThemeRecipeValidationError(
			"1冊で使用できる書体ファミリーは3種類までです。",
		);
	}
}

export function validateFontFamilyCombinations(
	references: ThemeCatalogReferences,
): void {
	for (const font of references.fonts.values()) {
		for (const displayFont of references.displayFonts.values()) {
			validateFontFamilyCombination(font, displayFont);
		}
	}
}

export function validateCoverLayoutDefinitions(
	references: ThemeCatalogReferences,
): void {
	for (const [id, cover] of references.coverLayouts) {
		if (id !== cover.id) {
			throw new ThemeRecipeValidationError(
				`表紙構図のキー「${id}」と定義ID「${cover.id}」が一致しません。`,
			);
		}
		validateCoverLayoutDefinition(cover);
	}
}

function validateReferences(
	recipe: ThemeRecipeDefinition,
	references: ThemeCatalogReferences,
): void {
	const font = references.fonts.get(recipe.fontPairId);
	if (!font) {
		throw new ThemeRecipeValidationError(
			`未登録の書体「${recipe.fontPairId}」です。`,
		);
	}
	const cover = references.coverLayouts.get(recipe.coverLayoutId);
	if (!cover) {
		throw new ThemeRecipeValidationError(
			`未登録の表紙構図「${recipe.coverLayoutId}」です。`,
		);
	}
	if (!cover.selectable) {
		throw new ThemeRecipeValidationError(
			`表紙構図「${recipe.coverLayoutId}」はテーマレシピで選択できません。`,
		);
	}
	validateCoverLayoutDefinition(cover);
	if (!references.itineraries.has(recipe.itineraryTemplateId)) {
		throw new ThemeRecipeValidationError(
			`未登録の本文テンプレート「${recipe.itineraryTemplateId}」です。`,
		);
	}
	if (!references.emphasis.has(recipe.emphasisId)) {
		throw new ThemeRecipeValidationError(
			`未登録の強弱「${recipe.emphasisId}」です。`,
		);
	}
	if (!references.densities.has(recipe.densityId)) {
		throw new ThemeRecipeValidationError(
			`未登録の密度「${recipe.densityId}」です。`,
		);
	}
	if (!references.decors.has(recipe.decorId)) {
		throw new ThemeRecipeValidationError(
			`未登録の装飾語彙「${recipe.decorId}」です。`,
		);
	}
	if (!references.displayFonts.has(recipe.displayFontId)) {
		throw new ThemeRecipeValidationError(
			`未登録の表示書体「${recipe.displayFontId}」です。`,
		);
	}
	const displayFont = references.displayFonts.get(recipe.displayFontId);
	if (!displayFont) {
		throw new ThemeRecipeValidationError(
			`未登録の表示書体「${recipe.displayFontId}」です。`,
		);
	}
	validateFontFamilyCombination(font, displayFont);
}

function validateTypography(recipe: ThemeRecipeDefinition): void {
	const { typography } = recipe;
	validateTextStyle(
		typography.body,
		"本文",
		[9, 11],
		[1.5, 1.9],
		[-0.02, 0.06],
	);
	validateTextStyle(
		typography.utility,
		"補助情報",
		[7.5, 9],
		[1.35, 1.7],
		[-0.02, 0.16],
	);
	validateTextStyle(
		typography.emphasized,
		"時刻・経路",
		[9, 18],
		[1.2, 1.5],
		[-0.02, 0.16],
	);
	validateTextStyle(
		typography.spotTitle,
		"Spot見出し",
		[13, 20],
		[1.25, 1.6],
		[-0.02, 0.16],
	);
	validateTextStyle(
		typography.dayTitle,
		"日見出し",
		[16, 26],
		[1.2, 1.5],
		[-0.02, 0.16],
	);
	validateTextStyle(
		typography.coverTitle,
		"表紙見出し",
		[22, 56],
		[1.1, 1.35],
		[-0.02, 0.16],
	);
	requireRange(
		typography.detailWidthMm,
		76,
		Number.POSITIVE_INFINITY,
		"Spot説明領域の幅",
	);
	requireRange(
		typography.utilityWidthMm,
		22,
		Number.POSITIVE_INFINITY,
		"補助情報領域の幅",
	);
	requireRange(typography.pageMarginMm, 10, 14, "本文ページ余白");
	requireRange(typography.spacingMultiplier, 0.86, 1.14, "間隔倍率");
}

export function defineThemeRecipe(
	recipe: ThemeRecipeDefinition,
	references: ThemeCatalogReferences,
): ThemeRecipeDefinition {
	if (!/^[a-z0-9.-]+$/.test(recipe.id)) {
		throw new ThemeRecipeValidationError("テーマレシピIDが不正です。");
	}
	validateReferences(recipe, references);
	validateTypography(recipe);
	validatePaletteContrast(recipe, references);
	return Object.freeze({
		...recipe,
		typography: Object.freeze({ ...recipe.typography }),
	});
}

function typographyForDensity(
	typography: TypographySafety,
	densityId: DensityId,
	references: ThemeCatalogReferences,
): TypographySafety {
	const density = references.densities.get(densityId);
	if (!density) {
		throw new ThemeRecipeValidationError(`未登録の密度「${densityId}」です。`);
	}
	return Object.freeze({
		...typography,
		spacingMultiplier: density.spacingMultiplier,
	});
}

function candidate(
	requested: RequestedBookletTheme,
	step: FallbackStep,
	overrides: Partial<
		Pick<
			BookletThemeCandidate,
			| "coverLayoutId"
			| "densityId"
			| "displayFontId"
			| "emphasisId"
			| "itineraryTemplateId"
		>
	>,
	references: ThemeCatalogReferences,
): BookletThemeCandidate {
	const recipe = requested.recipe;
	const densityId = overrides.densityId ?? recipe.densityId;
	return Object.freeze({
		coverLayoutId: overrides.coverLayoutId ?? recipe.coverLayoutId,
		decorId: recipe.decorId,
		densityId,
		displayFontId: overrides.displayFontId ?? recipe.displayFontId,
		emphasisId: overrides.emphasisId ?? recipe.emphasisId,
		fallbackStep: step,
		fontPairId: recipe.fontPairId,
		itineraryTemplateId:
			overrides.itineraryTemplateId ?? recipe.itineraryTemplateId,
		moodId: recipe.moodId,
		paletteId: recipe.paletteId,
		requestedRecipeId: recipe.id,
		resolvedThemeKey: `${requested.seedToken}:${step}`,
		typography: typographyForDensity(recipe.typography, densityId, references),
	});
}

function hasSameGeometry(
	left: BookletThemeCandidate,
	right: BookletThemeCandidate,
): boolean {
	return (
		left.coverLayoutId === right.coverLayoutId &&
		left.itineraryTemplateId === right.itineraryTemplateId &&
		left.emphasisId === right.emphasisId &&
		left.densityId === right.densityId
	);
}

export function buildThemeCandidates(
	requested: RequestedBookletTheme,
	references: ThemeCatalogReferences,
): readonly BookletThemeCandidate[] {
	const candidates = [candidate(requested, "selected", {}, references)];
	if (requested.recipe.densityId === "airy") {
		candidates.push(
			candidate(
				requested,
				"balanced-density",
				{ densityId: "balanced" },
				references,
			),
		);
	}
	if (requested.recipe.densityId !== "compact") {
		candidates.push(
			candidate(
				requested,
				"compact-density",
				{ densityId: "compact" },
				references,
			),
		);
	}
	candidates.push(
		candidate(
			requested,
			"safe-geometry",
			{
				coverLayoutId: "safe-cover",
				densityId: "compact",
				displayFontId: "inherit",
				emphasisId: "balanced",
				itineraryTemplateId: "field-journal",
			},
			references,
		),
	);

	const unique = candidates.filter((candidateItem, index) =>
		candidates
			.slice(0, index)
			.every((item) => !hasSameGeometry(item, candidateItem)),
	);
	if (unique.length === 0 || unique.length > 4) {
		throw new ThemeRecipeValidationError(
			"テーマ候補列は1件以上4件以下にしてください。",
		);
	}
	return Object.freeze(unique);
}
