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

const templateRepresentativeSeeds = (
	[
		{ recipeId: "way-02", templateId: "route-thread" },
		{ recipeId: "field-03", templateId: "field-journal" },
		{ recipeId: "ticket-03", templateId: "travel-ticket" },
	] as const
).map(({ recipeId, templateId }) => {
	const recipe = THEME_RECIPES_V1.find((item) => item.id === recipeId);
	if (!recipe || recipe.itineraryTemplateId !== templateId) {
		throw new Error(`本文テンプレート「${templateId}」のレシピがありません。`);
	}
	const seed = representativeSeedForRecipe.get(recipe.id);
	if (seed === undefined) {
		throw new Error(`V1レシピ「${recipe.id}」の代表シードがありません。`);
	}
	return { seed, templateId };
});

const LAYOUT_ROUNDING_TOLERANCE_PX = 1;

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
				.evaluateAll(
					(elements, tolerance) =>
						elements.flatMap((element) => {
							const htmlElement = element as HTMLElement;
							const style = getComputedStyle(htmlElement);
							const hidden =
								["hidden", "clip", "scroll", "auto"].includes(style.overflow) ||
								style.whiteSpace === "nowrap" ||
								(style.textOverflow !== "" && style.textOverflow !== "clip") ||
								style.transform.includes("scale");
							return htmlElement.scrollWidth >
								htmlElement.clientWidth + tolerance ||
								htmlElement.scrollHeight >
									htmlElement.clientHeight + tolerance ||
								hidden
								? [htmlElement.dataset.bookletTextRole]
								: [];
						}),
					LAYOUT_ROUNDING_TOLERANCE_PX,
				);
			expect(problems).toEqual([]);

			const cover = page.locator(".booklet-document .booklet-page--cover");
			await expect(cover).toHaveCount(1);
			await expect(cover).toHaveScreenshot(
				`v1-${seed.toString(16).padStart(8, "0")}-cover.png`,
				{ animations: "disabled", caret: "hide" },
			);
			const firstDay = page
				.locator(".booklet-document .booklet-page--day")
				.first();
			await expect(firstDay).toHaveScreenshot(
				`v1-${seed.toString(16).padStart(8, "0")}-day.png`,
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
						descriptionTextAlign: spotDescription
							? getComputedStyle(spotDescription).textAlign
							: "",
						printColorAdjust: style.printColorAdjust,
						unitTextAlign: day.querySelector<HTMLElement>(".booklet-unit")
							? getComputedStyle(
									day.querySelector<HTMLElement>(
										".booklet-unit",
									) as HTMLElement,
								).textAlign
							: "",
						pageTextAlign: style.textAlign,
						spotDescriptionWidth:
							spotDescription?.getBoundingClientRect().width ?? 0,
						webkitPrintColorAdjust: style.getPropertyValue(
							"-webkit-print-color-adjust",
						),
					};
				});
			const mmToCssPx = 96 / 25.4;
			expect(layoutSafety.spotDescriptionWidth).toBeGreaterThanOrEqual(
				76 * mmToCssPx - 1,
			);
			expect(layoutSafety.detailCellWidths.length).toBeGreaterThan(0);
			expect(Math.min(...layoutSafety.detailCellWidths)).toBeGreaterThanOrEqual(
				22 * mmToCssPx - 1,
			);
			expect(layoutSafety.pageTextAlign).toBe("left");
			expect(layoutSafety.unitTextAlign).toBe("left");
			expect(layoutSafety.descriptionTextAlign).toBe("left");
			expect(layoutSafety.printColorAdjust).toBe("exact");
			expect(layoutSafety.webkitPrintColorAdjust).toBe("exact");
		});
	}

	for (const { seed, templateId } of templateRepresentativeSeeds) {
		test(`${templateId} は長い一日の継続ページを描画する`, async ({ page }) => {
			await routeBookletApi(page, "long");
			await page.goto(
				`/journeys/journey-long/booklet?seed=v1-${seed.toString(16).padStart(8, "0")}`,
			);
			await expect(page.getByRole("status")).toHaveText(
				/テーマ .* の印刷準備ができました。/,
			);

			const dayPages = page.locator(".booklet-document .booklet-page--day");
			await expect.poll(() => dayPages.count()).toBeGreaterThan(1);
			const continuation = page
				.locator(".booklet-document .booklet-page--day-continuation")
				.first();
			await expect(continuation).toBeVisible();
			await expect(continuation.locator(".booklet-day-header")).toHaveText(
				/続き/,
			);
			await expect(continuation).toHaveScreenshot(
				`long-${templateId}-continuation.png`,
				{ animations: "disabled", caret: "hide" },
			);

			if (templateId === "route-thread") {
				const continuationThread = await continuation.evaluate((element) => {
					const style = getComputedStyle(element, "::before");
					return {
						bottom: style.bottom,
						content: style.content,
						position: style.position,
						top: style.top,
					};
				});
				expect(continuationThread.content).not.toBe("none");
				expect(continuationThread.position).toBe("absolute");
				expect(continuationThread.bottom).toBe("0px");
			}
		});
	}

	test("代表テーマをA5 PDFとして出力できる", async ({ page }) => {
		await page.goto("/journeys/journey-1/booklet?seed=v1-00000007");
		await expect(page.getByRole("button", { name: "PDFを印刷" })).toBeEnabled();
		const coverImage = page.locator(
			".booklet-document .booklet-page--cover .booklet-cover__image",
		);
		await expect(coverImage).toHaveJSProperty("complete", true);
		await expect(coverImage).toHaveJSProperty("naturalWidth", 800);
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
		await pdfDocument.destroy();
	});
});
