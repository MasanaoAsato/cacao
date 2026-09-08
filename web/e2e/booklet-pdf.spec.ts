import { expect, type Page, test } from "@playwright/test";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import {
	COVER_LAYOUTS,
	getBodyContentInset,
	getCoverLayoutDefinition,
	THEME_CATALOG_REFERENCES,
} from "../src/theme/bookletTheme.js";
import { MOODS, V2_REPRESENTATIVE_SEEDS } from "../src/theme/catalog.js";
import { resolveTheme } from "../src/theme/resolve.js";
import type { MoodId, ThemeRecipeDefinition } from "../src/theme/types.js";
import { routeBookletApi } from "./fixtures/booklet.js";
import {
	MOOD_SAMPLE_SEEDS,
	type MoodSample,
} from "./fixtures/booklet-theme-samples.js";
import {
	expectBookletPrintReady,
	expectContentInsidePages,
	expectNoHiddenText,
	expectSelectedCandidate,
	LAYOUT_ROUNDING_TOLERANCE_PX,
	seedToken,
} from "./support/booklet-assertions.js";

const PAGE_WIDTH_MM = 148;

const RANDOM_SAMPLE_SEEDS = Array.from(
	{ length: 8 },
	(_, offset) => 0x1000 + offset,
);

function recipeOf(seed: number): ThemeRecipeDefinition {
	return resolveTheme(
		{ value: seed, version: "v2" },
		{ coverVisualStyle: null },
		MOODS,
		THEME_CATALOG_REFERENCES,
	).recipe;
}

/** First seed whose resolved recipe satisfies the predicate; self-maintaining. */
function findSeed(
	predicate: (recipe: ThemeRecipeDefinition) => boolean,
): number {
	for (let seed = 0; seed < 200_000; seed += 1) {
		if (predicate(recipeOf(seed))) {
			return seed;
		}
	}
	throw new Error("条件を満たすシードが見つかりません。");
}

async function openBooklet(
	page: Page,
	seed: number,
	scenario: "default" | "long" = "default",
): Promise<void> {
	await routeBookletApi(page, scenario);
	await page.goto(
		`/journeys/${scenario === "long" ? "journey-long" : "journey-1"}/booklet?seed=${seedToken(seed)}`,
	);
	await expectBookletPrintReady(page);
}

type Rect = {
	readonly x: number;
	readonly y: number;
	readonly w: number;
	readonly h: number;
};

/** Page-relative rectangle in mm of an element inside a day page. */
async function rectMm(
	page: Page,
	pageSelector: string,
	selector: string,
): Promise<Rect> {
	return page
		.locator(pageSelector)
		.first()
		.evaluate((pageElement, innerSelector) => {
			const target = pageElement.querySelector(innerSelector);
			if (!target) {
				throw new Error(`${innerSelector}が見つかりません。`);
			}
			const pageRect = pageElement.getBoundingClientRect();
			const rect = target.getBoundingClientRect();
			const scale = 148 / pageRect.width;
			return {
				h: rect.height * scale,
				w: rect.width * scale,
				x: (rect.left - pageRect.left) * scale,
				y: (rect.top - pageRect.top) * scale,
			};
		}, selector);
}

function mmToleranceOf(px: number, pageWidthPx: number): number {
	return (px * PAGE_WIDTH_MM) / pageWidthPx;
}

