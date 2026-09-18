import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

const fixturePath = new URL("./fixtures/decor-assets.html", import.meta.url);
const DECOR_ASSET_IDS = [
	"atlas-compass",
	"atlas-route-mark",
	"atlas-perforation",
	"paper-torn-sheet",
	"paper-tape",
	"paper-leaf",
	"paper-postage",
	"playful-bag",
	"playful-sun",
	"playful-squiggle",
	"playful-burst",
	"playful-footprints",
	"playful-curved-arrow",
] as const;
/** Artwork that keeps its own colours, so it is drawn without a mask. */
const OWN_COLOUR_ASSET_IDS = ["paper-torn-sheet", "paper-tape"] as const;
const REPEATS = 2;

test("装飾素材13点をA5の製品描画で反復・着色して読込できる", async ({
	page,
}) => {
	await page.goto("/");
	await page.setContent(await readFile(fixturePath, "utf8"));
	const sheets = page.locator("[data-decor-assets]");
	await expect(sheets).toHaveCount(2);
	for (const sheet of await sheets.all()) {
		await expect(sheet).toHaveAttribute("viewBox", "0 0 148 210");
		expect(
			await sheet.locator("[data-decor-asset]").count(),
		).toBeLessThanOrEqual(12 * REPEATS);
	}

	const assets = page.locator("[data-decor-asset]");
	await expect(assets).toHaveCount(DECOR_ASSET_IDS.length * REPEATS);
	for (const id of DECOR_ASSET_IDS) {
		await expect(page.locator(`[data-decor-asset="${id}"]`)).toHaveCount(
			REPEATS,
		);
	}
	await expect(page.locator("[data-decor-assets] rect[mask]")).toHaveCount(
		(DECOR_ASSET_IDS.length - OWN_COLOUR_ASSET_IDS.length) * REPEATS,
	);
	for (const id of OWN_COLOUR_ASSET_IDS) {
		await expect(
			page.locator(`[data-decor-asset="${id}"] rect[mask]`),
		).toHaveCount(0);
	}

	const maskIds = await page
		.locator("[data-decor-assets] mask")
		.evaluateAll((masks) => masks.map((mask) => mask.id));
	expect(maskIds).toHaveLength(
		(DECOR_ASSET_IDS.length - OWN_COLOUR_ASSET_IDS.length) * REPEATS,
	);
	expect(new Set(maskIds).size).toBe(maskIds.length);

	const assetURLs = await page
		.locator("[data-decor-assets] image")
		.evaluateAll((images) =>
			Array.from(
				new Set(images.map((image) => image.getAttribute("href"))),
			).filter((url): url is string => url !== null),
		);
	expect(assetURLs).toHaveLength(DECOR_ASSET_IDS.length);
	await page.evaluate(async (urls) => {
		await Promise.all(
			urls.map(async (src) => {
				const image = new Image();
				image.src = src;
				await image.decode();
			}),
		);
	}, assetURLs);
});
