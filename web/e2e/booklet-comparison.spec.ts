import { writeFile } from "node:fs/promises";
import { expect, test, type TestInfo } from "@playwright/test";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { MOODS } from "../src/theme/catalog.js";
import { THEME_CATALOG_REFERENCES } from "../src/theme/bookletTheme.js";
import { resolveTheme } from "../src/theme/resolve.js";
import type { MoodId } from "../src/theme/types.js";
import {
	COMPARISON_EXPECTED_UNITS,
	comparisonSvgDataUrl,
	routeComparisonBookletApi,
} from "./fixtures/booklet-comparison.js";
import { MOOD_SAMPLE_SEEDS } from "./fixtures/booklet-theme-samples.js";
import {
	expectBookletPrintReady,
	expectContentInsidePages,
	expectNoHiddenText,
	seedToken,
} from "./support/booklet-assertions.js";

type ComparisonRecord = {
	readonly documentHtml: string;
	readonly fallbackLog: string | null;
	readonly moodId: MoodId;
	readonly pageCompositions: readonly (string | null)[];
	readonly pageIds: readonly string[];
	readonly requestedDesign: string | null;
	readonly seed: number;
	readonly themeKey: string | null;
	readonly unitIds: readonly string[];
};

const moodSamples = Object.entries(MOOD_SAMPLE_SEEDS) as ReadonlyArray<
	readonly [MoodId, (typeof MOOD_SAMPLE_SEEDS)[MoodId]]
>;

function requestedDesignFor(seed: number): string {
	return resolveTheme(
		{ value: seed, version: "v2" },
		{ coverVisualStyle: null },
		MOODS,
		THEME_CATALOG_REFERENCES,
	).recipe.id;
}

async function openComparisonBooklet(
	page: Parameters<typeof routeComparisonBookletApi>[0],
	seed: number,
): Promise<void> {
	await page.goto(
		`/journeys/journey-comparison/booklet?seed=${seedToken(seed)}`,
	);
	await expectBookletPrintReady(page);
}

async function expectComparisonUnits(
	page: Parameters<typeof routeComparisonBookletApi>[0],
): Promise<readonly string[]> {
	const units = await page
		.locator(".booklet-document .booklet-unit")
		.evaluateAll((elements) =>
			elements.map((element) => {
				const time = element.querySelector("time");
				const name = element.querySelector("h3");
				return {
					id: element.getAttribute("data-unit-id"),
					name: name?.textContent?.trim() ?? "",
					startAt: time?.getAttribute("dateTime"),
				};
			}),
		);
	expect(units).toHaveLength(COMPARISON_EXPECTED_UNITS.length);
	expect(units.map((unit) => unit.id)).toEqual(
		COMPARISON_EXPECTED_UNITS.map((unit) => unit.id),
	);
	expect(units.map((unit) => unit.name)).toEqual(
		COMPARISON_EXPECTED_UNITS.map((unit) => unit.name),
	);
	expect(units.map((unit) => unit.startAt)).toEqual(
		COMPARISON_EXPECTED_UNITS.map((unit) => unit.startAt),
	);
	await expect(
		page.locator(
			'.booklet-document [data-unit-id="comparison-leg-4:comparison-spot-4"] .booklet-unit__description',
		),
	).toHaveText("");
	return units.map((unit) => unit.id ?? "");
}

async function captureComparisonRecord(
	page: Parameters<typeof routeComparisonBookletApi>[0],
	moodId: MoodId,
	seed: number,
	unitIds: readonly string[],
): Promise<ComparisonRecord> {
	const document = page.locator(".booklet-document");
	await expect(document.locator(".booklet-cover__image")).toHaveJSProperty(
		"naturalWidth",
		800,
	);
	await expect(document.locator(".booklet-cover__image")).toHaveJSProperty(
		"naturalHeight",
		1200,
	);
	const metadata = await document.evaluate((element, imageDataUrl) => {
		const artifactDocument = element.cloneNode(true) as HTMLElement;
		for (const image of artifactDocument.querySelectorAll(
			'img[src*="/journey-images/"], image[href*="/journey-images/"]',
		)) {
			image.setAttribute(
				image.localName === "image" ? "href" : "src",
				imageDataUrl,
			);
		}
		return {
			documentHtml: artifactDocument.outerHTML,
			fallbackLog:
				element
					.closest(".booklet-shell")
					?.getAttribute("data-booklet-fallback-log") ?? null,
			pageCompositions: Array.from(
				element.querySelectorAll("[data-booklet-page]"),
				(pageElement) => pageElement.getAttribute("data-booklet-composition"),
			),
			pageIds: Array.from(
				element.querySelectorAll("[data-booklet-page]"),
				(pageElement) => pageElement.getAttribute("data-page-id") ?? "",
			),
			requestedDesign: element.getAttribute("data-booklet-design"),
			themeKey: element.getAttribute("data-booklet-theme-key"),
		};
	}, comparisonSvgDataUrl);
	expect(metadata.documentHtml).toContain(comparisonSvgDataUrl);
	expect(metadata.documentHtml).not.toContain("/journey-images/");
	return {
		...metadata,
		moodId,
		seed,
		unitIds,
	};
}

