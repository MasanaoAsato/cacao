import { decorContentInset, patternCoverage } from "./decorGeometry";
import type {
	BookletThemeCandidate,
	CompositionDefinition,
	CoverLayoutDefinition,
	DecorDefinition,
	DensityId,
	DisplayFontDefinition,
	FallbackStep,
	FontPairDefinition,
	ItineraryPaletteDefinition,
	MoodDefinition,
	MotifColor,
	PaletteDefinition,
	RequestedBookletTheme,
	ThemeCatalogReferences,
	ThemeRecipeDefinition,
	TypographySafety,
	UnitFormDefinition,
	UnitFormId,
} from "./types";

const MINIMUM_CONTRAST_RATIO = 4.5;
const MINIMUM_ITINERARY_TEXT_CONTRAST_RATIO = 7;
/** The inverted day header is 20pt text, so WCAG large-text contrast applies. */
const MINIMUM_INK_BAND_CONTRAST_RATIO = 4.5;
const ZEBRA_TINT_WEIGHT = 0.08;
const COVER_VEIL_OPACITY_RANGE = [0.36, 0.42] as const;
const PAGE_WIDTH_MM = 148;
const DETAIL_COLUMN_GAP_MM = 3;
const MAXIMUM_CANDIDATE_COUNT = 5;

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

