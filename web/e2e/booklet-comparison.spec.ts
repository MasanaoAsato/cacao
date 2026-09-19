import { writeFile } from "node:fs/promises";
import { expect, type TestInfo, test } from "@playwright/test";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { THEME_CATALOG_REFERENCES } from "../src/theme/bookletTheme.js";
import { MOODS } from "../src/theme/catalog.js";
import { resolveTheme } from "../src/theme/resolve.js";
import { resolveBookletDesign } from "../src/theme/families/resolveBookletDesign.js";
import { REGISTERED_BOOKLET_FAMILY_IDS } from "../src/theme/families/registry.js";
import type { MoodId } from "../src/theme/types.js";
import {
	COMPARISON_EXPECTED_UNITS,
	comparisonCoverDataUrl,
	comparisonIllustrationDataUrl,
	comparisonJourneyId,
	type ComparisonFixtureScenario,
	routeComparisonBookletApi,
} from "./fixtures/booklet-comparison.js";
import { DENSE_BOOKLET_EXPECTED_UNITS } from "./fixtures/booklet.js";
import { MOOD_SAMPLE_SEEDS } from "./fixtures/booklet-theme-samples.js";
import {
	expectBookletPrintReady,
	expectContentInsidePages,
	expectNoHiddenText,
	expectSelectedCandidate,
	seedToken,
} from "./support/booklet-assertions.js";

type ExpectedUnit = {
	readonly id: string;
	readonly name: string;
	readonly startAt: string;
};

type ComparisonRecord = {
	readonly comparisonKey: string | null;
	readonly documentHtml: string;
	readonly familyId: string | null;
	readonly moodId: MoodId;
	readonly pageCompositions: readonly (string | null)[];
	readonly pageCount: number;
	readonly pageIds: readonly string[];
	readonly requestedDesign: string | null;
	readonly scenario: ComparisonFixtureScenario;
	readonly seed: number;
	readonly themeKey: string | null;
	readonly unitIds: readonly string[];
};

const moodSamples = Object.entries(MOOD_SAMPLE_SEEDS) as ReadonlyArray<
	readonly [MoodId, (typeof MOOD_SAMPLE_SEEDS)[MoodId]]
>;

function expectedDesignFor(moodId: MoodId, seed: number) {
	const requestedTheme = resolveTheme(
		{ value: seed, version: "v2" },
		{ coverVisualStyle: null },
		MOODS,
		THEME_CATALOG_REFERENCES,
	);
	const design = resolveBookletDesign(requestedTheme);
	const sample = MOOD_SAMPLE_SEEDS[moodId];
	expect(design.familyId).toBe(sample.familyId);
	expect(design.policyId).toBe(sample.policyId);
	return design;
}

function expectRegisteredFamiliesCovered(): void {
	expect(
		new Set(Object.values(MOOD_SAMPLE_SEEDS).map((sample) => sample.familyId)),
	).toEqual(new Set(REGISTERED_BOOKLET_FAMILY_IDS));
}

async function openBooklet(
	page: Parameters<typeof routeComparisonBookletApi>[0],
	seed: number,
	scenario: ComparisonFixtureScenario = "standard",
): Promise<void> {
	await page.goto(
		`/journeys/${comparisonJourneyId(scenario)}/booklet?seed=${seedToken(seed)}`,
	);
	await expectBookletPrintReady(page);
	await expectSelectedCandidate(page);
}

async function expectUnits(
	page: Parameters<typeof routeComparisonBookletApi>[0],
	expected: readonly ExpectedUnit[] = COMPARISON_EXPECTED_UNITS,
): Promise<readonly string[]> {
	const units = await page
		.locator(".booklet-document [data-unit-id]")
		.evaluateAll((elements) =>
			elements.map((element) => ({
				id: element.getAttribute("data-unit-id"),
				name:
					element
						.querySelector('[data-booklet-text-role="spot-name"]')
						?.textContent?.trim() ?? "",
				startAt: element.querySelector("time")?.getAttribute("dateTime") ?? "",
			})),
		);
	expect(units).toHaveLength(expected.length);
	expect(units.map((unit) => unit.id)).toEqual(expected.map((unit) => unit.id));
	expect(units.map((unit) => unit.name)).toEqual(
		expected.map((unit) => unit.name),
	);
	expect(units.map((unit) => unit.startAt)).toEqual(
		expected.map((unit) => unit.startAt),
	);
	if (expected === COMPARISON_EXPECTED_UNITS) {
		await expect(
			page.locator(
				'.booklet-document [data-unit-id="comparison-leg-4:comparison-spot-4"] .booklet-unit__description, .booklet-document [data-unit-id="comparison-leg-4:comparison-spot-4"] [data-booklet-text-role="unit-description"]',
			),
		).toHaveCount(0);
	}
	return units.map((unit) => unit.id ?? "");
}

