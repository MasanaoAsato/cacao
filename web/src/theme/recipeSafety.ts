import type {
	BookletThemeCandidate,
	DensityId,
	FallbackStep,
	RequestedBookletTheme,
	ThemeCatalogReferences,
	ThemeRecipeDefinition,
	TypographySafety,
} from "./types";

const MINIMUM_CONTRAST_RATIO = 4.5;
const COVER_PANEL_OPACITY_RANGE = [0.52, 0.88] as const;

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

function blendRgb(
	foreground: readonly [number, number, number],
	background: readonly [number, number, number],
	opacity: number,
): readonly [number, number, number] {
	return [
		foreground[0] * opacity + background[0] * (1 - opacity),
		foreground[1] * opacity + background[1] * (1 - opacity),
		foreground[2] * opacity + background[2] * (1 - opacity),
	];
}

function coverContrastRatio(
	foreground: string,
	palette: {
		readonly coverPanel: string;
		readonly coverPanelOpacity: number;
	},
): number | null {
	const foregroundRgb = parseHexColor(foreground);
	const panelRgb = parseHexColor(palette.coverPanel);
	if (!foregroundRgb || !panelRgb) {
		return null;
	}

	const endpointRatios = ([0, 255] as const).map((channel) => {
		const backdrop: readonly [number, number, number] = [
			channel,
			channel,
			channel,
		];
		return contrastRatioRgb(
			foregroundRgb,
			blendRgb(panelRgb, backdrop, palette.coverPanelOpacity),
		);
	});
	return Math.min(...endpointRatios);
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
	requireRange(
		palette.coverPanelOpacity,
		...COVER_PANEL_OPACITY_RANGE,
		"表紙パネル不透明度",
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
		palette.coverPanel,
	];

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

	const coverContrast = coverContrastRatio(palette.text, palette);
	if (coverContrast === null || coverContrast < MINIMUM_CONTRAST_RATIO) {
		throw new ThemeRecipeValidationError(
			`配色「${palette.id}」の表紙文字コントラストは${MINIMUM_CONTRAST_RATIO}:1以上にしてください。`,
		);
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
	if (new Set(font.families).size > 2) {
		throw new ThemeRecipeValidationError(
			"1冊で使用できる書体ファミリーは2種類までです。",
		);
	}
	if (!references.coverLayouts.has(recipe.coverLayoutId)) {
		throw new ThemeRecipeValidationError(
			`未登録の表紙構図「${recipe.coverLayoutId}」です。`,
		);
	}
	if (!references.itineraries.has(recipe.itineraryLayoutId)) {
		throw new ThemeRecipeValidationError(
			`未登録の本文構図「${recipe.itineraryLayoutId}」です。`,
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
	if (!references.signatures.has(recipe.signatureId)) {
		throw new ThemeRecipeValidationError(
			`未登録の旅モチーフ「${recipe.signatureId}」です。`,
		);
	}

	const cover = references.coverLayouts.get(recipe.coverLayoutId);
	if (!cover || cover.textAreaWidthMm < 34 || cover.textAreaHeightMm < 62) {
		throw new ThemeRecipeValidationError(
			"表紙文字領域は幅34mm、高さ62mm以上にしてください。",
		);
	}
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
		56,
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
	if (!/^[a-z0-9-]+$/.test(recipe.id)) {
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
			"coverLayoutId" | "densityId" | "emphasisId" | "itineraryLayoutId"
		>
	>,
	references: ThemeCatalogReferences,
): BookletThemeCandidate {
	const recipe = requested.recipe;
	const densityId = overrides.densityId ?? recipe.densityId;
	return Object.freeze({
		coverLayoutId: overrides.coverLayoutId ?? recipe.coverLayoutId,
		densityId,
		emphasisId: overrides.emphasisId ?? recipe.emphasisId,
		fallbackStep: step,
		fontPairId: recipe.fontPairId,
		itineraryLayoutId: overrides.itineraryLayoutId ?? recipe.itineraryLayoutId,
		paletteId: recipe.paletteId,
		requestedRecipeId: recipe.id,
		resolvedThemeKey: `${requested.seedToken}:${step}`,
		signatureId: recipe.signatureId,
		typography: typographyForDensity(recipe.typography, densityId, references),
	});
}

function hasSameGeometry(
	left: BookletThemeCandidate,
	right: BookletThemeCandidate,
): boolean {
	return (
		left.coverLayoutId === right.coverLayoutId &&
		left.itineraryLayoutId === right.itineraryLayoutId &&
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
				emphasisId: "balanced",
				itineraryLayoutId: "stacked-ledger",
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

export function validateThemeCatalog(
	recipes: readonly ThemeRecipeDefinition[],
	references: ThemeCatalogReferences,
): void {
	const ids = new Set<string>();
	for (const recipe of recipes) {
		if (ids.has(recipe.id)) {
			throw new ThemeRecipeValidationError(
				`テーマレシピID「${recipe.id}」が重複しています。`,
			);
		}
		ids.add(recipe.id);
		defineThemeRecipe(recipe, references);
		const requested: RequestedBookletTheme = {
			catalogVersion: "v1",
			recipe,
			seed: { value: 0, version: "v1" },
			seedToken: "v1-00000000",
		};
		buildThemeCandidates(requested, references);
	}
}
