import { expect, type Page, test } from "@playwright/test";

/**
 * Served by the dev server so the fixture's own module graph, including the
 * product page CSS, is evaluated in the document under test.
 */
const FIXTURE_URL = "/e2e/fixtures/decor-placement.html";

/** 1px is about 0.26mm at 96dpi, so allow a little sub-pixel rounding. */
const MEASURE_TOLERANCE_MM = 0.4;
const TEXT_CLEARANCE_MM = 1;
const PAGE_RECT = { heightMm: 210, widthMm: 148, xMm: 0, yMm: 0 } as const;

type MeasuredRect = {
	readonly heightMm: number;
	readonly widthMm: number;
	readonly xMm: number;
	readonly yMm: number;
};

type MeasuredDecor = {
	readonly anchor: string | null;
	readonly asset: string | null;
	readonly connector: string | null;
	readonly declared: string | null;
	readonly frame: string | null;
	readonly layer: string | null;
	readonly rect: MeasuredRect;
	readonly rotation: string | null;
	readonly rotationFallback: string | null;
};

type MeasuredCase = {
	readonly decor: readonly MeasuredDecor[];
	readonly layers: readonly {
		readonly domIndex: number;
		readonly layer: string | null;
		readonly zIndex: string;
	}[];
	readonly photo: MeasuredRect | null;
	readonly texts: readonly {
		readonly rect: MeasuredRect;
		readonly role: string | null;
	}[];
};

async function openPlacementFixture(page: Page): Promise<void> {
	await page.goto(FIXTURE_URL);
	await expect(page.locator("[data-decor-placement]")).toBeVisible();
}

/** Reads the drawn page independently of the product's own measurement. */
async function measureCase(page: Page, caseId: string): Promise<MeasuredCase> {
	return page.locator(`[data-decor-case="${caseId}"]`).evaluate((root) => {
		const pageElement = root.querySelector("[data-booklet-page]");
		if (!pageElement) {
			throw new Error("ページがありません。");
		}
		const pageRect = pageElement.getBoundingClientRect();
		const scale = 148 / pageRect.width;
		const toMm = (element: Element) => {
			const rect = element.getBoundingClientRect();
			return {
				heightMm: rect.height * scale,
				widthMm: rect.width * scale,
				xMm: (rect.left - pageRect.left) * scale,
				yMm: (rect.top - pageRect.top) * scale,
			};
		};
		const photo = root.querySelector(".decor-placement__photo");
		return {
			decor: Array.from(
				root.querySelectorAll("[data-booklet-decor-bounds]"),
				(element) => ({
					anchor: element.getAttribute("data-booklet-decor-anchor"),
					asset: element.getAttribute("data-booklet-decor-asset"),
					connector: element.getAttribute("data-booklet-decor-connector"),
					declared: element.getAttribute("data-booklet-decor-bounds"),
					frame: element.getAttribute("data-booklet-decor-frame"),
					layer:
						element
							.closest("[data-booklet-decor-layer]")
							?.getAttribute("data-booklet-decor-layer") ?? null,
					rect: toMm(element),
					rotation: element.getAttribute("data-booklet-decor-rotation"),
					rotationFallback: element.getAttribute(
						"data-booklet-decor-rotation-fallback",
					),
				}),
			),
			layers: Array.from(
				root.querySelectorAll("[data-booklet-decor-layer]"),
				(element) => ({
					domIndex: Array.from(element.parentElement?.children ?? []).indexOf(
						element,
					),
					layer: element.getAttribute("data-booklet-decor-layer"),
					zIndex: getComputedStyle(element).zIndex,
				}),
			),
			photo: photo ? toMm(photo) : null,
			texts: Array.from(
				root.querySelectorAll("[data-booklet-text-role]"),
				(element) => ({
					rect: toMm(element),
					role: element.getAttribute("data-booklet-text-role"),
				}),
			),
		};
	});
}

