import { expect, type Page, test } from "@playwright/test";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { canonicalArtworkTouchId } from "../src/theme/artwork/types";
import { directionDefinitionById } from "../src/theme/directions/registry";
import { DIRECTION_IDS, type DirectionId } from "../src/theme/directions/types";
import {
	expectArtworkClearOfText,
	expectContentInsidePages,
	expectNoHiddenText,
} from "./support/booklet-assertions.js";

const REVIEW_URL = "/e2e/fixtures/booklet-direction-review.html";

async function openReview(page: Page, id: DirectionId) {
	await page.goto(`${REVIEW_URL}?direction=${id}`);
	const shell = page.locator(".review-shell");
	await expect(shell).toHaveAttribute("data-review-direction", id);
	await expect(shell).toHaveAttribute("data-review-status", "ready");
	await expect(
		page.locator(".booklet-document [data-booklet-page]").first(),
	).toBeVisible();
	return shell;
}

test("審査入口: 52方向を選択でき、activeとdraftの両方を描ける", async ({
	page,
}) => {
	const shell = await openReview(page, "travel-magazine");
	await expect(page.locator("#review-direction option")).toHaveCount(52);
	await expect(page.getByText(/強制作例は製品の抽選結果/)).toBeVisible();
	await page.locator("#review-direction").selectOption("vintage-journal");
	await expect(page).toHaveURL(/direction=vintage-journal/);
	await expect(shell).toHaveAttribute("data-review-status", "ready");
	await expect(
		page.locator(".booklet-document [data-artwork-asset]").first(),
	).toBeVisible();
	for (const id of ["newspaper", "stamp"] as const) {
		await openReview(page, id);
		await expectContentInsidePages(page);
	}
});

for (const id of DIRECTION_IDS) {
	test(`${id} の審査表示に完成紙面と必要な素材を描く`, async ({ page }) => {
		await openReview(page, id);
		await expectNoHiddenText(page);
		await expectContentInsidePages(page);
		await expectArtworkClearOfText(page);
		const touch = canonicalArtworkTouchId(
			directionDefinitionById(id).baseline().touch,
		);
		const artwork = page.locator(".booklet-document [data-artwork-asset]");
		if (touch) {
			expect(await artwork.count()).toBeGreaterThan(0);
		}
	});
}

test("季節柄のSVGは四季ごとに別の範囲をmaskで描く", async ({ page }) => {
	const positions = new Set<string>();
	for (const month of ["03", "08", "09", "12"] as const) {
		await page.goto(`${REVIEW_URL}?direction=season&month=${month}`);
		await expect(page.locator(".review-shell")).toHaveAttribute(
			"data-review-status",
			"ready",
		);
		await expect(page.getByLabel("季節の見本")).toHaveValue(month);
		const artwork = page
			.locator('.booklet-document [data-artwork-asset*="season-pattern"]')
			.first();
		await expect(artwork).toBeVisible();
		const style = await artwork.evaluate((element) => {
			const computed = getComputedStyle(element);
			return {
				backgroundImage: computed.backgroundImage,
				maskPosition: computed.maskPosition,
				maskSize: computed.maskSize,
			};
		});
		expect(style.backgroundImage).toBe("none");
		expect(style.maskSize).not.toBe("contain");
		positions.add(style.maskPosition);
	}
	expect(positions.size).toBe(4);
});

for (const id of DIRECTION_IDS) {
	test(`${id} の単独冊子をA5で書き出す`, async ({ page }, testInfo) => {
		test.skip(
			process.env.BOOKLET_REVIEW_EXPORT !== "1",
			"52方向の書き出しはBOOKLET_REVIEW_EXPORT=1で実行する",
		);
		await openReview(page, id);
		await expectNoHiddenText(page);
		await expectContentInsidePages(page);
		await expectArtworkClearOfText(page);
		const booklet = page.locator(".booklet-document");
		const coverPage = booklet
			.locator('[data-booklet-page][data-scene-kind="cover"]')
			.first();
		const dayPage = booklet
			.locator('[data-booklet-page][data-scene-kind="day"]')
			.first();
		expect(await coverPage.count(), `${id}: 表紙の出力頁`).toBe(1);
		expect(await dayPage.count(), `${id}: 日別本文の出力頁`).toBe(1);
		await expect(coverPage).toBeVisible();
		await expect(dayPage).toBeVisible();
		const metadata = {
			directionId: id,
			stage: "draft-preview-only",
			pageCount: await booklet.locator("[data-booklet-page]").count(),
			pages: await booklet.locator("[data-booklet-page]").evaluateAll((pages) =>
				pages.map((page) => ({
					pageId: page.getAttribute("data-page-id"),
					moduleId: page.getAttribute("data-module-id"),
					styleId: page.getAttribute("data-booklet-style-id"),
					compositionId: page.getAttribute("data-booklet-composition"),
					paper: getComputedStyle(page).backgroundColor,
					font: getComputedStyle(page).fontFamily,
					assets: Array.from(
						page.querySelectorAll<HTMLElement>("[data-artwork-asset]"),
					).map((asset) => ({
						id: asset.dataset.artworkAsset,
						mask: getComputedStyle(asset).maskImage,
						image: asset.querySelector("img")?.getAttribute("src") ?? null,
					})),
				})),
			),
			assetIds: await booklet
				.locator("[data-artwork-asset]")
				.evaluateAll((assets) =>
					assets.map((asset) => asset.getAttribute("data-artwork-asset")),
				),
		};
		if (process.env.BOOKLET_REVIEW_DIAGNOSTIC === "1")
			console.info(JSON.stringify(metadata));
		await testInfo.attach("metadata.json", {
			body: JSON.stringify(metadata, null, 2),
			contentType: "application/json",
		});
		await testInfo.attach("color.png", {
			body: await booklet.screenshot(),
			contentType: "image/png",
		});
		await testInfo.attach("cover-color.png", {
			body: await coverPage.screenshot(),
			contentType: "image/png",
		});
		await testInfo.attach("day-color.png", {
			body: await dayPage.screenshot(),
			contentType: "image/png",
		});
		await booklet.evaluate((element) => {
			(element as HTMLElement).style.filter = "grayscale(1)";
		});
		await testInfo.attach("grayscale.png", {
			body: await booklet.screenshot(),
			contentType: "image/png",
		});
		await testInfo.attach("cover-grayscale.png", {
			body: await coverPage.screenshot(),
			contentType: "image/png",
		});
		await testInfo.attach("day-grayscale.png", {
			body: await dayPage.screenshot(),
			contentType: "image/png",
		});
		await booklet.evaluate((element) => {
			(element as HTMLElement).style.filter = "";
		});
		await page.emulateMedia({ media: "print" });
		const pdf = await page.pdf({
			preferCSSPageSize: true,
			printBackground: true,
		});
		const printed = await getDocument({ data: new Uint8Array(pdf) }).promise;
		expect(printed.numPages).toBe(metadata.pageCount);
		for (let number = 1; number <= printed.numPages; number += 1) {
			const [left = 0, bottom = 0, right = 0, top = 0] = (
				await printed.getPage(number)
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
