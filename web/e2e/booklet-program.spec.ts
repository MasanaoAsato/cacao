import { expect, type Page, test } from "@playwright/test";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import {
	type BookletFixtureScenario,
	bookletFixtureJourneyId,
	DENSE_BOOKLET_EXPECTED_UNITS,
	routeBookletApi,
} from "./fixtures/booklet.js";
import {
	expectArtworkClearOfText,
	expectBookletPrintReady,
	expectContentInsidePages,
	expectNoHiddenText,
	seedToken,
} from "./support/booklet-assertions.js";

/**
 * The product entry (25.4) in a real browser, font and layout: what jsdom
 * cannot show. Module rules, compiler choices and catalog coverage are unit
 * tests; every module and many seeds are the release check of 25.5.
 *
 * Seeds on the default fixture at this catalog revision. Each test checks
 * that its seed still has the shape it stands for, so a catalog change that
 * moves a seed fails with that message instead of silently testing less.
 */
const SINGLE_SEED = 6; // one direction on every page
const FUSION_SEED = 16; // two directions on the same page
const CHAPTER_SEED = 19; // directions change between days, with divider and endcap
const DENSE_SEED = 32; // continuation pages and a checklist memo that references units
const DEFAULT_UNIT_COUNT = 2;
/** A5 in PDF points. */
const A5_PT = { height: (210 / 25.4) * 72, width: (148 / 25.4) * 72 };

async function openProgram(
	page: Page,
	seed: number,
	scenario: BookletFixtureScenario = "default",
): Promise<void> {
	await routeBookletApi(page, scenario);
	await page.goto(
		`/journeys/${bookletFixtureJourneyId(scenario)}/booklet?seed=${seedToken(seed)}`,
	);
}

type DrawnPage = {
	readonly directions: readonly string[];
	readonly kinds: readonly string[];
	readonly moduleId: string | null;
	readonly number: string | null;
	readonly pageId: string | null;
	readonly sceneId: string | null;
	readonly sceneKind: string | null;
};

/** Printed pages with the direction contributions drawn on each. */
async function drawnPages(page: Page): Promise<readonly DrawnPage[]> {
	return page
		.locator(".booklet-document [data-booklet-page]")
		.evaluateAll((pages) =>
			pages.map((element) => {
				const tokens = Array.from(
					element.querySelectorAll("[data-direction-effect]"),
				).flatMap((marked) =>
					(marked.getAttribute("data-direction-effect") ?? "")
						.split(" ")
						.filter(Boolean),
				);
				// A token is `region/directionId:kind`.
				const parsed = tokens.map((token) => {
					const [directionId = "", kind = ""] = (
						token.split("/")[1] ?? ""
					).split(":");
					return { directionId, kind };
				});
				return {
					directions: [...new Set(parsed.map((item) => item.directionId))],
					kinds: [...new Set(parsed.map((item) => item.kind))],
					moduleId: element.getAttribute("data-module-id"),
					number: element.getAttribute("data-page-number"),
					pageId: element.getAttribute("data-page-id"),
					sceneId: element.getAttribute("data-scene-id"),
					sceneKind: element.getAttribute("data-scene-kind"),
				};
			}),
		);
}

async function unitIds(page: Page): Promise<readonly string[]> {
	return page
		.locator(".booklet-document [data-unit-id]")
		.evaluateAll((elements) =>
			elements.map((element) => element.getAttribute("data-unit-id") ?? ""),
		);
}

/**
 * Printing is allowed only after the whole program was checked, every unit is
 * drawn once, and nothing is clipped, outside its page or under artwork.
 */
async function expectPrintableProgram(
	page: Page,
	expectedUnitCount: number,
): Promise<readonly DrawnPage[]> {
	await expectBookletPrintReady(page);
	const shell = page.locator(".booklet-shell");
	await expect(shell).toHaveAttribute("data-booklet-direction-id", /.+/);
	await expect(shell).toHaveAttribute("data-booklet-catalog-revision", /.+/);
	await expect(shell).toHaveAttribute("data-booklet-comparison-key", /.+/);
	// A program never carries an invented single family ID.
	await expect(shell).not.toHaveAttribute("data-booklet-family", /.*/);
	await expect(page.getByRole("button", { name: "PDFを印刷" })).toBeEnabled();

	const pages = await drawnPages(page);
	expect(pages[0]?.pageId).toBe("cover/cover");
	expect(pages.map((item) => item.number)).toEqual(
		pages.map((_item, index) => String(index + 1)),
	);
	// Page IDs come from the scene and its local page, never DOM order.
	for (const item of pages)
		expect(item.pageId?.startsWith(`${item.sceneId}/`)).toBe(true);

	const units = await unitIds(page);
	expect(units).toHaveLength(expectedUnitCount);
	expect(new Set(units).size).toBe(expectedUnitCount);
	// References on memo pages are never counted as body units.
	expect(
		await page
			.locator(".booklet-document [data-unit-ref][data-unit-id]")
			.count(),
	).toBe(0);
	await expectNoHiddenText(page);
	await expectContentInsidePages(page);
	await expectArtworkClearOfText(page);
	return pages;
}

