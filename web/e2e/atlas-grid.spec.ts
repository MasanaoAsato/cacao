import { expect, type Page, test } from "@playwright/test";
import { createBookletTheme } from "../src/theme/bookletTheme.js";
import {
	type AtlasGridCompositionId,
	type AtlasGridPaletteId,
	atlasGridCompositionFor,
} from "../src/theme/families/atlasGrid.js";
import { resolveBookletDesign } from "../src/theme/families/resolveBookletDesign.js";
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

type AtlasSample = {
	readonly compositionId: AtlasGridCompositionId;
	readonly paletteId: AtlasGridPaletteId;
	readonly seed: number;
	readonly styleProfileId:
		| "atlas-grid.atlas-field-record"
		| "atlas-grid.atlas-wayfinder";
};

const expectedPairs = [
	{
		compositionId: "wide-image",
		paletteId: "blueprint",
		styleProfileId: "atlas-grid.atlas-wayfinder",
	},
	{
		compositionId: "side-index",
		paletteId: "blueprint",
		styleProfileId: "atlas-grid.atlas-wayfinder",
	},
	{
		compositionId: "wide-image",
		paletteId: "forest-atlas",
		styleProfileId: "atlas-grid.atlas-field-record",
	},
	{
		compositionId: "side-index",
		paletteId: "forest-atlas",
		styleProfileId: "atlas-grid.atlas-field-record",
	},
] as const;

function findAtlasSamples(): readonly AtlasSample[] {
	const samples = new Map<string, AtlasSample>();
	for (let seed = 0; seed < 200_000 && samples.size < 4; seed += 1) {
		const design = resolveBookletDesign(
			createBookletTheme({ value: seed, version: "v2" }),
		);
		if (design.familyId !== "atlas-grid") {
			continue;
		}
		const expected = expectedPairs.find(
			(pair) =>
				pair.paletteId === design.paletteId &&
				pair.compositionId === design.compositionId &&
				pair.styleProfileId === design.styleProfileId,
		);
		if (!expected) {
			continue;
		}
		const key = `${expected.styleProfileId}.${expected.paletteId}.${expected.compositionId}`;
		if (!samples.has(key)) {
			samples.set(key, {
				compositionId: expected.compositionId,
				paletteId: expected.paletteId,
				seed,
				styleProfileId: expected.styleProfileId,
			});
		}
	}
	return expectedPairs.map((expected) => {
		const sample = samples.get(
			`${expected.styleProfileId}.${expected.paletteId}.${expected.compositionId}`,
		);
		if (!sample) {
			throw new Error(
				`${expected.styleProfileId}.${expected.paletteId}.${expected.compositionId}のseedが見つかりません。`,
			);
		}
		return sample;
	});
}

const atlasSamples = findAtlasSamples();

async function openAtlas(
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
		"atlas-grid",
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

test.describe("atlas-grid", () => {
	for (const sample of atlasSamples) {
		test(`${sample.paletteId}・${sample.compositionId}で複数日を1枚の表にする`, async ({
			page,
		}) => {
			await openAtlas(page, sample.seed);
			await expectNoHiddenText(page);
			await expectContentInsidePages(page);
			await expect(
				page.locator(".booklet-document .atlas-grid-page--table"),
			).toHaveCount(1);
			await expect(
				page.locator(".booklet-document .atlas-grid-day-band"),
			).toHaveCount(2);
			await expect(
				page.locator(".booklet-document .atlas-grid-row"),
			).toHaveCount(2);
			await expect(page.locator(".booklet-document")).toHaveAttribute(
				"data-booklet-theme-key",
				new RegExp(
					`^atlas-grid:.*:timetable:atlas-grid\\.${sample.styleProfileId}\\.${sample.paletteId}\\.${sample.compositionId}$`,
				),
			);
			await expect(page.locator(".booklet-document")).toHaveAttribute(
				"data-booklet-style-profile",
				sample.styleProfileId,
			);

			const coverImage = page.locator(
				".booklet-document .atlas-grid-page--cover .atlas-grid-cover__image img",
			);
			await expect(coverImage).toHaveJSProperty("naturalWidth", 800);
			await expect(coverImage).toHaveJSProperty("naturalHeight", 1200);
			const composition = atlasGridCompositionFor(sample.compositionId);
			const imageRect = await pageRelativeMm(
				page,
				".booklet-document .atlas-grid-page--cover .atlas-grid-cover__image",
			);
			expect(imageRect).toEqual(
				expect.objectContaining({
					height: expect.closeTo(composition.coverImage.heightMm, 1),
					width: expect.closeTo(composition.coverImage.widthMm, 1),
					x: expect.closeTo(composition.coverImage.xMm, 1),
					y: expect.closeTo(composition.coverImage.yMm, 1),
				}),
			);

			const cellWidths = await page
				.locator(".booklet-document .atlas-grid-row")
				.first()
				.locator(".atlas-grid-cell")
				.evaluateAll((cells) =>
					cells.map((cell) => cell.getBoundingClientRect().width),
				);
			const pageWidth = await page
				.locator(".booklet-document .atlas-grid-page--table")
				.first()
				.evaluate((element) => element.getBoundingClientRect().width);
			expect(cellWidths.map((width) => (width * 148) / pageWidth)).toEqual(
				composition.columnWidthsMm.map((width) => expect.closeTo(width, 1)),
			);
		});
	}

	test("denseの16行を順番どおり継続ページへ送る", async ({ page }) => {
		const sample = atlasSamples[0];
		if (!sample) {
			throw new Error("atlas-gridの検証seedがありません。");
		}
		await openAtlas(page, sample.seed, "dense");
		await expectNoHiddenText(page);
		await expectContentInsidePages(page);
		expect(
			await page.locator(".booklet-document .atlas-grid-page--table").count(),
		).toBeGreaterThan(1);
		await expect(
			page.locator(".booklet-document .atlas-grid-page--table").nth(1),
		).toContainText("続き");
		const rows = await page
			.locator(".booklet-document .atlas-grid-row")
			.evaluateAll((elements) =>
				elements.map((element) => ({
					id: element.getAttribute("data-unit-id"),
					time: element.querySelector("time")?.textContent?.trim(),
				})),
			);
		expect(rows).toEqual(
			Array.from({ length: 16 }, (_value, index) => {
				const ordinal = index + 1;
				const totalMinutes = 8 * 60 + index * 30;
				return {
					id: `dense-leg-${ordinal}:dense-spot-${ordinal}`,
					time: `${String(Math.floor(totalMinutes / 60)).padStart(2, "0")}:${String(totalMinutes % 60).padStart(2, "0")}`,
				};
			}),
		);
		await expect(page.locator(".booklet-document")).toContainText(
			"滞在費 1,125 JPY",
		);
		await expect(page.locator(".booklet-document")).toContainText(
			"移動費 300 JPY",
		);
	});
});
