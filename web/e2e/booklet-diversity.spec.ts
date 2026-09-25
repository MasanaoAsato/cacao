import { expect, test } from "@playwright/test";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { COMPARISON_BOOKLET_EXPECTED_UNITS } from "./fixtures/booklet.js";
import { DIVERSITY_SAMPLES } from "./fixtures/booklet-diversity.js";
import plan from "./fixtures/booklet-publication-plan.json";
import {
	expectArtworkClearOfText,
	expectBookletPrintReady,
	expectContentInsidePages,
	expectNoHiddenText,
	seedToken,
} from "./support/booklet-assertions.js";

test.describe("25.5 同条件の比較作例", () => {
	test.skip(
		plan.directionIds.length === 0,
		"公開予定方向の集合とreviewed素材が未登録です",
	);
	for (const sample of DIVERSITY_SAMPLES) {
		test(`正常系: ${sample.id} の画面・PDFと比較資料を保存する`, async ({
			page,
		}, testInfo) => {
			await page.goto(
				`/e2e/fixtures/booklet-publication-review.html?seed=${seedToken(sample.seed)}`,
			);
			await expectBookletPrintReady(page);
			const document = page.locator(".booklet-document");
			const pages = document.locator("[data-booklet-page]");
			const unitIds = await document
				.locator("[data-unit-id]")
				.evaluateAll((elements) =>
					elements.map((element) => element.getAttribute("data-unit-id")),
				);
			expect(unitIds).toEqual(COMPARISON_BOOKLET_EXPECTED_UNITS);
			await expectNoHiddenText(page);
			await expectContentInsidePages(page);
			await expectArtworkClearOfText(page);
			const metadata = {
				sampleId: sample.id,
				seed: seedToken(sample.seed),
				catalogRevision: await page
					.locator(".booklet-shell")
					.getAttribute("data-booklet-catalog-revision"),
				baseDirectionId: await page
					.locator(".booklet-shell")
					.getAttribute("data-booklet-direction-id"),
				pageCount: await pages.count(),
				pages: await pages.evaluateAll((elements) =>
					elements.map((element) => ({
						pageId: element.getAttribute("data-page-id"),
						moduleId: element.getAttribute("data-module-id"),
						effects: Array.from(
							element.querySelectorAll("[data-direction-effect]"),
						).flatMap((marked) =>
							(marked.getAttribute("data-direction-effect") ?? "")
								.split(" ")
								.filter(Boolean),
						),
						assets: Array.from(
							element.querySelectorAll("[data-artwork-asset]"),
						).map((asset) => asset.getAttribute("data-artwork-asset")),
					})),
				),
			};
			expect(metadata.pageCount).toBeGreaterThan(3);
			expect(metadata.pages.some((item) => item.effects.length > 0)).toBe(true);
			await testInfo.attach("comparison.json", {
				body: JSON.stringify(metadata, null, 2),
				contentType: "application/json",
			});
			await testInfo.attach("booklet.html", {
				body: await document.evaluate((element) => element.outerHTML),
				contentType: "text/html",
			});
			await testInfo.attach("color.png", {
				body: await document.screenshot(),
				contentType: "image/png",
			});
			await document.evaluate((element) => {
				(element as HTMLElement).style.filter = "grayscale(1)";
			});
			await testInfo.attach("grayscale.png", {
				body: await document.screenshot(),
				contentType: "image/png",
			});
			await document.evaluate((element) => {
				(element as HTMLElement).style.filter = "";
			});
			await page.emulateMedia({ media: "print" });
			const pdf = await page.pdf({
				preferCSSPageSize: true,
				printBackground: true,
			});
			const printed = await getDocument({ data: new Uint8Array(pdf) }).promise;
			expect(printed.numPages).toBe(metadata.pageCount);
			for (let index = 1; index <= printed.numPages; index += 1) {
				const [left = 0, bottom = 0, right = 0, top = 0] = (
					await printed.getPage(index)
				).view;
				expect(right - left).toBeCloseTo((148 / 25.4) * 72, 0);
				expect(top - bottom).toBeCloseTo((210 / 25.4) * 72, 0);
			}
			await testInfo.attach("booklet.pdf", {
				body: pdf,
				contentType: "application/pdf",
			});
		});
	}
});