function declaredRect(decor: MeasuredDecor): MeasuredRect {
	const [xMm, yMm, widthMm, heightMm] = (decor.declared ?? "")
		.split(",")
		.map(Number);
	if ([xMm, yMm, widthMm, heightMm].some((value) => !Number.isFinite(value))) {
		throw new Error(`装飾の境界「${decor.declared}」を読めません。`);
	}
	return {
		heightMm: heightMm as number,
		widthMm: widthMm as number,
		xMm: xMm as number,
		yMm: yMm as number,
	};
}

/** Distance between two rects; negative when they overlap. */
function gapMm(left: MeasuredRect, right: MeasuredRect): number {
	const horizontal = Math.max(
		right.xMm - (left.xMm + left.widthMm),
		left.xMm - (right.xMm + right.widthMm),
	);
	const vertical = Math.max(
		right.yMm - (left.yMm + left.heightMm),
		left.yMm - (right.yMm + right.heightMm),
	);
	return Math.max(horizontal, vertical);
}

function overlapsRect(left: MeasuredRect, right: MeasuredRect): boolean {
	return gapMm(left, right) < 0;
}

function containsRect(
	outer: MeasuredRect,
	inner: MeasuredRect,
	toleranceMm: number,
): boolean {
	return (
		inner.xMm >= outer.xMm - toleranceMm &&
		inner.yMm >= outer.yMm - toleranceMm &&
		inner.xMm + inner.widthMm <= outer.xMm + outer.widthMm + toleranceMm &&
		inner.yMm + inner.heightMm <= outer.yMm + outer.heightMm + toleranceMm
	);
}

async function expectCaseStatus(
	page: Page,
	caseId: string,
	status: "ready" | "error",
): Promise<void> {
	await expect(page.locator(`[data-decor-case="${caseId}"]`)).toHaveAttribute(
		"data-decor-status",
		status,
	);
}

test("予約領域がある紙面で装飾が文字を避けて配置される", async ({ page }) => {
	await openPlacementFixture(page);
	await expectCaseStatus(page, "reserved", "ready");
	const measured = await measureCase(page, "reserved");

	expect(measured.decor).toHaveLength(5);
	expect(measured.texts.map((item) => item.role).sort()).toEqual([
		"day-title",
		"spot-name",
		"spot-name",
	]);

	for (const decor of measured.decor) {
		const declared = declaredRect(decor);
		// Chromium reports the fill box of an SVG shape, so a stroked frame or
		// line measures inside the bounds the product validated. Either way the
		// drawn ink has to sit within them.
		expect(containsRect(declared, decor.rect, MEASURE_TOLERANCE_MM)).toBe(true);
		if (decor.asset !== null) {
			expect(decor.rect.widthMm).toBeCloseTo(declared.widthMm, 0);
			expect(decor.rect.heightMm).toBeCloseTo(declared.heightMm, 0);
		}
		// Everything stays on the A5 page.
		expect(containsRect(PAGE_RECT, declared, MEASURE_TOLERANCE_MM)).toBe(true);
	}

	// Only the paper ground and the frame's opaque face may sit under text.
	const overText = measured.decor.filter(
		(decor) => decor.asset !== "paper-torn-sheet" && decor.frame === null,
	);
	expect(overText).toHaveLength(3);
	for (const decor of overText) {
		for (const item of measured.texts) {
			expect(gapMm(declaredRect(decor), item.rect)).toBeGreaterThan(
				TEXT_CLEARANCE_MM - MEASURE_TOLERANCE_MM,
			);
		}
	}

	// The ground really does reach under the unit's text it sits behind.
	const ground = measured.decor.find(
		(decor) => decor.asset === "paper-torn-sheet",
	);
	const unitText = measured.texts.find((item) => item.role === "spot-name");
	if (!ground || !unitText) {
		throw new Error("紙片の下地と掲載単位の文字が見つかりません。");
	}
	expect(overlapsRect(ground.rect, unitText.rect)).toBe(true);
});

