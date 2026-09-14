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
] as const;

test("装飾素材11点をA5の製品描画で反復・着色して読込できる", async ({
	page,
}) => {
	await page.goto("/");
	await page.setContent(await readFile(fixturePath, "utf8"));
	const specimen = page.locator("[data-decor-assets]");
	await expect(specimen).toHaveAttribute("viewBox", "0 0 148 210");
	const assets = specimen.locator("[data-decor-asset]");
	await expect(assets).toHaveCount(22);

	for (const id of DECOR_ASSET_IDS) {
		await expect(specimen.locator(`[data-decor-asset="${id}"]`)).toHaveCount(2);
	}
	await expect(specimen.locator("rect[mask]")).toHaveCount(18);
	await expect(
		specimen.locator('[data-decor-asset="paper-torn-sheet"] rect[mask]'),
	).toHaveCount(0);
	await expect(
		specimen.locator('[data-decor-asset="paper-tape"] rect[mask]'),
	).toHaveCount(0);

	const assetURLs = await specimen
		.locator("image")
		.evaluateAll((images) =>
			Array.from(
				new Set(images.map((image) => image.getAttribute("href"))),
			).filter((url): url is string => url !== null),
		);
	expect(assetURLs).toHaveLength(11);
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