test.describe("製品入口のprogram描画", () => {
	test("正常系: 単独方向のしおりは全体の確認後にだけ印刷でき、全予定を一度ずつ描く", async ({
		page,
	}) => {
		await openProgram(page, SINGLE_SEED);
		const pages = await expectPrintableProgram(page, DEFAULT_UNIT_COUNT);
		const directions = new Set(pages.flatMap((item) => item.directions));
		expect(directions.size, `seed ${SINGLE_SEED} は単独方向ではない`).toBe(1);
	});

	test("正常系: 同じページで融合した方向の寄与が、崩れずに同じ紙面へ描かれる", async ({
		page,
	}) => {
		await openProgram(page, FUSION_SEED);
		const pages = await expectPrintableProgram(page, DEFAULT_UNIT_COUNT);
		expect(
			pages.some((item) => item.directions.length >= 2),
			`seed ${FUSION_SEED} は同じページの融合ではない`,
		).toBe(true);
	});

	test("正常系: 章変化で別moduleの場面がつながっても通し番号と頁の境界が保たれる", async ({
		page,
	}) => {
		await openProgram(page, CHAPTER_SEED);
		const pages = await expectPrintableProgram(page, DEFAULT_UNIT_COUNT);
		expect(
			pages.some((item) => item.kinds.includes("chapter")),
			`seed ${CHAPTER_SEED} は章変化ではない`,
		).toBe(true);
		expect(new Set(pages.map((item) => item.moduleId)).size).toBeGreaterThan(1);
		expect(pages.map((item) => item.sceneKind)).toEqual(
			expect.arrayContaining(["divider", "endcap"]),
		);
	});

	test("境界値系: 継続頁が必要な高密度の旅程でも入力順を保ち、memoの参照を二重に数えない", async ({
		page,
	}) => {
		await openProgram(page, DENSE_SEED, "dense");
		const pages = await expectPrintableProgram(
			page,
			DENSE_BOOKLET_EXPECTED_UNITS.length,
		);
		expect(await unitIds(page)).toEqual(
			DENSE_BOOKLET_EXPECTED_UNITS.map((unit) => unit.id),
		);
		const dayScenes = new Set(
			pages
				.filter((item) => item.sceneKind === "day")
				.map((item) => item.sceneId),
		);
		// More day pages than day scenes means a scene continued on a new page.
		expect(
			pages.filter((item) => item.sceneKind === "day").length,
		).toBeGreaterThan(dayScenes.size);
		expect(
			pages.some((item) => item.sceneKind === "memo"),
			`seed ${DENSE_SEED} にmemoがない`,
		).toBe(true);
		expect(
			await page.locator(".booklet-document [data-unit-ref]").count(),
		).toBeGreaterThan(0);
	});

	test("正常系: 場面をまたぐPDFも紙面と同じ頁数で、すべてA5になる", async ({
		page,
	}) => {
		await openProgram(page, CHAPTER_SEED);
		await expectBookletPrintReady(page);
		const pageCount = await page
			.locator(".booklet-document [data-booklet-page]")
			.count();
		await page.emulateMedia({ media: "print" });
		const pdf = await page.pdf({
			preferCSSPageSize: true,
			printBackground: true,
		});
		const document = await getDocument({ data: new Uint8Array(pdf) }).promise;
		expect(document.numPages).toBe(pageCount);
		for (let number = 1; number <= document.numPages; number += 1) {
			const [left = 0, bottom = 0, right = 0, top = 0] = (
				await document.getPage(number)
			).view;
			expect(right - left).toBeCloseTo(A5_PT.width, 0);
			expect(top - bottom).toBeCloseTo(A5_PT.height, 0);
		}
	});

	test("異常系: 旅程画像を読み込めないときは印刷させず、失敗を隠さずに表示する", async ({
		page,
	}) => {
		await routeBookletApi(page);
		// Registered last, so it runs before the fixture's image route.
		await page.route("**/journey-images/**/content", (route) =>
			route.fulfill({ status: 404 }),
		);
		await page.goto(
			`/journeys/${bookletFixtureJourneyId("default")}/booklet?seed=${seedToken(SINGLE_SEED)}`,
		);
		const shell = page.locator(".booklet-shell");
		await expect(shell).toHaveAttribute("data-booklet-print-state", "error");
		await expect(shell).toHaveAttribute("data-booklet-print-error", /画像/);
		await expect(page.getByRole("status")).toContainText(
			"印刷準備に失敗しました",
		);
		await expect(
			page.getByRole("button", { name: "PDFを印刷" }),
		).toBeDisabled();
		await expect(
			page.getByRole("button", { name: "PDFをダウンロード" }),
		).toBeDisabled();
	});

	test("異常系: 再抽選で別seedへ移ると、新しいprogramの確認が終わるまで印刷できない", async ({
		page,
	}) => {
		await openProgram(page, SINGLE_SEED);
		await expectBookletPrintReady(page);
		const before = await page
			.locator(".booklet-shell")
			.getAttribute("data-booklet-comparison-key");
		await page.evaluate(() => {
			crypto.getRandomValues = ((values: Uint32Array) => {
				values[0] = 8;
				return values;
			}) as typeof crypto.getRandomValues;
		});
		await page.getByRole("button", { name: "別のデザインを試す" }).click();
		await expect(page).toHaveURL(/seed=v2-00000008/);
		await expectPrintableProgram(page, DEFAULT_UNIT_COUNT);
		await expect(page.locator(".booklet-shell")).not.toHaveAttribute(
			"data-booklet-comparison-key",
			before ?? "",
		);
	});

	test("正常系: 同じURLを開き直すと同じしおりになる", async ({ page }) => {
		await openProgram(page, FUSION_SEED);
		await expectBookletPrintReady(page);
		const shell = page.locator(".booklet-shell");
		const before = {
			key: await shell.getAttribute("data-booklet-comparison-key"),
			pages: await drawnPages(page),
			units: await unitIds(page),
		};
		await page.reload();
		await expectBookletPrintReady(page);
		expect({
			key: await shell.getAttribute("data-booklet-comparison-key"),
			pages: await drawnPages(page),
			units: await unitIds(page),
		}).toEqual(before);
	});
});