test("写真に重なる装飾は上の層に、紙片と線は下の層に描かれる", async ({
	page,
}) => {
	await openPlacementFixture(page);
	await expectCaseStatus(page, "reserved", "ready");
	const measured = await measureCase(page, "reserved");

	const under = measured.layers.find(
		(layer) => layer.layer === "under-content",
	);
	const over = measured.layers.find((layer) => layer.layer === "over-image");
	if (!under || !over) {
		throw new Error("装飾の層がありません。");
	}
	expect(under.zIndex).toBe("0");
	expect(over.zIndex).toBe("2");
	expect(under.domIndex).toBeLessThan(over.domIndex);

	const tape = measured.decor.find((decor) => decor.asset === "paper-tape");
	const frame = measured.decor.find((decor) => decor.frame !== null);
	const connector = measured.decor.find((decor) => decor.connector !== null);
	if (!tape || !frame || !connector || !measured.photo) {
		throw new Error("写真・テープ・枠・接続線が揃っていません。");
	}
	expect(tape.layer).toBe("over-image");
	expect(frame.layer).toBe("over-image");
	expect(connector.layer).toBe("under-content");
	expect(connector.connector).toBe("unit-1>unit-2");
	// Covering the photograph is allowed; covering text is not.
	expect(overlapsRect(tape.rect, measured.photo)).toBe(true);
	for (const item of measured.texts) {
		expect(overlapsRect(tape.rect, item.rect)).toBe(false);
	}
});

test("回転で収まらない装飾は0度へ一度だけ退避して記録される", async ({
	page,
}) => {
	await openPlacementFixture(page);
	await expectCaseStatus(page, "rotation-fallback", "ready");
	await expect(
		page.locator('[data-decor-case="rotation-fallback"]'),
	).toHaveAttribute("data-decor-rotation-fallbacks", "title-1:0");

	const measured = await measureCase(page, "rotation-fallback");
	const [asset] = measured.decor;
	if (!asset) {
		throw new Error("装飾がありません。");
	}
	expect(asset.rotation).toBe("0.00");
	expect(asset.rotationFallback).toBe("true");
	expect(asset.declared).toBe("18.00,18.00,10.00,10.00");
	for (const item of measured.texts) {
		expect(gapMm(asset.rect, item.rect)).toBeGreaterThan(
			TEXT_CLEARANCE_MM - MEASURE_TOLERANCE_MM,
		);
	}
});

test("衝突と未登録素材は装飾を消さずに準備エラーになる", async ({ page }) => {
	await openPlacementFixture(page);
	for (const [caseId, code] of [
		["collision", "decor-collision"],
		["unregistered", "decor-unregistered"],
	] as const) {
		await expectCaseStatus(page, caseId, "error");
		const element = page.locator(`[data-decor-case="${caseId}"]`);
		await expect(element).toHaveAttribute("data-decor-error", code);
		// No layer is drawn, so a dropped decor can never look like a success.
		await expect(element.locator("[data-booklet-decor-layer]")).toHaveCount(0);
	}
});

test("長い見出しでも文字領域に装飾が侵入しない", async ({ page }) => {
	await openPlacementFixture(page);
	await expectCaseStatus(page, "long-title", "ready");
	const long = await measureCase(page, "long-title");
	const short = await measureCase(page, "reserved");

	const longTitle = long.texts.find((item) => item.role === "day-title");
	const shortTitle = short.texts.find((item) => item.role === "day-title");
	if (!longTitle || !shortTitle) {
		throw new Error("日見出しがありません。");
	}
	// The heading wraps, so the protected rect really is the larger one.
	expect(longTitle.rect.heightMm).toBeGreaterThan(shortTitle.rect.heightMm);

	const [asset] = long.decor;
	if (!asset) {
		throw new Error("装飾がありません。");
	}
	expect(asset.anchor).toBe("title-1");
	expect(gapMm(asset.rect, longTitle.rect)).toBeGreaterThan(
		TEXT_CLEARANCE_MM - MEASURE_TOLERANCE_MM,
	);
});
