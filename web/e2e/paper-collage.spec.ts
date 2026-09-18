import { expect, type Page, test } from "@playwright/test";
import { createBookletTheme } from "../src/theme/bookletTheme.js";
import { resolveBookletDesign } from "../src/theme/families/resolveBookletDesign.js";
import {
	paperCollageCompositionFor,
	type PaperCollageCompositionId,
	type PaperCollagePaletteId,
} from "../src/theme/families/paperCollage.js";
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

type PaperCollageSample = {
	readonly compositionId: PaperCollageCompositionId;
	readonly paletteId: PaperCollagePaletteId;
	readonly seed: number;
};

const expectedPairs = [
	["sage-paper", "photo-left"],
	["sage-paper", "photo-right"],
	["lilac-paper", "photo-left"],
	["lilac-paper", "photo-right"],
] as const;

function findPaperCollageSamples(): readonly PaperCollageSample[] {
	const samples = new Map<string, PaperCollageSample>();
	for (let seed = 0; seed < 200_000 && samples.size < 4; seed += 1) {
		const design = resolveBookletDesign(
			createBookletTheme({ value: seed, version: "v2" }),
		);
		if (design.familyId !== "paper-collage") {
			continue;
		}
		const key = `${design.paletteId}.${design.compositionId}`;
		if (!samples.has(key)) {
			samples.set(key, {
				compositionId: design.compositionId as PaperCollageCompositionId,
				paletteId: design.paletteId as PaperCollagePaletteId,
				seed,
			});
		}
	}
	return expectedPairs.map(([paletteId, compositionId]) => {
		const sample = samples.get(`${paletteId}.${compositionId}`);
		if (!sample) {
			throw new Error(`${paletteId}.${compositionId}のseedが見つかりません。`);
		}
		return sample;
	});
}

const samples = findPaperCollageSamples();

async function openPaperCollage(
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
		"paper-collage",
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

test.describe("paper-collage", () => {
	for (const sample of samples) {
		test(`${sample.paletteId}・${sample.compositionId}で写真と紙カードを描く`, async ({
			page,
		}) => {
			await openPaperCollage(page, sample.seed);
			await expectNoHiddenText(page);
			await expectContentInsidePages(page);
			await expect(page.locator(".booklet-document")).toHaveAttribute(
				"data-booklet-theme-key",
				new RegExp(
					`^paper-collage:.*:captions:paper-collage\\.${sample.paletteId}\\.${sample.compositionId}$`,
				),
			);
			await expect(
				page.locator(".booklet-document .paper-collage-card"),
			).toHaveCount(2);
			const composition = paperCollageCompositionFor(sample.compositionId);
			const coverImage = await pageRelativeMm(
				page,
				".booklet-document .paper-collage-cover__image",
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
					'.booklet-document .paper-collage-page--cover [data-booklet-decor-asset="paper-tape"]',
				),
			).toHaveCount(1);
			await expect(
				page.locator(
					'.booklet-document .paper-collage-page--day [data-booklet-decor-asset="paper-tape"]',
				),
			).toHaveCount(2);
		});
	}

	test("denseの16件を順番どおり継続ページへ送る", async ({ page }) => {
		const sample = samples[0];
		if (!sample) {
			throw new Error("paper-collageの検証seedがありません。");
		}
		await openPaperCollage(page, sample.seed, "dense");
		await expectNoHiddenText(page);
		await expectContentInsidePages(page);
		expect(
			await page.locator(".booklet-document .paper-collage-page--day").count(),
		).toBeGreaterThan(1);
		await expect(
			page.locator(".booklet-document .paper-collage-page--day").nth(1),
		).toContainText("続き");
		await expect(
			page.locator(
				".booklet-document .paper-collage-page--day:nth-of-type(n + 3) .paper-collage-day-header__image",
			),
		).toHaveCount(0);
		const unitIds = await page
			.locator(".booklet-document .paper-collage-card")
			.evaluateAll((cards) =>
				cards.map((card) => card.getAttribute("data-unit-id")),
			);
		expect(unitIds).toEqual(
			Array.from(
				{ length: 16 },
				(_value, index) => `dense-leg-${index + 1}:dense-spot-${index + 1}`,
			),
		);
	});
});
