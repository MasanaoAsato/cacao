import { describe, expect, it } from "vitest";
import {
	createBookletTheme,
	getCompositionDefinition,
	getThemeCandidates,
	THEME_CATALOG_REFERENCES,
} from "./bookletTheme";
import { MOODS } from "./catalog";
import { decorContentInset } from "./decorGeometry";
import { MOTIFS } from "./motifs";
import {
	bodyWidth,
	defineThemeRecipe,
	ThemeRecipeValidationError,
	validateCompositionDefinitions,
	validateDecorContrast,
	validateDecorDefinitions,
	validateMoodBodyWidths,
	validatePaletteDefinitions,
	validateUnitFormDefinitions,
} from "./recipeSafety";
import type { CoverLayoutDefinition, ThemeCatalogReferences } from "./types";

function selectedRecipe() {
	return createBookletTheme({ value: 7, version: "v2" }).recipe;
}

function referencesWithCover(
	override: Partial<CoverLayoutDefinition>,
): ThemeCatalogReferences {
	const cover = THEME_CATALOG_REFERENCES.coverLayouts.get("north-west");
	if (!cover) {
		throw new Error("north-west構図がありません。");
	}
	return {
		...THEME_CATALOG_REFERENCES,
		coverLayouts: new Map(THEME_CATALOG_REFERENCES.coverLayouts).set(
			"north-west",
			{ ...cover, ...override },
		),
	};
}