test.describe("PDFしおり", () => {
	test("操作部は720pxで横並び、719pxで縦並びになる", async ({ page }) => {
		await openBooklet(page, 0);
		const controls = page.locator(".booklet-controls");

		for (const width of [720, 719]) {
			await page.setViewportSize({ height: 1000, width });
			await expect(controls).toBeVisible();
			const layout = await controls.evaluate((element) => {
				const identityElement = element.querySelector<HTMLElement>(
					".booklet-controls__identity",
				);
				const actionsElement = element.querySelector<HTMLElement>(
					".booklet-controls__actions",
				);
				const statusElement = element.querySelector<HTMLElement>(
					".booklet-controls__status",
				);
				if (!identityElement || !actionsElement || !statusElement) {
					throw new Error("操作部の配置を計測できません。");
				}
				const identityRect = identityElement.getBoundingClientRect();
				const actionsRect = actionsElement.getBoundingClientRect();
				const statusRect = statusElement.getBoundingClientRect();
				return {
					actionsTop: actionsRect.top,
					actionsBottom: actionsRect.bottom,
					identityTop: identityRect.top,
					identityBottom: identityRect.bottom,
					statusTop: statusRect.top,
					columns: getComputedStyle(element).gridTemplateColumns,
					labels: Array.from(
						element.querySelectorAll<HTMLElement>(
							".booklet-controls__identity h1, .booklet-controls__eyebrow, .booklet-controls__actions a, .booklet-controls__actions button",
						),
					).map((label) => ({
						overflowing: label.scrollWidth > label.clientWidth,
						whiteSpace: getComputedStyle(label).whiteSpace,
					})),
				};
			});

			if (width === 720) {
				expect(layout.columns.split(" ")).toHaveLength(2);
				expect(layout.identityTop).toBeLessThan(layout.actionsBottom);
				expect(layout.identityBottom).toBeGreaterThan(layout.actionsTop);
				expect(layout.statusTop).toBeGreaterThan(
					Math.max(layout.identityBottom, layout.actionsBottom),
				);
			} else {
				expect(layout.columns.split(" ")).toHaveLength(1);
				expect(layout.identityBottom).toBeLessThanOrEqual(layout.actionsTop);
				expect(layout.actionsBottom).toBeLessThanOrEqual(layout.statusTop);
			}
			expect(layout.labels).toHaveLength(6);
			expect(layout.labels.every((label) => !label.overflowing)).toBe(true);
			expect(
				layout.labels.every((label) => label.whiteSpace === "nowrap"),
			).toBe(true);
		}
	});

	test.describe("仕組み検査", () => {
		test("two-column は1列目が埋まってから2列目、両列が埋まってから継続ページへ送る", async ({
			page,
		}) => {
			const seed = findSeed((recipe) => recipe.compositionId === "two-column");
			await openBooklet(page, seed, "long");
			await expectSelectedCandidate(page);
			const days = page.locator(".booklet-document .booklet-page--day");
			expect(await days.count()).toBeGreaterThanOrEqual(2);
			await expect(days.first()).toHaveAttribute("data-booklet-columns", "2");
			const layout = await days.first().evaluate((pageElement) => {
				const content = pageElement.querySelector(".booklet-page__content");
				const units = Array.from(pageElement.querySelectorAll(".booklet-unit"));
				if (!content || units.length === 0) {
					throw new Error("2列の単位を計測できません。");
				}
				const contentRect = content.getBoundingClientRect();
				const rects = units.map((unit) => unit.getBoundingClientRect());
				const midpoint = contentRect.left + contentRect.width / 2;
				const first = rects.filter((rect) => rect.left < midpoint);
				const second = rects.filter((rect) => rect.left >= midpoint);
				return {
					contentBottom: contentRect.bottom,
					firstColumnBottom: Math.max(...first.map((rect) => rect.bottom)),
					firstColumnRight: Math.max(...first.map((rect) => rect.right)),
					firstCount: first.length,
					secondColumnLeft: Math.min(...second.map((rect) => rect.left)),
					secondCount: second.length,
				};
			});
			expect(layout.firstCount).toBeGreaterThan(0);
			expect(layout.secondCount).toBeGreaterThan(0);
			expect(layout.firstColumnBottom).toBeLessThanOrEqual(
				layout.contentBottom + LAYOUT_ROUNDING_TOLERANCE_PX,
			);
			expect(layout.secondColumnLeft).toBeGreaterThan(layout.firstColumnRight);
			await expect(
				page
					.locator(".booklet-document .booklet-page--day-continuation")
					.first(),
			).toBeVisible();
			await expectNoHiddenText(page);
		});

		test("side-band は縦書きの帯に見出しを置き、継続ページの帯は「続き」を含む", async ({
			page,
		}) => {
			const seed = findSeed((recipe) => recipe.compositionId === "side-band");
			await openBooklet(page, seed, "long");
			await expectSelectedCandidate(page);
			const header = await rectMm(
				page,
				".booklet-document .booklet-page--day",
				".booklet-day-header",
			);
			const pageWidthPx = await page
				.locator(".booklet-document .booklet-page--day")
				.first()
				.evaluate((element) => element.getBoundingClientRect().width);
			expect(Math.abs(header.w - 22)).toBeLessThan(
				mmToleranceOf(LAYOUT_ROUNDING_TOLERANCE_PX, pageWidthPx),
			);
			const writingMode = await page
				.locator(".booklet-document .booklet-page--day .booklet-day-header h2")
				.first()
				.evaluate((element) => getComputedStyle(element).writingMode);
			expect(writingMode).toBe("vertical-rl");
			await expect(
				page
					.locator(
						".booklet-document .booklet-page--day-continuation .booklet-day-header",
					)
					.first(),
			).toContainText("続き");
			await expectNoHiddenText(page);
		});

		test("bottom-anchored は単位列を本文領域の下端に寄せる", async ({
			page,
		}) => {
			const seed = findSeed(
				(recipe) => recipe.compositionId === "bottom-anchored",
			);
			await openBooklet(page, seed, "long");
			await expectSelectedCandidate(page);
			const gaps = await page
				.locator(".booklet-document .booklet-page--day")
				.evaluateAll((pages) =>
					pages.map((pageElement) => {
						const content = pageElement.querySelector(".booklet-page__content");
						const units = pageElement.querySelectorAll(".booklet-itinerary");
						const list = units[units.length - 1];
						if (!content || !list) {
							throw new Error("単位列を計測できません。");
						}
						return (
							content.getBoundingClientRect().bottom -
							list.getBoundingClientRect().bottom
						);
					}),
				);
			expect(gaps.length).toBeGreaterThanOrEqual(2);
			for (const gap of gaps) {
				expect(Math.abs(gap)).toBeLessThanOrEqual(LAYOUT_ROUNDING_TOLERANCE_PX);
			}
		});

		test("装飾と構図の内側余白が本文の余白へ加算される", async ({ page }) => {
			const seed = findSeed(
				(recipe) =>
					recipe.compositionId === "side-band" &&
					recipe.decorId === "stripe-band",
			);
			await openBooklet(page, seed);
			await expectSelectedCandidate(page);
			const recipe = recipeOf(seed);
			const inset = getBodyContentInset(recipe);
			const margin = recipe.typography.pageMarginMm;
			const content = await rectMm(
				page,
				".booklet-document .booklet-page--day",
				".booklet-page__content",
			);
			const pageWidthPx = await page
				.locator(".booklet-document .booklet-page--day")
				.first()
				.evaluate((element) => element.getBoundingClientRect().width);
			const tolerance = mmToleranceOf(
				LAYOUT_ROUNDING_TOLERANCE_PX,
				pageWidthPx,
			);
			expect(Math.abs(content.x - (margin + inset.left))).toBeLessThan(
				tolerance,
			);
			expect(Math.abs(content.y - (margin + inset.top))).toBeLessThan(
				tolerance,
			);
			expect(
				Math.abs(148 - (content.x + content.w) - (margin + inset.right)),
			).toBeLessThan(tolerance);
			expect(
				Math.abs(210 - (content.y + content.h) - (margin + inset.bottom)),
			).toBeLessThan(tolerance);
		});

		test("図形は本文領域と交差せず、パネルは本文領域を含む", async ({
			page,
		}) => {
			const withMotifs = findSeed(
				(recipe) => recipe.decorId === "confetti-corners",
			);
			await openBooklet(page, withMotifs);
			await expectSelectedCandidate(page);
			const content = await rectMm(
				page,
				".booklet-document .booklet-page--day",
				".booklet-page__content",
			);
			const bounds = await page
				.locator(".booklet-document .booklet-page--day")
				.first()
				.locator("[data-booklet-motif-bounds]")
				.evaluateAll((elements) =>
					elements.map((element) =>
						(element.getAttribute("data-booklet-motif-bounds") ?? "")
							.split(",")
							.map(Number),
					),
				);
			expect(bounds).toHaveLength(4);
			for (const [x, y, w, h] of bounds) {
				const overlaps =
					x < content.x + content.w &&
					x + w > content.x &&
					y < content.y + content.h &&
					y + h > content.y;
				expect(overlaps).toBe(false);
			}

			const withPanel = findSeed(
				(recipe) => recipe.decorId === "sheet-on-dots",
			);
			await openBooklet(page, withPanel);
			await expectSelectedCandidate(page);
			const panelContent = await rectMm(
				page,
				".booklet-document .booklet-page--day",
				".booklet-page__content",
			);
			const panel = await page
				.locator(".booklet-document .booklet-page--day [data-booklet-panel]")
				.first()
				.evaluate((element) => ({
					h: Number(element.getAttribute("height")),
					w: Number(element.getAttribute("width")),
					x: Number(element.getAttribute("x")),
					y: Number(element.getAttribute("y")),
				}));
			expect(panel.x).toBeLessThanOrEqual(panelContent.x);
			expect(panel.y).toBeLessThanOrEqual(panelContent.y);
			expect(panel.x + panel.w).toBeGreaterThanOrEqual(
				panelContent.x + panelContent.w,
			);
			expect(panel.y + panel.h).toBeGreaterThanOrEqual(
				panelContent.y + panelContent.h,
			);
		});

		test("compact と line はラベルを隠し移動を1行にたたむ", async ({
			page,
		}) => {
			for (const unitFormId of ["compact", "line"] as const) {
				const seed = findSeed((recipe) => recipe.unitFormId === unitFormId);
				await openBooklet(page, seed);
				await expectSelectedCandidate(page);
				const unit = page
					.locator(".booklet-document .booklet-page--day .booklet-unit")
					.first();
				const labelDisplays = await unit
					.locator(".booklet-unit__label")
					.evaluateAll((elements) =>
						elements.map((element) => getComputedStyle(element).display),
					);
				expect(labelDisplays.length).toBeGreaterThan(0);
				expect(new Set(labelDisplays)).toEqual(new Set(["none"]));
				const details = await unit
					.locator(".booklet-unit__details")
					.evaluate((element) => {
						const rect = element.getBoundingClientRect();
						const value = element.querySelector("dd");
						return {
							height: rect.height,
							lineHeight: value
								? Number.parseFloat(getComputedStyle(value).lineHeight)
								: Number.NaN,
						};
					});
				expect(details.height).toBeLessThan(details.lineHeight * 1.5);
				await expectNoHiddenText(page);
			}
			const full = findSeed((recipe) => recipe.unitFormId === "full");
			await openBooklet(page, full);
			await expect(
				page
					.locator(".booklet-document .booklet-page--day .booklet-unit__label")
					.first(),
			).toBeVisible();
		});

		test("compact の travel-ticket と rail-ledger は時刻と滞在費を同じ先頭行の両端に置く", async ({
			page,
		}) => {
			for (const itineraryTemplateId of [
				"travel-ticket",
				"rail-ledger",
			] as const) {
				const seed = findSeed(
					(recipe) =>
						recipe.unitFormId === "compact" &&
						recipe.itineraryTemplateId === itineraryTemplateId,
				);
				await openBooklet(page, seed);
				await expectSelectedCandidate(page);
				const layout = await page
					.locator(".booklet-document .booklet-page--day .booklet-unit__spot")
					.first()
					.evaluate((spot) => {
						const rectOf = (selector: string) => {
							const element = spot.querySelector(selector);
							if (!element) {
								throw new Error(`${selector} がありません。`);
							}
							const rect = element.getBoundingClientRect();
							return { bottom: rect.bottom, right: rect.right, top: rect.top };
						};
						const spotRect = spot.getBoundingClientRect();
						return {
							cost: rectOf("p.booklet-unit__cost"),
							spotRight: spotRect.right,
							time: rectOf(".booklet-unit__time"),
						};
					});
				expect(layout.time.top).toBeLessThan(layout.cost.bottom);
				expect(layout.cost.top).toBeLessThan(layout.time.bottom);
				expect(Math.abs(layout.cost.right - layout.spotRight)).toBeLessThan(
					LAYOUT_ROUNDING_TOLERANCE_PX,
				);
			}
		});

		test("route-thread の継続ページは本文余白の内側に軌道を引く", async ({
			page,
		}) => {
			const seed = findSeed(
				(recipe) =>
					recipe.itineraryTemplateId === "route-thread" &&
					recipe.compositionId === "top-stack",
			);
			await openBooklet(page, seed, "long");
			await expectSelectedCandidate(page);
			const rail = await page
				.locator(".booklet-document .booklet-page--day-continuation")
				.first()
				.evaluate((element) => {
					const style = getComputedStyle(element, "::before");
					return {
						content: style.content,
						left: style.left,
						width: style.width,
					};
				});
			const recipe = recipeOf(seed);
			const inset = getBodyContentInset(recipe);
			expect(rail.content).toBe('""');
			expect(rail.width).toBe("1px");
			const pageWidthPx = await page
				.locator(".booklet-document .booklet-page--day")
				.first()
				.evaluate((element) => element.getBoundingClientRect().width);
			const expectedLeftPx =
				((recipe.typography.pageMarginMm + inset.left + 7) * pageWidthPx) / 148;
			expect(
				Math.abs(Number.parseFloat(rail.left) - expectedLeftPx),
			).toBeLessThan(LAYOUT_ROUNDING_TOLERANCE_PX);
		});
	});

	test("掃引: 代表シードとランダム標本は文字を隠さず紙面に収まる", async ({
		page,
	}) => {
		test.setTimeout(300_000);
		await routeBookletApi(page);
		const seeds = [
			...V2_REPRESENTATIVE_SEEDS.map(({ seed }) => seed),
			...RANDOM_SAMPLE_SEEDS,
		];
		for (const seed of seeds) {
			await page.goto(`/journeys/journey-1/booklet?seed=${seedToken(seed)}`);
			await expect(page.locator(".booklet-shell")).toHaveAttribute(
				"data-booklet-print-state",
				"ready",
			);
			// The requested design is kept on the document even when the fit check
			// fell back to another candidate, so compare it with the resolver.
			await expect(page.locator(".booklet-document")).toHaveAttribute(
				"data-booklet-design",
				recipeOf(seed).id,
			);
			await expectNoHiddenText(page);
			await expectContentInsidePages(page);
		}
	});

	test.describe("見本スナップショット", () => {
		for (const [moodId, sample] of Object.entries(
			MOOD_SAMPLE_SEEDS,
		) as ReadonlyArray<[MoodId, MoodSample]>) {
			test(`${moodId} の表紙と最初の日ページ`, async ({ page }) => {
				const { decorId, seed } = sample;
				expect(recipeOf(seed).moodId).toBe(moodId);
				if (decorId) {
					expect(recipeOf(seed).decorId).toBe(decorId);
				}
				await openBooklet(page, seed);
				await expect(page.locator(".booklet-document")).toHaveAttribute(
					"data-booklet-design",
					new RegExp(`^${moodId}\\.`),
				);
				await expect(page.getByRole("status")).toHaveText(
					new RegExp(
						`^${seedToken(seed)}（${moodId}・.+）の印刷準備ができました。$`,
					),
				);
				await expect(
					page.locator(".booklet-document .booklet-page--cover"),
				).toHaveScreenshot(`sample-${moodId}-cover.png`, {
					animations: "disabled",
					caret: "hide",
				});
				const firstDay = page
					.locator(".booklet-document .booklet-page--day")
					.first();
				await expect(
					firstDay.locator("figure.booklet-day__illustration"),
				).toHaveCount(1);
				await expect(firstDay).toHaveScreenshot(`sample-${moodId}-day.png`, {
					animations: "disabled",
					caret: "hide",
				});
			});
		}
	});

	test("表紙構図ごとに画像枠・ベール・題名ウェイトが定義どおりになる", async ({
		page,
	}) => {
		test.setTimeout(180_000);
		await routeBookletApi(page);
		const selectable = Array.from(COVER_LAYOUTS.values()).filter(
			(layout) => layout.selectable,
		);
		for (const layout of selectable) {
			const representative = V2_REPRESENTATIVE_SEEDS.find(
				({ expected }) => expected.coverLayoutId === layout.id,
			);
			if (!representative) {
				throw new Error(`表紙構図「${layout.id}」の代表シードがありません。`);
			}
			const { expected, seed } = representative;
			await page.goto(`/journeys/journey-1/booklet?seed=${seedToken(seed)}`);
			await expect(page.locator(".booklet-shell")).toHaveAttribute(
				"data-booklet-print-state",
				"ready",
			);
			const cover = page.locator(".booklet-document .booklet-page--cover");
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
			if (layout.id === "poster") {
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
						scaleX: coverRect.width / 148,
						scaleY: coverRect.height / 210,
						top: frameRect.top - coverRect.top,
						width: frameRect.width,
					};
				});
			const { imageFrame } = getCoverLayoutDefinition(layout.id);
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
			if (layout.veil === "none") {
				await expect(veil).toHaveCount(0);
			} else {
				await expect(veil).toHaveCount(1);
				await expect(veil).toHaveAttribute(
					"data-booklet-cover-veil-kind",
					layout.veil,
				);
				await expect(
					veil.locator(
						layout.veil === "radial" ? "radialGradient" : "linearGradient",
					),
				).toHaveCount(1);
			}
		}
	});

	test("代表テーマをA5 PDFとして出力できる", async ({ page }) => {
		await openBooklet(page, 0);
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