async function captureRecord(
	page: Parameters<typeof routeComparisonBookletApi>[0],
	moodId: MoodId,
	seed: number,
	unitIds: readonly string[],
	scenario: ComparisonFixtureScenario = "standard",
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
	const metadata = await document.evaluate(
		(element, dataUrls) => {
			const copy = element.cloneNode(true) as HTMLElement;
			for (const image of copy.querySelectorAll(
				'img[src*="/journey-images/"], image[href*="/journey-images/"]',
			)) {
				const attribute = image.localName === "image" ? "href" : "src";
				image.setAttribute(
					attribute,
					image.getAttribute(attribute)?.includes("illustration")
						? dataUrls.illustration
						: dataUrls.cover,
				);
			}
			const pages = Array.from(element.querySelectorAll("[data-booklet-page]"));
			return {
				comparisonKey:
					element
						.closest(".booklet-shell")
						?.getAttribute("data-booklet-comparison-key") ?? null,
				documentHtml: copy.outerHTML,
				familyId: element.getAttribute("data-booklet-family"),
				pageCompositions: pages.map((item) =>
					item.getAttribute("data-booklet-composition"),
				),
				pageCount: pages.length,
				pageIds: pages.map((item) => item.getAttribute("data-page-id") ?? ""),
				requestedDesign: element.getAttribute("data-booklet-design"),
				themeKey: element.getAttribute("data-booklet-theme-key"),
			};
		},
		{
			cover: comparisonCoverDataUrl,
			illustration: comparisonIllustrationDataUrl,
		},
	);
	expect(metadata.documentHtml).toContain(comparisonCoverDataUrl);
	expect(metadata.documentHtml).not.toContain("/journey-images/");
	expect(metadata.familyId).not.toBeNull();
	expect(metadata.requestedDesign).not.toBeNull();
	expect(metadata.themeKey).not.toBeNull();
	expect(metadata.comparisonKey).not.toBeNull();
	return { ...metadata, moodId, scenario, seed, unitIds };
}

function expectRecordMatchesDesign(
	record: ComparisonRecord,
	design: ReturnType<typeof resolveBookletDesign>,
): void {
	expect(record.familyId).toBe(design.familyId);
	expect(record.comparisonKey).toBe(design.comparisonKey);
	expect(record.requestedDesign).toBe(design.requestedTheme.recipe.id);
	expect(record.themeKey).toBe(design.renderKey);
}