describe("テーマレシピの静的安全性", () => {
	it("正常系: 解決済みのV2テーマから収まり確認候補を作る", () => {
		const requested = createBookletTheme({ value: 7, version: "v2" });
		const candidates = getThemeCandidates(requested);
		expect(candidates.length).toBeGreaterThanOrEqual(2);
		expect(candidates.length).toBeLessThanOrEqual(5);
		expect(candidates[0]?.fallbackStep).toBe("selected");
		expect(candidates.at(-1)?.fallbackStep).toBe("safe-geometry");
		expect(candidates.at(-1)?.decorId).toBe("none");
		expect(candidates.at(-1)?.displayFontId).toBe("inherit");
		expect(candidates.at(-1)?.compositionId).toBe("top-stack");
		expect(candidates.at(-1)?.inkStyleId).toBe("text");
		expect(candidates.at(-1)?.unitFormId).toBe(requested.recipe.unitFormId);
	});

	it("正常系: top-stack以外の構図はsingle-columnの候補を経てsafe-geometryへ落ちる", () => {
		const requested = createBookletTheme({ value: 7, version: "v2" });
		const sideBand = {
			...requested,
			recipe: { ...requested.recipe, compositionId: "side-band" as const },
		};
		const steps = getThemeCandidates(sideBand).map(
			(candidate) => candidate.fallbackStep,
		);
		expect(steps).toContain("single-column");
		expect(steps.indexOf("single-column")).toBe(steps.length - 2);
		const singleColumn = getThemeCandidates(sideBand).find(
			(candidate) => candidate.fallbackStep === "single-column",
		);
		expect(singleColumn).toMatchObject({
			compositionId: "top-stack",
			decorId: requested.recipe.decorId,
			densityId: "compact",
			inkStyleId: requested.recipe.inkStyleId,
			unitFormId: requested.recipe.unitFormId,
		});
		expect(
			getThemeCandidates({
				...requested,
				recipe: { ...requested.recipe, compositionId: "top-stack" },
			}).map((candidate) => candidate.fallbackStep),
		).not.toContain("single-column");
	});

	it("正常系: 本文幅を定義だけから求める", () => {
		expect(
			bodyWidth(
				{
					compositionId: "two-column",
					decorId: "hairline-frame",
					densityId: "airy",
					itineraryTemplateId: "banner-list",
					unitFormId: "line",
				},
				THEME_CATALOG_REFERENCES,
			),
		).toEqual({
			columnWidthMm: 57,
			contentWidthMm: 120,
			descriptionWidthMm: 57,
		});
		expect(
			bodyWidth(
				{
					compositionId: "side-band",
					decorId: "route-dash",
					densityId: "airy",
					itineraryTemplateId: "rail-ledger",
					unitFormId: "compact",
				},
				THEME_CATALOG_REFERENCES,
			),
		).toEqual({
			columnWidthMm: 94,
			contentWidthMm: 94,
			descriptionWidthMm: 56,
		});
	});

	it("異常系: 2列にfullを置いた雰囲気は幅の規則で拒否する", () => {
		const postcard = MOODS.get("postcard");
		if (!postcard) {
			throw new Error("postcardの定義がありません。");
		}
		const references: ThemeCatalogReferences = {
			...THEME_CATALOG_REFERENCES,
			compositions: new Map(THEME_CATALOG_REFERENCES.compositions).set(
				"two-column",
				{
					...getCompositionDefinition("two-column"),
					unitForms: ["full", "line"],
				},
			),
		};
		expect(() =>
			validateMoodBodyWidths(
				{ ...postcard, unitForms: ["full", "line"] },
				references,
			),
		).toThrow(ThemeRecipeValidationError);
	});

	it("異常系: 単位形式とページ構図に共通の値がない雰囲気を拒否する", () => {
		const postcard = MOODS.get("postcard");
		if (!postcard) {
			throw new Error("postcardの定義がありません。");
		}
		expect(() =>
			validateMoodBodyWidths(
				{ ...postcard, unitForms: ["full"] },
				THEME_CATALOG_REFERENCES,
			),
		).toThrow(ThemeRecipeValidationError);
	});

	it("異常系: 帯幅が範囲外のページ構図を拒否する", () => {
		const references: ThemeCatalogReferences = {
			...THEME_CATALOG_REFERENCES,
			compositions: new Map(THEME_CATALOG_REFERENCES.compositions).set(
				"side-band",
				{
					...getCompositionDefinition("side-band"),
					header: {
						bandWidthMm: 30,
						placement: "side-right",
						writingMode: "vertical",
					},
				},
			),
		};
		expect(() => validateCompositionDefinitions(references)).toThrow(
			ThemeRecipeValidationError,
		);
	});

	it("境界値系: 帯幅16mmと内側余白20mmのページ構図を受理する", () => {
		const references: ThemeCatalogReferences = {
			...THEME_CATALOG_REFERENCES,
			compositions: new Map(THEME_CATALOG_REFERENCES.compositions).set(
				"side-band",
				{
					...getCompositionDefinition("side-band"),
					contentInsetMm: { bottom: 0, left: 0, right: 20, top: 0 },
					header: {
						bandWidthMm: 16,
						placement: "side-right",
						writingMode: "vertical",
					},
				},
			),
		};
		expect(() => validateCompositionDefinitions(references)).not.toThrow();
	});

	it("異常系: Spot説明の最小幅が範囲外の単位形式を拒否する", () => {
		const compact = THEME_CATALOG_REFERENCES.unitForms.get("compact");
		if (!compact) {
			throw new Error("compactの定義がありません。");
		}
		const references: ThemeCatalogReferences = {
			...THEME_CATALOG_REFERENCES,
			unitForms: new Map(THEME_CATALOG_REFERENCES.unitForms).set("compact", {
				...compact,
				minDescriptionWidthMm: 39,
			}),
		};
		expect(() => validateUnitFormDefinitions(references)).toThrow(
			ThemeRecipeValidationError,
		);
	});

	it("異常系: 構図が許可しない単位形式のレシピを拒否する", () => {
		expect(() =>
			defineThemeRecipe(
				{
					...selectedRecipe(),
					compositionId: "two-column",
					unitFormId: "full",
				},
				THEME_CATALOG_REFERENCES,
			),
		).toThrow(ThemeRecipeValidationError);
	});

	it("異常系: safe-coverを通常レシピとして定義できない", () => {
		expect(() =>
			defineThemeRecipe(
				{ ...selectedRecipe(), coverLayoutId: "safe-cover" },
				THEME_CATALOG_REFERENCES,
			),
		).toThrow(ThemeRecipeValidationError);
	});

	it("境界値系: 表紙タイトルの22〜56ptを受理する", () => {
		for (const titleSizePt of [22, 56]) {
			expect(() =>
				defineThemeRecipe(
					{ ...selectedRecipe(), coverLayoutId: "north-west" },
					referencesWithCover({ titleSizePt }),
				),
			).not.toThrow();
		}
	});

	it("境界値系: 派生した内側余白が18mmの装飾を受理する", () => {
		const stripeBand = THEME_CATALOG_REFERENCES.decors.get("stripe-band");
		const band = stripeBand?.motifs[0];
		if (!stripeBand || !band) {
			throw new Error("stripe-bandの定義がありません。");
		}
		const references = {
			...THEME_CATALOG_REFERENCES,
			decors: new Map(THEME_CATALOG_REFERENCES.decors).set("stripe-band", {
				...stripeBand,
				motifs: [{ ...band, sizeMm: [18, 18] as const }],
			}),
		};
		expect(() => validateDecorDefinitions(references)).not.toThrow();
		expect(decorContentInset(stripeBand, MOTIFS)).toEqual({
			bottom: 0,
			left: 0,
			right: 0,
			top: 6,
		});
	});

	it("異常系: 派生した内側余白が上限を超える装飾を拒否する", () => {
		const stripeBand = THEME_CATALOG_REFERENCES.decors.get("stripe-band");
		const band = stripeBand?.motifs[0];
		if (!stripeBand || !band) {
			throw new Error("stripe-bandの定義がありません。");
		}
		const references = {
			...THEME_CATALOG_REFERENCES,
			decors: new Map(THEME_CATALOG_REFERENCES.decors).set("stripe-band", {
				...stripeBand,
				motifs: [{ ...band, sizeMm: [18.1, 18.1] as const }],
			}),
		};
		expect(() => validateDecorDefinitions(references)).toThrow(
			ThemeRecipeValidationError,
		);
	});

	it("正常系: 回転後の外接矩形を含めても余白内に収まる装飾を受理する", () => {
		const routeDash = THEME_CATALOG_REFERENCES.decors.get("route-dash");
		const rail = routeDash?.motifs[0];
		if (!routeDash || !rail) {
			throw new Error("route-dashの定義がありません。");
		}
		const references = {
			...THEME_CATALOG_REFERENCES,
			decors: new Map(THEME_CATALOG_REFERENCES.decors).set("route-dash", {
				...routeDash,
				motifs: [
					{ ...rail, rotateDeg: [45, 45] as const, sizeMm: [30, 30] as const },
				],
			}),
		};
		expect(() => validateDecorDefinitions(references)).not.toThrow();
	});

	it("異常系: 回転後の外接矩形で内側余白が上限を超える装飾を拒否する", () => {
		const routeDash = THEME_CATALOG_REFERENCES.decors.get("route-dash");
		const rail = routeDash?.motifs[0];
		if (!routeDash || !rail) {
			throw new Error("route-dashの定義がありません。");
		}
		const references = {
			...THEME_CATALOG_REFERENCES,
			decors: new Map(THEME_CATALOG_REFERENCES.decors).set("route-dash", {
				...routeDash,
				motifs: [{ ...rail, rotateDeg: [45, 45] as const }],
			}),
		};
		expect(() => validateDecorDefinitions(references)).toThrow(
			ThemeRecipeValidationError,
		);
	});

	it("異常系: 四隅の置き場に複数の図形を置く装飾を拒否する", () => {
		const confetti = THEME_CATALOG_REFERENCES.decors.get("confetti-corners");
		const corner = confetti?.motifs[0];
		if (!confetti || !corner) {
			throw new Error("confetti-cornersの定義がありません。");
		}
		const references = {
			...THEME_CATALOG_REFERENCES,
			decors: new Map(THEME_CATALOG_REFERENCES.decors).set("confetti-corners", {
				...confetti,
				motifs: [{ ...corner, count: 2 }, ...confetti.motifs.slice(1)],
			}),
		};
		expect(() => validateDecorDefinitions(references)).toThrow(
			ThemeRecipeValidationError,
		);
	});

	it("異常系: パネルなしで濃い柄地を持つ装飾を拒否する", () => {
		const dottedGrid = THEME_CATALOG_REFERENCES.decors.get("dotted-grid");
		if (dottedGrid?.ground.kind !== "pattern") {
			throw new Error("dotted-gridの定義がありません。");
		}
		const references = {
			...THEME_CATALOG_REFERENCES,
			decors: new Map(THEME_CATALOG_REFERENCES.decors).set("dotted-grid", {
				...dottedGrid,
				ground: { ...dottedGrid.ground, sizeMm: 2, tileMm: 4 },
			}),
		};
		expect(() => validateDecorDefinitions(references)).toThrow(
			ThemeRecipeValidationError,
		);
	});

	it("異常系: パネルを持たない画像地の装飾を拒否する", () => {
		const photoWash = THEME_CATALOG_REFERENCES.decors.get("photo-wash");
		if (!photoWash) {
			throw new Error("photo-washの定義がありません。");
		}
		const references = {
			...THEME_CATALOG_REFERENCES,
			decors: new Map(THEME_CATALOG_REFERENCES.decors).set("photo-wash", {
				...photoWash,
				panel: { kind: "none" },
			}),
		};
		expect(() => validateDecorDefinitions(references)).toThrow(
			ThemeRecipeValidationError,
		);
	});

	it("異常系: パネルの実効色で本文文字コントラストが7:1を下回る装飾を拒否する", () => {
		const sheetOnDots = THEME_CATALOG_REFERENCES.decors.get("sheet-on-dots");
		if (sheetOnDots?.panel.kind !== "sheet") {
			throw new Error("sheet-on-dotsの定義がありません。");
		}
		const references = {
			...THEME_CATALOG_REFERENCES,
			decors: new Map(THEME_CATALOG_REFERENCES.decors).set("sheet-on-dots", {
				...sheetOnDots,
				ground: {
					kind: "image",
					opacity: 0.5,
					source: "cover",
					treatment: "tint",
				},
				panel: { ...sheetOnDots.panel, opacity: 0.5 },
			}),
		};
		expect(() => validateDecorContrast(references)).toThrow(
			ThemeRecipeValidationError,
		);
		expect(() => validateDecorContrast(THEME_CATALOG_REFERENCES)).not.toThrow();
	});

	it("異常系: 表紙紙面とcoverInkの薄いコントラストを拒否する", () => {
		const palette = THEME_CATALOG_REFERENCES.palettes.get("paper-ink");
		if (!palette) {
			throw new Error("paper-ink配色がありません。");
		}
		const references: ThemeCatalogReferences = {
			...THEME_CATALOG_REFERENCES,
			palettes: new Map(THEME_CATALOG_REFERENCES.palettes).set("paper-ink", {
				...palette,
				surfaceStops: [palette.coverInk, palette.coverInk],
			}),
		};
		expect(() =>
			defineThemeRecipe(
				{ ...selectedRecipe(), paletteId: "paper-ink" },
				references,
			),
		).toThrow(ThemeRecipeValidationError);
	});

	it("異常系: 本文帯の混色で文字コントラストが7:1を下回る配色を拒否する", () => {
		const palette = THEME_CATALOG_REFERENCES.palettes.get("paper-ink");
		if (!palette) {
			throw new Error("paper-ink配色がありません。");
		}
		const references: ThemeCatalogReferences = {
			...THEME_CATALOG_REFERENCES,
			palettes: new Map(THEME_CATALOG_REFERENCES.palettes).set("paper-ink", {
				...palette,
				itinerary: {
					accent: "#30373D",
					border: palette.border,
					muted: palette.muted,
					surfaceStops: palette.surfaceStops,
					text: "#4D5357",
				},
			}),
		};
		expect(() => validatePaletteDefinitions(references)).toThrow(
			ThemeRecipeValidationError,
		);
	});
});
