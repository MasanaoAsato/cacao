import { expect, type Page, test } from "@playwright/test";
import {
	type PlayfulRouteCompositionId,
	type PlayfulRoutePaletteId,
	playfulRouteCompositionFor,
} from "../src/theme/families/playfulRoute.js";
import {
	bookletFixtureJourneyId,
	routeBookletApi,
} from "./fixtures/booklet.js";
import {
	expectBookletPrintReady,
	expectContentInsidePages,
	expectNoHiddenText,
	seedToken,
} from "./support/booklet-assertions.js";

type PlayfulRouteSample = {
	readonly compositionId: PlayfulRouteCompositionId;
	readonly paletteId: PlayfulRoutePaletteId;
	readonly seed: number;
};

// 20.1 の比較基盤と同様、実装時に探索した値を固定して選択規則の退行を検出する。
const samples: readonly PlayfulRouteSample[] = [
	{ compositionId: "zigzag", paletteId: "berry-sun", seed: 15 },
	{ compositionId: "ribbon", paletteId: "berry-sun", seed: 2 },
	{ compositionId: "zigzag", paletteId: "harbor-play", seed: 20 },
	{ compositionId: "ribbon", paletteId: "harbor-play", seed: 21 },
];

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

test.describe("playful-route", () => {
	for (const sample of samples) {
		test(`${sample.paletteId}・${sample.compositionId}で図解の旅程を描く`, async ({
			page,
		}) => {
			await openPlayfulRoute(page, sample.seed);
			await expectNoHiddenText(page);
			await expectContentInsidePages(page);
			await expect(page.locator(".booklet-document")).toHaveAttribute(
				"data-booklet-theme-key",
				new RegExp(
					`^playful-route:.*:route:playful-route\\.${sample.paletteId}\\.${sample.compositionId}$`,
				),
			);
			await expect(
				page.locator(".booklet-document .playful-route-block"),
			).toHaveCount(2);
			const composition = playfulRouteCompositionFor(sample.compositionId);
			const coverImage = await pageRelativeMm(
				page,
				".booklet-document .playful-route-cover__image",
			);
			expect(coverImage).toEqual(
				expect.objectContaining({
					height: expect.closeTo(composition.coverImage.heightMm, 1),
					width: expect.closeTo(composition.coverImage.widthMm, 1),
					x: expect.closeTo(composition.coverImage.xMm, 1),
					y: expect.closeTo(composition.coverImage.yMm, 1),
				}),
			);
			await expect(
				page.locator(
					'.booklet-document .playful-route-page--cover [data-booklet-decor-asset="playful-sun"]',
				),
			).toHaveCount(1);
			await expect(
				page.locator(
					'.booklet-document .playful-route-page--day [data-booklet-decor-asset="playful-squiggle"]',
				),
			).toHaveCount(2);
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
				".booklet-document .playful-route-day-header__image img",
			);
			await expect(dayImages).toHaveCount(2);
			await expect(dayImages.nth(1)).toHaveJSProperty("naturalWidth", 1200);
		});

		test(`${sample.paletteId}・${sample.compositionId}で16件を継続ページへ送る`, async ({
			page,
		}) => {
			await openPlayfulRoute(page, sample.seed, "dense");
			await expectNoHiddenText(page);
			await expectContentInsidePages(page);
			const dayPages = page.locator(
				".booklet-document .playful-route-page--day",
			);
			expect(await dayPages.count()).toBeGreaterThan(1);
			await expect(dayPages.nth(1)).toContainText("続き");
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
});
