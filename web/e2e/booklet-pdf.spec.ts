import { expect, test } from "@playwright/test";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import {
	THEME_RECIPES_V1,
	V1_REPRESENTATIVE_SEEDS,
} from "../src/theme/bookletTheme.js";
import { routeBookletApi } from "./fixtures/booklet.js";

const representativeSeedForRecipe = new Map(
	[...V1_REPRESENTATIVE_SEEDS].map(([seed, recipeId]) => [recipeId, seed]),
);

test.describe("PDFしおり", () => {
	test.beforeEach(async ({ page }) => {
		await routeBookletApi(page);
	});

	for (const recipe of THEME_RECIPES_V1) {
		const seed = representativeSeedForRecipe.get(recipe.id);
		if (seed === undefined) {
			throw new Error(`V1レシピ「${recipe.id}」の代表シードがありません。`);
		}
		test(`V1 recipe ${recipe.id} は文字を隠さずA5として描画する`, async ({
			page,
		}) => {
			await page.goto(
				`/journeys/journey-1/booklet?seed=v1-${seed.toString(16).padStart(8, "0")}`,
			);
			await expect(page.getByRole("status")).toHaveText(
				/テーマ .* の印刷準備ができました。/,
			);
			await expect(
				page.getByRole("button", { name: "PDFを印刷" }),
			).toBeEnabled();
			const problems = await page
				.locator("[data-booklet-text-role]")
				.evaluateAll((elements) =>
					elements.flatMap((element) => {
						const htmlElement = element as HTMLElement;
						const style = getComputedStyle(htmlElement);
						const hidden =
							["hidden", "clip", "scroll", "auto"].includes(style.overflow) ||
							style.whiteSpace === "nowrap" ||
							(style.textOverflow !== "" && style.textOverflow !== "clip") ||
							style.transform.includes("scale");
						return htmlElement.scrollWidth > htmlElement.clientWidth ||
							htmlElement.scrollHeight > htmlElement.clientHeight ||
							hidden
							? [htmlElement.dataset.bookletTextRole]
							: [];
					}),
				);
			expect(problems).toEqual([]);

			const cover = page.locator(".booklet-document .booklet-page--cover");
			await expect(cover).toHaveCount(1);
			await expect(cover).toHaveScreenshot(
				`v1-${seed.toString(16).padStart(8, "0")}-cover.png`,
				{ animations: "disabled", caret: "hide" },
			);
			const coverLayers = await cover.evaluate((element) => {
				const styleOf = (selector: string) => {
					const layer = element.querySelector<HTMLElement | SVGElement>(
						selector,
					);
					return layer ? getComputedStyle(layer) : null;
				};
				const image = element.querySelector<HTMLImageElement>(
					".booklet-cover__image",
				);
				const veil = element.querySelector<SVGSVGElement>(
					".booklet-cover__veil",
				);
				const coverLayout = Array.from(
					element.closest<HTMLElement>(".booklet-theme")?.classList ?? [],
				)
					.find((className) => className.startsWith("booklet-theme--cover-"))
					?.slice("booklet-theme--cover-".length);
				return {
					coverLayout,
					gradientType:
						veil?.querySelector("linearGradient")?.tagName ??
						veil?.querySelector("radialGradient")?.tagName,
					imageLoaded: (image?.naturalWidth ?? 0) > 0,
					imageZIndex: styleOf(".booklet-cover__image")?.zIndex,
					legacyLayerCount: element.querySelectorAll(
						".booklet-cover__panel, .booklet-cover__scrim",
					).length,
					textZIndex: styleOf(".booklet-cover__text")?.zIndex,
					veilBounds: veil?.dataset.bookletCoverVeil,
					veilZIndex: styleOf(".booklet-cover__veil")?.zIndex,
				};
			});
			expect(coverLayers.imageLoaded).toBe(true);
			expect(coverLayers.imageZIndex).toBe("0");
			expect(coverLayers.veilZIndex).toBe("1");
			expect(coverLayers.textZIndex).toBe("2");
			expect(coverLayers.legacyLayerCount).toBe(0);
			expect(coverLayers.gradientType).toBe(
				coverLayers.coverLayout === "split-left" ||
					coverLayers.coverLayout === "horizon"
					? "linearGradient"
					: "radialGradient",
			);
			const veilBounds = coverLayers.veilBounds?.split(",").map(Number) ?? [];
			expect(veilBounds).toHaveLength(4);
			expect(veilBounds.every((value) => Number.isFinite(value))).toBe(true);
			expect(veilBounds[2]).toBeGreaterThan(0);
			expect(veilBounds[3]).toBeGreaterThan(0);
			const box = await cover.boundingBox();
			expect(box?.width).toBeCloseTo(559, 0);
			expect(box?.height).toBeCloseTo(794, 0);

			const layoutSafety = await page
				.locator(".booklet-document .booklet-page--day")
				.first()
				.evaluate((day) => {
					const spotDescription = day.querySelector<HTMLElement>(
						'[data-booklet-text-role="spot-description"]',
					);
					const detailCells = Array.from(
						day.querySelectorAll<HTMLElement>(".booklet-unit__details > div"),
					).map((cell) => cell.getBoundingClientRect().width);
					const style = getComputedStyle(day);
					return {
						detailCellWidths: detailCells,
						printColorAdjust: style.printColorAdjust,
						spotDescriptionWidth:
							spotDescription?.getBoundingClientRect().width ?? 0,
						webkitPrintColorAdjust: style.getPropertyValue(
							"-webkit-print-color-adjust",
						),
					};
				});
			const mmToCssPx = 96 / 25.4;
			expect(layoutSafety.spotDescriptionWidth).toBeGreaterThanOrEqual(
				56 * mmToCssPx - 1,
			);
			expect(layoutSafety.detailCellWidths.length).toBeGreaterThan(0);
			expect(Math.min(...layoutSafety.detailCellWidths)).toBeGreaterThanOrEqual(
				22 * mmToCssPx - 1,
			);
			expect(layoutSafety.printColorAdjust).toBe("exact");
			expect(layoutSafety.webkitPrintColorAdjust).toBe("exact");
		});
	}

	test("代表テーマをA5 PDFとして出力できる", async ({ page }) => {
		await page.goto("/journeys/journey-1/booklet?seed=v1-00000007");
		await expect(page.getByRole("button", { name: "PDFを印刷" })).toBeEnabled();
		await page.emulateMedia({ media: "print" });
		const pdf = await page.pdf({
			preferCSSPageSize: true,
			printBackground: true,
		});
		expect(pdf.byteLength).toBeGreaterThan(1000);
		const pdfDocument = await getDocument({ data: new Uint8Array(pdf) })
			.promise;
		expect(pdfDocument.numPages).toBe(3);
		for (
			let pageNumber = 1;
			pageNumber <= pdfDocument.numPages;
			pageNumber += 1
		) {
			const pdfPage = await pdfDocument.getPage(pageNumber);
			const [left, bottom, right, top] = pdfPage.view;
			expect(Math.abs(right - left - 419.53)).toBeLessThan(1);
			expect(Math.abs(top - bottom - 595.28)).toBeLessThan(1);
		}
		const coverText = await (await pdfDocument.getPage(1)).getTextContent();
		expect(
			coverText.items.map((item) => ("str" in item ? item.str : "")).join(""),
		).toContain("非常に長い目的地名称を含む京都の旅");
		// Chromium embeds SVG cover assets as either image or form XObjects.
		expect(new TextDecoder("latin1").decode(pdf)).toMatch(
			/\/Subtype\s*\/(?:Image|Form)/,
		);
		await pdfDocument.destroy();
	});
});
