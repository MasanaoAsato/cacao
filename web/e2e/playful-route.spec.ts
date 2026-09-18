import {
	expect,
	type Locator,
	type Page,
	type TestInfo,
	test,
} from "@playwright/test";
import {
	PLAYFUL_ROUTE_PALETTES,
	type PlayfulRouteCompositionId,
	type PlayfulRouteDecorVariantId,
	playfulRouteCompositionFor,
} from "../src/theme/families/playfulRoute.js";
import {
	bookletFixtureJourneyId,
	routeBookletApi,
} from "./fixtures/booklet.js";
import {
	PLAYFUL_ROUTE_SAMPLES,
	PLAYFUL_ROUTE_VARIANT_PAIR_SEEDS,
} from "./fixtures/playful-route-samples.js";
import {
	expectBookletPrintReady,
	expectContentInsidePages,
	expectNoHiddenText,
	seedToken,
} from "./support/booklet-assertions.js";

/**
 * The reserved decor regions of 20.9, restated here so the spec compares the
 * drawn bounds with an expectation of its own. Values are `x, y, width, height`
 * in mm from the page's top-left corner.
 */
const COVER_ANCHORS: Readonly<
	Record<PlayfulRouteCompositionId, Readonly<Record<string, readonly number[]>>>
> = {
	ribbon: {
		"playful-cover-bag": [50, 154, 18, 24],
		"playful-cover-burst": [10, 70, 24, 12],
		"playful-cover-sun": [18, 150, 24, 24],
	},
	zigzag: {
		"playful-cover-bag": [10, 148, 18, 24],
		"playful-cover-burst": [10, 68, 24, 12],
		"playful-cover-sun": [116, 10, 20, 20],
	},
};

const DAY_ANCHOR = [62, 194, 24, 8] as const;

/** What each decor variant is expected to draw in those regions (20.11). */
const EXPECTED_DECOR: Readonly<
	Record<
		PlayfulRouteDecorVariantId,
		{
			readonly bagAssetId: string;
			readonly burstAssetId: string;
			readonly burstHeightMm: number;
			readonly burstOffsetYMm: number;
			readonly dayAssetId: string;
		}
	>
> = {
	sunny: {
		bagAssetId: "playful-bag",
		burstAssetId: "playful-burst",
		burstHeightMm: 12,
		burstOffsetYMm: 0,
		dayAssetId: "playful-squiggle",
	},
	walking: {
		bagAssetId: "playful-footprints",
		burstAssetId: "playful-curved-arrow",
		burstHeightMm: 8,
		burstOffsetYMm: 2,
		dayAssetId: "playful-curved-arrow",
	},
};

const COVER = ".booklet-document .playful-route-page--cover";
const DAY = ".booklet-document .playful-route-page--day";

function rgbOf(hex: string): string {
	const value = Number.parseInt(hex.slice(1), 16);
	return `rgb(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255})`;
}

function anchorSelector(scope: string, anchorId: string): string {
	return `${scope} [data-booklet-decor-anchor="${anchorId}"]`;
}

async function decorBoundsMm(
	page: Page,
	selector: string,
): Promise<readonly number[]> {
	const value = await page
		.locator(selector)
		.first()
		.getAttribute("data-booklet-decor-bounds");
	return (value ?? "").split(",").map(Number);
}

/** Palette colour the mask rect actually resolves to in the browser. */
async function decorFill(page: Page, selector: string): Promise<string> {
	return page
		.locator(`${selector} rect[mask]`)
		.first()
		.evaluate((element) => getComputedStyle(element).fill);
}

async function attachPng(
	testInfo: TestInfo,
	locator: Locator,
	name: string,
): Promise<void> {
	await testInfo.attach(name, {
		body: await locator.screenshot({ animations: "disabled", caret: "hide" }),
		contentType: "image/png",
	});
}

async function openPlayfulRoute(
	page: Page,
	seed: number,
	scenario: "default" | "dense" = "default",
): Promise<void> {
	await routeBookletApi(page, scenario, "artwork");
	await page.goto(
		`/journeys/${bookletFixtureJourneyId(scenario)}/booklet?seed=${seedToken(seed)}`,
	);
	await expectBookletPrintReady(page);
	await expect(page.locator(".booklet-document")).toHaveAttribute(
		"data-booklet-family",
		"playful-route",
	);
}

async function pageRelativeMm(
	page: Page,
	selector: string,
): Promise<{ height: number; width: number; x: number; y: number }> {
	return page
		.locator(selector)
		.first()
		.evaluate((element) => {
			const pageElement = element.closest<HTMLElement>("[data-booklet-page]");
			if (!pageElement) {
				throw new Error("要素を含む紙面がありません。");
			}
			const pageRect = pageElement.getBoundingClientRect();
			const rect = element.getBoundingClientRect();
			const scale = 148 / pageRect.width;
			return {
				height: rect.height * scale,
				width: rect.width * scale,
				x: (rect.left - pageRect.left) * scale,
				y: (rect.top - pageRect.top) * scale,
			};
		});
}

