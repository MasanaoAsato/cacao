import { expect, type Page, test } from "@playwright/test";
import {
	bookletFixtureJourneyId,
	routeBookletApi,
} from "./fixtures/booklet.js";
import {
	expectBookletPrintReady,
	seedToken,
} from "./support/booklet-assertions.js";

async function drawnDirectionIds(page: Page): Promise<Set<string>> {
	const effects = await page
		.locator(".booklet-document [data-direction-effect]")
		.evaluateAll((elements) =>
			elements.flatMap((element) =>
				(element.getAttribute("data-direction-effect") ?? "")
					.split(" ")
					.filter(Boolean)
					.flatMap((token) => {
						const id = token.split("/")[1]?.split(":")[0];
						return id ? [id] : [];
					}),
			),
		);
	return new Set(effects);
}

test("初期設定の複数seedはすべて単独方向で印刷できる", async ({ page }) => {
	test.skip(
		process.env.VITE_BOOKLET_MAX_DIRECTIONS !== "1",
		"初期設定の検証はVITE_BOOKLET_MAX_DIRECTIONS=1で実行する",
	);
	await routeBookletApi(page);
	for (const seed of [6, 16, 19, 32]) {
		await page.goto(
			`/journeys/${bookletFixtureJourneyId("default")}/booklet?seed=${seedToken(seed)}`,
		);
		await expectBookletPrintReady(page);
		const base = await page
			.locator(".booklet-shell")
			.getAttribute("data-booklet-direction-id");
		expect(base).toBeTruthy();
		expect(await drawnDirectionIds(page)).toEqual(new Set([base]));
		await expect(page.getByRole("button", { name: "PDFを印刷" })).toBeEnabled();
	}
});

test("上限2のビルドは同頁に2方向を描き、3方向には進まない", async ({
	page,
}) => {
	test.skip(process.env.VITE_BOOKLET_MAX_DIRECTIONS !== "2");
	await routeBookletApi(page);
	await page.goto(
		`/journeys/${bookletFixtureJourneyId("default")}/booklet?seed=${seedToken(16)}`,
	);
	await expectBookletPrintReady(page);
	expect((await drawnDirectionIds(page)).size).toBe(2);
});