async function attachArtifacts(
	page: Parameters<typeof routeComparisonBookletApi>[0],
	testInfo: TestInfo,
	records: readonly ComparisonRecord[],
): Promise<void> {
	const head = await page.locator("head").innerHTML();
	const html = `<!doctype html><html lang="ja"><head>${head}</head><body><main>${records
		.map(
			(record) =>
				`<section data-comparison-mood="${record.moodId}"><h1>${record.scenario}: ${record.familyId} / ${record.requestedDesign} / ${record.seed}</h1>${record.documentHtml}</section>`,
		)
		.join("\n")}</main></body></html>`;
	const json = JSON.stringify(
		records.map(({ documentHtml: _documentHtml, ...record }) => record),
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
	test("全雰囲気を同じ12件・画像条件で比較記録に保存する", async ({
		page,
	}, testInfo) => {
		test.setTimeout(300_000);
		await routeComparisonBookletApi(page);
		expectRegisteredFamiliesCovered();
		const records: ComparisonRecord[] = [];
		for (const [moodId, { seed }] of moodSamples) {
			const design = expectedDesignFor(moodId, seed);
			await openBooklet(page, seed);
			await expectNoHiddenText(page);
			await expectContentInsidePages(page);
			const record = await captureRecord(
				page,
				moodId,
				seed,
				await expectUnits(page),
			);
			expectRecordMatchesDesign(record, design);
			records.push(record);
			const screenshot = testInfo.outputPath(`${moodId}-${seed}.png`);
			await page.screenshot({ fullPage: true, path: screenshot });
			await testInfo.attach("comparison.png", {
				contentType: "image/png",
				path: screenshot,
			});
		}
		await attachArtifacts(page, testInfo, records);
	});

	test("同じ seed は再読込後も family・作風・比較キー・ページ計画を変えない", async ({
		page,
	}, testInfo) => {
		test.setTimeout(300_000);
		await routeComparisonBookletApi(page);
		const records: ComparisonRecord[] = [];
		for (const [moodId, { seed }] of moodSamples) {
			await openBooklet(page, seed);
			const first = await captureRecord(
				page,
				moodId,
				seed,
				await expectUnits(page),
			);
			await openBooklet(page, seed);
			const reloaded = await captureRecord(
				page,
				moodId,
				seed,
				await expectUnits(page),
			);
			expect(reloaded).toMatchObject({
				comparisonKey: first.comparisonKey,
				familyId: first.familyId,
				pageCompositions: first.pageCompositions,
				pageCount: first.pageCount,
				pageIds: first.pageIds,
				requestedDesign: first.requestedDesign,
				themeKey: first.themeKey,
				unitIds: first.unitIds,
			});
			records.push(first);
		}
		await attachArtifacts(page, testInfo, records);
	});

	test("dense の16件を全雰囲気で継続ページまで入力順に保持する", async ({
		page,
	}, testInfo) => {
		test.setTimeout(300_000);
		await routeComparisonBookletApi(page, "dense");
		const records: ComparisonRecord[] = [];
		for (const [moodId, { seed }] of moodSamples) {
			await openBooklet(page, seed, "dense");
			const record = await captureRecord(
				page,
				moodId,
				seed,
				await expectUnits(page, DENSE_BOOKLET_EXPECTED_UNITS),
				"dense",
			);
			expect(record.pageCount).toBeGreaterThan(2);
			records.push(record);
		}
		await attachArtifacts(page, testInfo, records);
	});

	test("空日と days: [] を同じ比較条件で検証する", async ({
		page,
	}, testInfo) => {
		test.setTimeout(300_000);
		const records: ComparisonRecord[] = [];
		for (const scenario of ["empty-day", "no-days"] as const) {
			await routeComparisonBookletApi(page, scenario);
			for (const [moodId, { seed }] of moodSamples) {
				await openBooklet(page, seed, scenario);
				const expected =
					scenario === "empty-day" ? COMPARISON_EXPECTED_UNITS : [];
				const record = await captureRecord(
					page,
					moodId,
					seed,
					await expectUnits(page, expected),
					scenario,
				);
				if (scenario === "empty-day") {
					expect(
						await page
							.locator('.booklet-document [data-day-id="comparison-empty-day"]')
							.count(),
					).toBeGreaterThan(0);
					expect(record.pageCount).toBeGreaterThan(1);
				} else {
					expect(record.pageCount).toBe(1);
				}
				records.push(record);
			}
		}
		await attachArtifacts(page, testInfo, records);
	});

	test("全雰囲気を A5 PDF として DOM と同じ物理ページ数で出力する", async ({
		page,
	}, testInfo) => {
		test.setTimeout(300_000);
		await routeComparisonBookletApi(page);
		const records: ComparisonRecord[] = [];
		for (const [moodId, { seed }] of moodSamples) {
			await openBooklet(page, seed);
			const unitIds = await expectUnits(page);
			const count = await page
				.locator(".booklet-document [data-booklet-page]")
				.count();
			await page.emulateMedia({ media: "print" });
			const pdf = await page.pdf({
				preferCSSPageSize: true,
				printBackground: true,
			});
			const pdfDocument = await getDocument({ data: new Uint8Array(pdf) })
				.promise;
			expect(pdfDocument.numPages).toBe(count);
			for (let number = 1; number <= pdfDocument.numPages; number += 1) {
				const pdfPage = await pdfDocument.getPage(number);
				const [left, bottom, right, top] = pdfPage.view;
				expect(Math.abs(right - left - 419.53)).toBeLessThan(1);
				expect(Math.abs(top - bottom - 595.28)).toBeLessThan(1);
			}
			await pdfDocument.destroy();
			records.push(await captureRecord(page, moodId, seed, unitIds));
		}
		await attachArtifacts(page, testInfo, records);
	});
});