async function attachComparisonArtifacts(
	page: Parameters<typeof routeComparisonBookletApi>[0],
	testInfo: TestInfo,
	records: readonly ComparisonRecord[],
): Promise<void> {
	const head = await page.locator("head").innerHTML();
	const html = `<!doctype html>
<html lang="ja">
<head>${head}</head>
<body>
<main>
${records
	.map(
		(record) => `<section data-comparison-mood="${record.moodId}">
<h1>${record.moodId} / seed ${record.seed}</h1>
${record.documentHtml}
</section>`,
	)
	.join("\n")}
</main>
</body>
</html>`;
	const json = JSON.stringify(
		records.map(({ documentHtml: _, ...record }) => record),
		null,
		2,
	);
	const htmlPath = testInfo.outputPath("comparison.html");
	const jsonPath = testInfo.outputPath("comparison.json");
	await Promise.all([writeFile(htmlPath, html), writeFile(jsonPath, json)]);
	await Promise.all([
		testInfo.attach("comparison.html", {
			contentType: "text/html",
			path: htmlPath,
		}),
		testInfo.attach("comparison.json", {
			contentType: "application/json",
			path: jsonPath,
		}),
	]);
}

test.describe("しおり比較基盤", () => {
	test("全雰囲気で文字と本文が紙面内に収まる", async ({ page }, testInfo) => {
		test.setTimeout(300_000);
		await routeComparisonBookletApi(page);
		const records: ComparisonRecord[] = [];

		for (const [moodId, { seed }] of moodSamples) {
			expect(requestedDesignFor(seed)).toMatch(new RegExp(`^${moodId}\\.`));
			await openComparisonBooklet(page, seed);
			await expectNoHiddenText(page);
			await expectContentInsidePages(page);
			const unitIds = await expectComparisonUnits(page);
			records.push(await captureComparisonRecord(page, moodId, seed, unitIds));
		}

		await attachComparisonArtifacts(page, testInfo, records);
	});

	test("全雰囲気で12件の掲載単位を日程順に表示する", async ({
		page,
	}, testInfo) => {
		test.setTimeout(300_000);
		await routeComparisonBookletApi(page);
		const records: ComparisonRecord[] = [];

		for (const [moodId, { seed }] of moodSamples) {
			await openComparisonBooklet(page, seed);
			const unitIds = await expectComparisonUnits(page);
			records.push(await captureComparisonRecord(page, moodId, seed, unitIds));
		}

		await attachComparisonArtifacts(page, testInfo, records);
	});

	test("全雰囲気をA5 PDFとして同じ物理ページ数で出力する", async ({
		page,
	}, testInfo) => {
		test.setTimeout(300_000);
		await routeComparisonBookletApi(page);
		const records: ComparisonRecord[] = [];

		for (const [moodId, { seed }] of moodSamples) {
			await openComparisonBooklet(page, seed);
			const unitIds = await expectComparisonUnits(page);
			const documentPageCount = await page
				.locator(".booklet-document [data-booklet-page]")
				.count();
			await page.emulateMedia({ media: "print" });
			const pdf = await page.pdf({
				preferCSSPageSize: true,
				printBackground: true,
			});
			expect(pdf.byteLength).toBeGreaterThan(1000);
			const pdfDocument = await getDocument({ data: new Uint8Array(pdf) })
				.promise;
			expect(pdfDocument.numPages).toBe(documentPageCount);
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
			await pdfDocument.destroy();
			records.push(await captureComparisonRecord(page, moodId, seed, unitIds));
		}

		await attachComparisonArtifacts(page, testInfo, records);
	});
});