/**
 * Keeps the content geometry observable independently from the decorative SVGs.
 * The variant pair must preserve every day-page text rectangle (20.11).
 */
async function dayTextRectanglesMm(page: Page): Promise<
	readonly {
		readonly bounds: { height: number; width: number; x: number; y: number };
		readonly pageId: string | null;
		readonly role: string | null;
		readonly text: string;
	}[]
> {
	return page
		.locator(`${DAY} [data-booklet-text-role]`)
		.evaluateAll((elements) =>
			elements.map((element) => {
				const pageElement = element.closest<HTMLElement>("[data-booklet-page]");
				if (!pageElement) {
					throw new Error("本文テキストを含む紙面がありません。");
				}
				const pageRect = pageElement.getBoundingClientRect();
				const rect = element.getBoundingClientRect();
				const scale = 148 / pageRect.width;
				return {
					bounds: {
						height: rect.height * scale,
						width: rect.width * scale,
						x: (rect.left - pageRect.left) * scale,
						y: (rect.top - pageRect.top) * scale,
					},
					pageId: pageElement.getAttribute("data-page-id"),
					role: element.getAttribute("data-booklet-text-role"),
					text: element.textContent?.trim() ?? "",
				};
			}),
		);
}

test.describe("playful-route", () => {
	for (const sample of PLAYFUL_ROUTE_SAMPLES) {
		const sampleName = `${sample.paletteId}・${sample.compositionId}・${sample.decorVariantId}`;

		test(`${sampleName}で図解の旅程を描く`, async ({ page }, testInfo) => {
			await openPlayfulRoute(page, sample.seed);
			await expectNoHiddenText(page);
			await expectContentInsidePages(page);
			await expect(page.locator(".booklet-document")).toHaveAttribute(
				"data-booklet-theme-key",
				new RegExp(
					`^playful-route:.*:route:playful-route\\.${sample.paletteId}\\.${sample.compositionId}\\.${sample.decorVariantId}$`,
				),
			);
			await expect(page.locator(".booklet-document")).toHaveAttribute(
				"data-booklet-decor-variant",
				sample.decorVariantId,
			);
			await expect(page.locator(`${DAY} .playful-route-block`)).toHaveCount(2);
			const composition = playfulRouteCompositionFor(sample.compositionId);
			const coverImage = await pageRelativeMm(
				page,
				`${COVER} .playful-route-cover__image`,
			);
			expect(coverImage).toEqual(
				expect.objectContaining({
					height: expect.closeTo(composition.coverImage.heightMm, 1),
					width: expect.closeTo(composition.coverImage.widthMm, 1),
					x: expect.closeTo(composition.coverImage.xMm, 1),
					y: expect.closeTo(composition.coverImage.yMm, 1),
				}),
			);

			const palette = PLAYFUL_ROUTE_PALETTES[sample.paletteId];
			const expected = EXPECTED_DECOR[sample.decorVariantId];
			const anchors = COVER_ANCHORS[sample.compositionId];
			await expect(
				page.locator(`${COVER} [data-booklet-decor-asset]`),
			).toHaveCount(3);
			const sun = anchorSelector(COVER, "playful-cover-sun");
			await expect(page.locator(sun)).toHaveAttribute(
				"data-booklet-decor-asset",
				"playful-sun",
			);
			expect(await decorBoundsMm(page, sun)).toEqual(
				anchors["playful-cover-sun"],
			);
			expect(await decorFill(page, sun)).toBe(rgbOf(palette.soft));

			const bag = anchorSelector(COVER, "playful-cover-bag");
			await expect(page.locator(bag)).toHaveAttribute(
				"data-booklet-decor-asset",
				expected.bagAssetId,
			);
			expect(await decorBoundsMm(page, bag)).toEqual(
				anchors["playful-cover-bag"],
			);
			expect(await decorFill(page, bag)).toBe(rgbOf(palette.accent));

			const burst = anchorSelector(COVER, "playful-cover-burst");
			const burstAnchor = anchors["playful-cover-burst"] ?? [];
			await expect(page.locator(burst)).toHaveAttribute(
				"data-booklet-decor-asset",
				expected.burstAssetId,
			);
			expect(await decorBoundsMm(page, burst)).toEqual([
				burstAnchor[0],
				(burstAnchor[1] ?? 0) + expected.burstOffsetYMm,
				burstAnchor[2],
				expected.burstHeightMm,
			]);
			expect(await decorFill(page, burst)).toBe(rgbOf(palette.secondary));

			const daySquiggle = anchorSelector(DAY, "playful-day-squiggle");
			await expect(
				page.locator(
					`${DAY} [data-booklet-decor-asset="${expected.dayAssetId}"]`,
				),
			).toHaveCount(2);
			await expect(page.locator(daySquiggle).first()).toHaveAttribute(
				"data-booklet-decor-asset",
				expected.dayAssetId,
			);
			expect(await decorBoundsMm(page, daySquiggle)).toEqual([...DAY_ANCHOR]);
			expect(await decorFill(page, daySquiggle)).toBe(rgbOf(palette.accent));

			await expect(
				page.locator(
					'.booklet-document [data-booklet-text-role="unit-transport"]',
				),
			).toHaveCount(2);
			await expect(
				page.locator(
					'.booklet-document [data-booklet-text-role="unit-description"]',
				),
			).toHaveCount(0);
			const dayImages = page.locator(
				`${DAY} .playful-route-day-header__image img`,
			);
			await expect(dayImages).toHaveCount(2);
			await expect(dayImages.nth(1)).toHaveJSProperty("naturalWidth", 1200);

			await attachPng(testInfo, page.locator(COVER), `${sampleName}-cover.png`);
			await attachPng(
				testInfo,
				page.locator(DAY).first(),
				`${sampleName}-day.png`,
			);

			// The same URL and build has to reach the same variant again.
			await page.reload();
			await expectBookletPrintReady(page);
			await expect(page.locator(".booklet-document")).toHaveAttribute(
				"data-booklet-decor-variant",
				sample.decorVariantId,
			);
		});

		test(`${sampleName}で16件を継続ページへ送る`, async ({ page }) => {
			await openPlayfulRoute(page, sample.seed, "dense");
			await expectNoHiddenText(page);
			await expectContentInsidePages(page);
			const dayPages = page.locator(DAY);
			expect(await dayPages.count()).toBeGreaterThan(1);
			await expect(dayPages.nth(1)).toContainText("続き");
			await expect(
				dayPages
					.nth(1)
					.locator(
						`[data-booklet-decor-asset="${EXPECTED_DECOR[sample.decorVariantId].dayAssetId}"]`,
					),
			).toHaveCount(1);
			const blocks = page.locator(".booklet-document .playful-route-block");
			await expect(blocks).toHaveCount(16);
			const renderedBlocks = await blocks.evaluateAll((elements) =>
				elements.map((element) => ({
					id: element.getAttribute("data-unit-id"),
					number: element
						.querySelector(".playful-route-block__number")
						?.textContent?.trim(),
					right: element.classList.contains("playful-route-block--right"),
				})),
			);
			expect(renderedBlocks).toEqual(
				Array.from({ length: 16 }, (_value, index) => ({
					id: `dense-leg-${index + 1}:dense-spot-${index + 1}`,
					number: String(index + 1).padStart(2, "0"),
					right: (index + 1) % 2 === 0,
				})),
			);
			expect(
				await page
					.locator(".booklet-document [data-booklet-decor-connector]")
					.count(),
			).toBeGreaterThan(0);
		});
	}

	test("berry-sun・zigzagの両パターンを同縮尺の継続ページで比べる", async ({
		page,
	}, testInfo) => {
		const pageCounts: number[] = [];
		const textRectangles: Awaited<ReturnType<typeof dayTextRectanglesMm>>[] =
			[];
		const unitIds: string[][] = [];
		for (const [decorVariantId, seed] of Object.entries(
			PLAYFUL_ROUTE_VARIANT_PAIR_SEEDS,
		)) {
			await openPlayfulRoute(page, seed, "dense");
			await expect(page.locator(".booklet-document")).toHaveAttribute(
				"data-booklet-decor-variant",
				decorVariantId,
			);
			const continuation = page.locator(DAY).nth(1);
			await expect(continuation).toContainText("続き");
			await attachPng(
				testInfo,
				continuation,
				`pair-${decorVariantId}-continuation.png`,
			);
			pageCounts.push(
				await page.locator(".booklet-document [data-booklet-page]").count(),
			);
			unitIds.push(
				await page
					.locator(".booklet-document .playful-route-block")
					.evaluateAll((elements) =>
						elements.map(
							(element) => element.getAttribute("data-unit-id") ?? "",
						),
					),
			);
			textRectangles.push(await dayTextRectanglesMm(page));
			await page.emulateMedia({ media: "print" });
			const pdf = await page.pdf({
				preferCSSPageSize: true,
				printBackground: true,
			});
			expect(pdf.byteLength).toBeGreaterThan(1000);
			await testInfo.attach(`pair-${decorVariantId}.pdf`, {
				body: pdf,
				contentType: "application/pdf",
			});
			await page.emulateMedia({ media: "screen" });
		}
		// Decor alone must not move the body: same pages, units and text geometry.
		expect(pageCounts[0]).toBe(pageCounts[1]);
		expect(unitIds[0]).toEqual(unitIds[1]);
		expect(textRectangles[0]).toEqual(textRectangles[1]);
	});
});
