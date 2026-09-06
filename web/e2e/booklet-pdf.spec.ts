import { expect, test } from "@playwright/test";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { getCoverLayoutDefinition } from "../src/theme/bookletTheme.js";
import { V2_REPRESENTATIVE_SEEDS } from "../src/theme/catalog.js";
import { routeBookletApi } from "./fixtures/booklet.js";

const LAYOUT_ROUNDING_TOLERANCE_PX = 1;

function seedToken(seed: number): string {
	return `v2-${seed.toString(16).padStart(8, "0")}`;
}

function representativeSeedFor(templateId: string): number {
	const representative = V2_REPRESENTATIVE_SEEDS.find(
		({ expected }) => expected.itineraryTemplateId === templateId,
	);
	if (!representative) {
		throw new Error(
			`本文テンプレート「${templateId}」の代表シードがありません。`,
		);
	}
	return representative.seed;
}

async function expectNoHiddenText(page: import("@playwright/test").Page) {
	const problems = await page.locator("[data-booklet-text-role]").evaluateAll(
		(elements, tolerance) =>
			elements.flatMap((element) => {
				const htmlElement = element as HTMLElement;
				const style = getComputedStyle(htmlElement);
				const hidden =
					["hidden", "clip", "scroll", "auto"].includes(style.overflow) ||
					style.whiteSpace === "nowrap" ||
					(style.textOverflow !== "" && style.textOverflow !== "clip") ||
					style.transform.includes("scale");
				return htmlElement.scrollWidth > htmlElement.clientWidth + tolerance ||
					htmlElement.scrollHeight > htmlElement.clientHeight + tolerance ||
					hidden
					? [htmlElement.dataset.bookletTextRole]
					: [];
			}),
		LAYOUT_ROUNDING_TOLERANCE_PX,
	);
	expect(problems).toEqual([]);
}