function mixRgb(
	foreground: readonly [number, number, number],
	background: readonly [number, number, number],
	foregroundWeight: number,
): readonly [number, number, number] {
	const mixed = foreground.map(
		(component, index) =>
			component * foregroundWeight +
			(background[index] ?? 0) * (1 - foregroundWeight),
	) as [number, number, number];
	return [mixed[0], mixed[1], mixed[2]];
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

		const accent = parseHexColor(itinerary.accent);
		const surface = parseHexColor(background);
		const text = parseHexColor(itinerary.text);
		const bannerSurface =
			accent && surface ? mixRgb(accent, surface, 0.12) : null;
		const bannerContrast =
			text && bannerSurface ? contrastRatioRgb(text, bannerSurface) : null;
		if (
			bannerContrast === null ||
			bannerContrast < MINIMUM_ITINERARY_TEXT_CONTRAST_RATIO
		) {
			throw new ThemeRecipeValidationError(
				`配色「${palette.id}」の本文帯文字コントラストは${MINIMUM_ITINERARY_TEXT_CONTRAST_RATIO}:1以上にしてください。`,
			);
		}
		const zebraSurface =
			accent && surface ? mixRgb(accent, surface, ZEBRA_TINT_WEIGHT) : null;
		const zebraContrast =
			text && zebraSurface ? contrastRatioRgb(text, zebraSurface) : null;
		if (
			zebraContrast === null ||
			zebraContrast < MINIMUM_ITINERARY_TEXT_CONTRAST_RATIO
		) {
			throw new ThemeRecipeValidationError(
				`配色「${palette.id}」の縞地文字コントラストは${MINIMUM_ITINERARY_TEXT_CONTRAST_RATIO}:1以上にしてください。`,
			);
		}
		const inkBandContrast = contrastRatio(itinerary.accent, background);
		if (
			inkBandContrast === null ||
			inkBandContrast < MINIMUM_INK_BAND_CONTRAST_RATIO
		) {
			throw new ThemeRecipeValidationError(
				`配色「${palette.id}」の反転帯コントラストは${MINIMUM_INK_BAND_CONTRAST_RATIO}:1以上にしてください。`,
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

const MAXIMUM_DECOR_INSET_MM = 18;
const MAXIMUM_PATTERN_OPACITY_WITHOUT_PANEL = 0.35;
const MAXIMUM_PATTERN_COVERAGE_WITHOUT_PANEL = 0.05;
const MINIMUM_PANEL_OPACITY_OVER_IMAGE = 0.92;

function validateDecorDefinition(
	decor: DecorDefinition,
	references: ThemeCatalogReferences,
): void {
	const label = `装飾「${decor.id}」`;
	requireRange(decor.coverPaddingMm, 0, 4, `${label}の表紙装飾余白`);
	const ground = decor.ground;
	if (ground.kind === "pattern") {
		if (!references.motifs.has(ground.motif)) {
			throw new ThemeRecipeValidationError(
				`${label}の柄に未登録の図形「${ground.motif}」があります。`,
			);
		}
		requireRange(ground.tileMm, 1, 10, `${label}の柄の間隔`);
		requireRange(ground.sizeMm, 0.2, ground.tileMm, `${label}の柄の図形サイズ`);
		requireRange(ground.opacity, 0.05, 1, `${label}の柄の不透明度`);
		if (decor.panel.kind === "none") {
			requireRange(
				ground.opacity,
				0.05,
				MAXIMUM_PATTERN_OPACITY_WITHOUT_PANEL,
				`${label}のパネルなしの柄の不透明度`,
			);
			requireRange(
				patternCoverage(decor, references.motifs),
				0,
				MAXIMUM_PATTERN_COVERAGE_WITHOUT_PANEL,
				`${label}のパネルなしの柄の被覆率`,
			);
		}
	} else if (ground.kind === "frame") {
		requireRange(ground.edgeMm, 0, 8, `${label}の額縁の位置`);
		requireRange(ground.widthMm, 0.2, 6, `${label}の額縁の太さ`);
		requireRange(ground.opacity, 0.2, 1, `${label}の額縁の不透明度`);
	} else if (ground.kind === "image") {
		requireRange(ground.opacity, 0.1, 0.6, `${label}の画像地の不透明度`);
		if (decor.panel.kind !== "sheet") {
			throw new ThemeRecipeValidationError(
				`${label}の画像地にはパネルが必要です。`,
			);
		}
		requireRange(
			decor.panel.opacity,
			MINIMUM_PANEL_OPACITY_OVER_IMAGE,
			1,
			`${label}の画像地の上のパネル不透明度`,
		);
	}
	if (decor.panel.kind === "sheet") {
		requireRange(decor.panel.insetMm, 3, 10, `${label}のパネルの位置`);
		requireRange(decor.panel.opacity, 0.85, 1, `${label}のパネルの不透明度`);
		requireRange(decor.panel.radiusMm, 0, 4, `${label}のパネルの角丸`);
	}
	if (decor.motifs.length > 6) {
		throw new ThemeRecipeValidationError(
			`${label}の図形の置き場は6件以下です。`,
		);
	}
	for (const placement of decor.motifs) {
		const motif = references.motifs.get(placement.motif);
		if (!motif) {
			throw new ThemeRecipeValidationError(
				`${label}に未登録の図形「${placement.motif}」があります。`,
			);
		}
		if (motif.kind === "asset" && motif.recolor === "none") {
			if (placement.color !== "own") {
				throw new ThemeRecipeValidationError(
					`${label}の多色素材「${placement.motif}」の色はownにしてください。`,
				);
			}
		} else if (placement.color === "own") {
			throw new ThemeRecipeValidationError(
				`${label}の図形「${placement.motif}」にownは指定できません。`,
			);
		}
		requireRange(placement.count, 1, 30, `${label}の図形の個数`);
		if (
			(placement.slot === "corner-nw" ||
				placement.slot === "corner-ne" ||
				placement.slot === "corner-sw" ||
				placement.slot === "corner-se") &&
			placement.count !== 1
		) {
			throw new ThemeRecipeValidationError(
				`${label}の四隅の図形は1個にしてください。`,
			);
		}
		requireRange(placement.sizeMm[0], 0.5, 210, `${label}の図形の最小サイズ`);
		requireRange(
			placement.sizeMm[1],
			placement.sizeMm[0],
			210,
			`${label}の図形の最大サイズ`,
		);
		requireRange(placement.rotateDeg[0], -180, 180, `${label}の図形の最小回転`);
		requireRange(
			placement.rotateDeg[1],
			placement.rotateDeg[0],
			180,
			`${label}の図形の最大回転`,
		);
		requireRange(placement.opacity, 0.1, 1, `${label}の図形の不透明度`);
	}
	const inset = decorContentInset(decor, references.motifs);
	for (const side of ["top", "right", "bottom", "left"] as const) {
		requireRange(inset[side], 0, MAXIMUM_DECOR_INSET_MM, `${label}の内側余白`);
	}
}

function resolveMotifHex(
	color: MotifColor,
	itinerary: ItineraryPaletteDefinition,
): string {
	switch (color) {
		case "accent":
			return itinerary.accent;
		case "border":
			return itinerary.border;
		case "muted":
			return itinerary.muted;
		case "own":
			return "#000000";
	}
}

/**
 * Text contrast on a sheet panel. The panel's effective colour is the surface
 * mixed with the worst colour that can show through: the pattern's ink, or
 * black for an image ground.
 */
export function validateDecorContrast(
	references: ThemeCatalogReferences,
): void {
	for (const decor of references.decors.values()) {
		if (decor.panel.kind !== "sheet") {
			continue;
		}
		for (const palette of references.palettes.values()) {
			const itinerary = palette.itinerary ?? palette;
			const text = parseHexColor(itinerary.text);
			for (const stop of itinerary.surfaceStops) {
				const surface = parseHexColor(stop);
				const under =
					decor.ground.kind === "pattern"
						? parseHexColor(resolveMotifHex(decor.ground.color, itinerary))
						: decor.ground.kind === "image"
							? parseHexColor("#000000")
							: surface;
				if (!text || !surface || !under) {
					throw new ThemeRecipeValidationError(
						`配色「${palette.id}」の色を解釈できません。`,
					);
				}
				const effective = mixRgb(surface, under, decor.panel.opacity);
				if (
					contrastRatioRgb(text, effective) <
					MINIMUM_ITINERARY_TEXT_CONTRAST_RATIO
				) {
					throw new ThemeRecipeValidationError(
						`装飾「${decor.id}」のパネル上で配色「${palette.id}」の本文文字コントラストが${MINIMUM_ITINERARY_TEXT_CONTRAST_RATIO}:1を下回ります。`,
					);
				}
			}
		}
	}
}

function validateUnitFormDefinition(unitForm: UnitFormDefinition): void {
	requireRange(unitForm.minDescriptionWidthMm, 40, 80, "Spot説明の最小幅");
	if (unitForm.detailColumns === 3) {
		requireRange(unitForm.minDetailCellWidthMm, 22, 30, "補助情報の最小幅");
	} else {
		requireRange(unitForm.minDetailCellWidthMm, 0, 0, "補助情報の最小幅");
	}
}

export function validateUnitFormDefinitions(
	references: ThemeCatalogReferences,
): void {
	if (!references.unitForms.has("full")) {
		throw new ThemeRecipeValidationError("単位形式fullは必須です。");
	}
	for (const [id, unitForm] of references.unitForms) {
		if (id !== unitForm.id) {
			throw new ThemeRecipeValidationError(
				`単位形式のキー「${id}」と定義ID「${unitForm.id}」が一致しません。`,
			);
		}
		validateUnitFormDefinition(unitForm);
	}
}

function validateCompositionDefinition(
	composition: CompositionDefinition,
	references: ThemeCatalogReferences,
): void {
	for (const side of ["top", "right", "bottom", "left"] as const) {
		requireRange(
			composition.contentInsetMm[side],
			0,
			30,
			`ページ構図「${composition.id}」の内側余白`,
		);
	}
	const sideHeader = composition.header.placement !== "top";
	if (sideHeader) {
		if (composition.header.bandWidthMm === null) {
			throw new ThemeRecipeValidationError(
				`ページ構図「${composition.id}」の帯幅を指定してください。`,
			);
		}
		requireRange(
			composition.header.bandWidthMm,
			16,
			28,
			`ページ構図「${composition.id}」の帯幅`,
		);
		const insetSide =
			composition.header.placement === "side-left" ? "left" : "right";
		if (
			composition.contentInsetMm[insetSide] <
			composition.header.bandWidthMm + 4
		) {
			throw new ThemeRecipeValidationError(
				`ページ構図「${composition.id}」の内側余白は帯幅+4mm以上にしてください。`,
			);
		}
	} else if (composition.header.bandWidthMm !== null) {
		throw new ThemeRecipeValidationError(
			`ページ構図「${composition.id}」は帯幅を持てません。`,
		);
	}
	if (composition.columns === 2) {
		requireRange(
			composition.columnGapMm,
			4,
			10,
			`ページ構図「${composition.id}」の列間`,
		);
	} else {
		requireRange(
			composition.columnGapMm,
			0,
			0,
			`ページ構図「${composition.id}」の列間`,
		);
	}
	if (composition.unitForms.length === 0) {
		throw new ThemeRecipeValidationError(
			`ページ構図「${composition.id}」の単位形式は1件以上必要です。`,
		);
	}
	if (new Set(composition.unitForms).size !== composition.unitForms.length) {
		throw new ThemeRecipeValidationError(
			`ページ構図「${composition.id}」の単位形式に重複があります。`,
		);
	}
	for (const unitFormId of composition.unitForms) {
		if (!references.unitForms.has(unitFormId)) {
			throw new ThemeRecipeValidationError(
				`ページ構図「${composition.id}」に未登録の単位形式「${unitFormId}」があります。`,
			);
		}
	}
}

export function validateCompositionDefinitions(
	references: ThemeCatalogReferences,
): void {
	const topStack = references.compositions.get("top-stack");
	if (!topStack?.unitForms.includes("full")) {
		throw new ThemeRecipeValidationError(
			"ページ構図top-stackはfullを許可する必須の構図です。",
		);
	}
	for (const [id, composition] of references.compositions) {
		if (id !== composition.id) {
			throw new ThemeRecipeValidationError(
				`ページ構図のキー「${id}」と定義ID「${composition.id}」が一致しません。`,
			);
		}
		validateCompositionDefinition(composition, references);
	}
}

export function validateInkStyleDefinitions(
	references: ThemeCatalogReferences,
): void {
	if (!references.inkStyles.has("text")) {
		throw new ThemeRecipeValidationError("色の載せ方textは必須です。");
	}
	for (const [id, inkStyle] of references.inkStyles) {
		if (id !== inkStyle.id) {
			throw new ThemeRecipeValidationError(
				`色の載せ方のキー「${id}」と定義ID「${inkStyle.id}」が一致しません。`,
			);
		}
	}
}

export type BodyWidthInput = {
	readonly compositionId: ThemeRecipeDefinition["compositionId"];
	readonly decorId: ThemeRecipeDefinition["decorId"];
	readonly densityId: DensityId;
	readonly itineraryTemplateId: ThemeRecipeDefinition["itineraryTemplateId"];
	readonly unitFormId: UnitFormId;
};

export type BodyWidth = {
	readonly columnWidthMm: number;
	readonly contentWidthMm: number;
	readonly descriptionWidthMm: number;
};

function pageMarginMmForDensity(densityId: DensityId): number {
	return densityId === "compact" ? 10 : densityId === "airy" ? 14 : 12;
}

/**
 * Body widths derived purely from the definitions (never from journey data):
 * the content width after page margin and insets, the width of one unit
 * column, and the description width after the template's reserved column.
 */
export function bodyWidth(
	input: BodyWidthInput,
	references: ThemeCatalogReferences,
): BodyWidth {
	const composition = references.compositions.get(input.compositionId);
	const decor = references.decors.get(input.decorId);
	const template = references.itineraries.get(input.itineraryTemplateId);
	if (!composition || !decor || !template) {
		throw new ThemeRecipeValidationError(
			"本文幅の計算に必要な定義が未登録です。",
		);
	}
	const decorInset = decorContentInset(decor, references.motifs);
	const contentWidthMm =
		PAGE_WIDTH_MM -
		2 * pageMarginMmForDensity(input.densityId) -
		decorInset.left -
		decorInset.right -
		composition.contentInsetMm.left -
		composition.contentInsetMm.right;
	const columnWidthMm =
		(contentWidthMm - composition.columnGapMm * (composition.columns - 1)) /
		composition.columns;
	return {
		columnWidthMm,
		contentWidthMm,
		descriptionWidthMm:
			columnWidthMm - template.reservedWidthMm[input.unitFormId],
	};
}

function validateBodyWidth(
	input: BodyWidthInput,
	references: ThemeCatalogReferences,
): void {
	const unitForm = references.unitForms.get(input.unitFormId);
	if (!unitForm) {
		throw new ThemeRecipeValidationError(
			`未登録の単位形式「${input.unitFormId}」です。`,
		);
	}
	const width = bodyWidth(input, references);
	const label = `構図「${input.compositionId}」・装飾「${input.decorId}」・単位形式「${input.unitFormId}」・本文テンプレート「${input.itineraryTemplateId}」・密度「${input.densityId}」`;
	if (width.descriptionWidthMm < unitForm.minDescriptionWidthMm) {
		throw new ThemeRecipeValidationError(
			`${label}のSpot説明幅${width.descriptionWidthMm.toFixed(1)}mmは最小幅${unitForm.minDescriptionWidthMm}mmを満たしません。`,
		);
	}
	if (unitForm.detailColumns === 3) {
		const required =
			unitForm.detailColumns * unitForm.minDetailCellWidthMm +
			(unitForm.detailColumns - 1) * DETAIL_COLUMN_GAP_MM;
		if (width.descriptionWidthMm < required) {
			throw new ThemeRecipeValidationError(
				`${label}の補助情報幅${width.descriptionWidthMm.toFixed(1)}mmは${required}mmを満たしません。`,
			);
		}
	}
}

/**
 * Static width rule over every combination a mood can produce. The result
 * depends only on definitions, so validating the allow-lists once is
 * equivalent to validating every seed.
 */
export function validateMoodBodyWidths(
	mood: MoodDefinition,
	references: ThemeCatalogReferences,
): void {
	for (const compositionId of mood.compositions) {
		const composition = references.compositions.get(compositionId);
		if (!composition) {
			throw new ThemeRecipeValidationError(
				`雰囲気「${mood.id}」に未登録のページ構図「${compositionId}」があります。`,
			);
		}
		const unitForms = mood.unitForms.filter((unitFormId) =>
			composition.unitForms.includes(unitFormId),
		);
		if (unitForms.length === 0) {
			throw new ThemeRecipeValidationError(
				`雰囲気「${mood.id}」の単位形式とページ構図「${compositionId}」の単位形式に共通の値がありません。`,
			);
		}
		for (const unitFormId of unitForms) {
			for (const decorId of mood.decors) {
				for (const itineraryTemplateId of mood.itineraryTemplates) {
					for (const densityId of references.densities.keys()) {
						validateBodyWidth(
							{
								compositionId,
								decorId,
								densityId,
								itineraryTemplateId,
								unitFormId,
							},
							references,
						);
					}
				}
			}
		}
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

export function validateDecorDefinitions(
	references: ThemeCatalogReferences,
): void {
	for (const [id, decor] of references.decors) {
		if (id !== decor.id) {
			throw new ThemeRecipeValidationError(
				`装飾語彙のキー「${id}」と定義ID「${decor.id}」が一致しません。`,
			);
		}
		validateDecorDefinition(decor, references);
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
	const decor = references.decors.get(recipe.decorId);
	if (!decor) {
		throw new ThemeRecipeValidationError(
			`未登録の装飾語彙「${recipe.decorId}」です。`,
		);
	}
	validateDecorDefinition(decor, references);
	const composition = references.compositions.get(recipe.compositionId);
	if (!composition) {
		throw new ThemeRecipeValidationError(
			`未登録のページ構図「${recipe.compositionId}」です。`,
		);
	}
	if (!composition.selectable) {
		throw new ThemeRecipeValidationError(
			`ページ構図「${recipe.compositionId}」はテーマレシピで選択できません。`,
		);
	}
	validateCompositionDefinition(composition, references);
	const unitForm = references.unitForms.get(recipe.unitFormId);
	if (!unitForm) {
		throw new ThemeRecipeValidationError(
			`未登録の単位形式「${recipe.unitFormId}」です。`,
		);
	}
	validateUnitFormDefinition(unitForm);
	if (!composition.unitForms.includes(recipe.unitFormId)) {
		throw new ThemeRecipeValidationError(
			`ページ構図「${recipe.compositionId}」は単位形式「${recipe.unitFormId}」を許可していません。`,
		);
	}
	if (!references.inkStyles.has(recipe.inkStyleId)) {
		throw new ThemeRecipeValidationError(
			`未登録の色の載せ方「${recipe.inkStyleId}」です。`,
		);
	}
	validateBodyWidth(recipe, references);
}

function validateTypography(
	recipe: ThemeRecipeDefinition,
	references: ThemeCatalogReferences,
): void {
	const { typography } = recipe;
	const unitForm = references.unitForms.get(recipe.unitFormId);
	if (!unitForm) {
		throw new ThemeRecipeValidationError(
			`未登録の単位形式「${recipe.unitFormId}」です。`,
		);
	}
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
		unitForm.minDescriptionWidthMm,
		unitForm.minDescriptionWidthMm,
		"Spot説明領域の幅",
	);
	requireRange(
		typography.utilityWidthMm,
		unitForm.minDetailCellWidthMm,
		unitForm.minDetailCellWidthMm,
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
	validateTypography(recipe, references);
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
			| "compositionId"
			| "coverLayoutId"
			| "decorId"
			| "densityId"
			| "displayFontId"
			| "emphasisId"
			| "inkStyleId"
			| "itineraryTemplateId"
		>
	>,
	references: ThemeCatalogReferences,
): BookletThemeCandidate {
	const recipe = requested.recipe;
	const densityId = overrides.densityId ?? recipe.densityId;
	return Object.freeze({
		compositionId: overrides.compositionId ?? recipe.compositionId,
		coverLayoutId: overrides.coverLayoutId ?? recipe.coverLayoutId,
		decorId: overrides.decorId ?? recipe.decorId,
		densityId,
		displayFontId: overrides.displayFontId ?? recipe.displayFontId,
		emphasisId: overrides.emphasisId ?? recipe.emphasisId,
		fallbackStep: step,
		fontPairId: recipe.fontPairId,
		inkStyleId: overrides.inkStyleId ?? recipe.inkStyleId,
		itineraryTemplateId:
			overrides.itineraryTemplateId ?? recipe.itineraryTemplateId,
		moodId: recipe.moodId,
		paletteId: recipe.paletteId,
		requestedRecipeId: recipe.id,
		resolvedThemeKey: `${requested.seedToken}:${step}`,
		typography: typographyForDensity(recipe.typography, densityId, references),
		unitFormId: recipe.unitFormId,
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
		left.densityId === right.densityId &&
		left.compositionId === right.compositionId &&
		left.unitFormId === right.unitFormId &&
		left.inkStyleId === right.inkStyleId
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
	if (requested.recipe.compositionId !== "top-stack") {
		candidates.push(
			candidate(
				requested,
				"single-column",
				{ compositionId: "top-stack", densityId: "compact" },
				references,
			),
		);
	}
	candidates.push(
		candidate(
			requested,
			"safe-geometry",
			{
				compositionId: "top-stack",
				coverLayoutId: "safe-cover",
				decorId: "none",
				densityId: "compact",
				displayFontId: "inherit",
				emphasisId: "balanced",
				inkStyleId: "text",
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
	if (unique.length === 0 || unique.length > MAXIMUM_CANDIDATE_COUNT) {
		throw new ThemeRecipeValidationError(
			`テーマ候補列は1件以上${MAXIMUM_CANDIDATE_COUNT}件以下にしてください。`,
		);
	}
	return Object.freeze(unique);
}