test.describe("PDFしおり", () => {
	test.beforeEach(async ({ page }) => {
		await routeBookletApi(page);
	});

	for (const { expected, seed } of V2_REPRESENTATIVE_SEEDS) {
		test(`V2代表シード ${seedToken(seed)} は文字を隠さずA5として描画する`, async ({
			page,
		}) => {
			await page.goto(`/journeys/journey-1/booklet?seed=${seedToken(seed)}`);
			await expect(page.getByRole("status")).toHaveText(
				new RegExp(
					`^${seedToken(seed)}（${expected.moodId}・${expected.paletteId}・${expected.coverLayoutId}）の印刷準備ができました。$`,
				),
			);
			await expect(page.locator(".booklet-shell")).toHaveAttribute(
				"data-booklet-print-state",
				"ready",
			);
			await expectNoHiddenText(page);

			const cover = page.locator(".booklet-document .booklet-page--cover");
			await expect(cover).toHaveScreenshot(`${seedToken(seed)}-cover.png`, {
				animations: "disabled",
				caret: "hide",
			});
			const firstDay = page
				.locator(".booklet-document .booklet-page--day")
				.first();
			await expect(
				firstDay.locator("figure.booklet-day__illustration"),
			).toHaveCount(1);
			await expect(firstDay.locator("figure img")).toHaveAttribute(
				"alt",
				"非常に長い目的地名称を含む京都の旅の挿絵",
			);
			await expect(firstDay).toHaveScreenshot(`${seedToken(seed)}-day.png`, {
				animations: "disabled",
				caret: "hide",
			});
			await expect(
				page.locator(
					".booklet-document .booklet-page--day-continuation figure",
				),
			).toHaveCount(0);
			await expect(page.locator(".booklet-document")).toHaveAttribute(
				"data-booklet-design",
				new RegExp(`^${expected.moodId}\\.`),
			);
			const themeClasses = await page
				.locator(".booklet-document")
				.evaluate((element) => Array.from(element.classList));
			expect(themeClasses).toContain(`booklet-theme--mood-${expected.moodId}`);
			expect(themeClasses).toContain(
				`booklet-theme--decor-${expected.decorId}`,
			);
			expect(
				themeClasses.some((className) =>
					className.startsWith("booklet-theme--signature-"),
				),
			).toBe(false);
			await expect(cover.locator(".booklet-cover__image")).toHaveJSProperty(
				"naturalWidth",
				800,
			);
			const titleWeight = await cover
				.locator(".booklet-cover__title")
				.evaluate((element) => getComputedStyle(element).fontWeight);
			expect(titleWeight).toBe(
				["inherit", "kaisei-decol"].includes(expected.displayFontId)
					? "700"
					: "400",
			);
			if (expected.coverLayoutId === "poster") {
				await expect(cover.locator(".booklet-cover__title")).toHaveClass(
					/booklet-cover__title--very-long/,
				);
			}
			const frame = await cover
				.locator(".booklet-cover__frame")
				.evaluate((element) => {
					const coverElement = element.closest<HTMLElement>(
						".booklet-page--cover",
					);
					if (!coverElement) {
						throw new Error("表紙の画像枠を計測できません。");
					}
					const coverRect = coverElement.getBoundingClientRect();
					const frameRect = element.getBoundingClientRect();
					return {
						height: frameRect.height,
						left: frameRect.left - coverRect.left,
						top: frameRect.top - coverRect.top,
						width: frameRect.width,
						scaleX: coverRect.width / 148,
						scaleY: coverRect.height / 210,
					};
				});
			const imageFrame = getCoverLayoutDefinition(
				expected.coverLayoutId,
			).imageFrame;
			expect(Math.abs(frame.left - imageFrame.xMm * frame.scaleX)).toBeLessThan(
				1,
			);
			expect(Math.abs(frame.top - imageFrame.yMm * frame.scaleY)).toBeLessThan(
				1,
			);
			expect(
				Math.abs(frame.width - imageFrame.widthMm * frame.scaleX),
			).toBeLessThan(1);
			expect(
				Math.abs(frame.height - imageFrame.heightMm * frame.scaleY),
			).toBeLessThan(1);
			const veil = cover.locator("svg.booklet-cover__veil");
			if (getCoverLayoutDefinition(expected.coverLayoutId).veil === "none") {
				await expect(veil).toHaveCount(0);
			} else {
				const veilKind = await veil.getAttribute(
					"data-booklet-cover-veil-kind",
				);
				expect(["linear-x", "linear-y", "radial"]).toContain(veilKind);
				await expect(veil).toHaveCount(1);
				await expect(
					veil.locator(
						veilKind === "linear-x" || veilKind === "linear-y"
							? "linearGradient"
							: "radialGradient",
					),
				).toHaveCount(1);
			}
		});
	}

	for (const templateId of [
		"route-thread",
		"field-journal",
		"travel-ticket",
	] as const) {
		test(`${templateId} は長い一日の継続ページを描画する`, async ({ page }) => {
			await routeBookletApi(page, "long");
			await page.goto(
				`/journeys/journey-long/booklet?seed=${seedToken(representativeSeedFor(templateId))}`,
			);
			await expect(page.getByRole("status")).toHaveText(
				/印刷準備ができました。/,
			);
			const continuation = page
				.locator(".booklet-document .booklet-page--day-continuation")
				.first();
			await expect(continuation).toBeVisible();
			await expect(continuation).toHaveScreenshot(
				`long-${templateId}-continuation.png`,
				{ animations: "disabled", caret: "hide" },
			);
		});
	}

	test("40件のランダム標本は文字をあふれさせずに描画する", async ({ page }) => {
		test.setTimeout(120_000);
		for (let offset = 0; offset < 40; offset += 1) {
			await page.goto(
				`/journeys/journey-1/booklet?seed=${seedToken(0x00001000 + offset)}`,
			);
			await expect(page.locator(".booklet-shell")).toHaveAttribute(
				"data-booklet-print-state",
				"ready",
			);
			await expectNoHiddenText(page);
		}
	});

	test("代表テーマをA5 PDFとして出力できる", async ({ page }) => {
		await page.goto(`/journeys/journey-1/booklet?seed=${seedToken(0)}`);
		await expect(page.getByRole("button", { name: "PDFを印刷" })).toBeEnabled();
		await page.emulateMedia({ media: "print" });
		const pdf = await page.pdf({
			preferCSSPageSize: true,
			printBackground: true,
		});
		expect(pdf.byteLength).toBeGreaterThan(1000);
		const pdfDocument = await getDocument({ data: new Uint8Array(pdf) })
			.promise;
		expect(pdfDocument.numPages).toBe(3);
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
		const coverText = await (await pdfDocument.getPage(1)).getTextContent();
		expect(
			coverText.items.map((item) => ("str" in item ? item.str : "")).join(""),
		).toContain("非常に長い目的地名称を含む京都の旅");
		await pdfDocument.destroy();
	});
});
