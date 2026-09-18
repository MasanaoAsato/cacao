/** @vitest-environment jsdom */

import { describe, expect, it } from "vitest";
import type { ResolvedBookletDesign } from "../../../booklet/family";
import type { BookletModel } from "../../../booklet/model";
import {
	DecorPlacementError,
	type FamilyDecoration,
} from "../../../theme/families/decorPlacement";
import type { RequestedBookletTheme } from "../../../theme/types";
import { BookletLayoutError } from "../useBookletPagePlan";
import {
	isCurrentFamilyPagePlan,
	prepareFamilyDecor,
	readDecorAnchors,
	readProtectedTextRects,
} from "./useFamilyPagePlan";

const model = {} as BookletModel;
const design = {
	renderKey: "legacy:v2-00000000:legacy-full:key",
} as ResolvedBookletDesign;

describe("isCurrentFamilyPagePlan", () => {
	it("正常系: 同じモデルとrenderKeyで準備済みならtrueを返す", () => {
		expect(
			isCurrentFamilyPagePlan(
				{ preparedModel: model, preparedRenderKey: design.renderKey },
				model,
				design,
			),
		).toBe(true);
	});

	it("異常系: 別のモデルで計測した結果を印刷準備済みにしない", () => {
		expect(
			isCurrentFamilyPagePlan(
				{
					preparedModel: {} as BookletModel,
					preparedRenderKey: design.renderKey,
				},
				model,
				design,
			),
		).toBe(false);
	});

	it("境界値: 同一モデルでもrenderKeyが異なれば印刷準備済みにしない", () => {
		expect(
			isCurrentFamilyPagePlan(
				{ preparedModel: model, preparedRenderKey: "previous-render-key" },
				model,
				design,
			),
		).toBe(false);
	});
});

/** 4px per mm, so a 148mm page is 592px wide. */
const PX_PER_MM = 4;

function stubRect(
	element: Element,
	leftMm: number,
	topMm: number,
	widthMm: number,
	heightMm: number,
): void {
	const left = leftMm * PX_PER_MM;
	const top = topMm * PX_PER_MM;
	const width = widthMm * PX_PER_MM;
	const height = heightMm * PX_PER_MM;
	element.getBoundingClientRect = () =>
		({
			bottom: top + height,
			height,
			left,
			right: left + width,
			toJSON: () => ({}),
			top,
			width,
			x: left,
			y: top,
		}) as DOMRect;
}

const familyDesign: ResolvedBookletDesign = {
	comparisonKey: "atlas-grid.atlas-ink.atlas-headline",
	compositionId: "atlas-headline",
	decorAssetIds: ["atlas-compass"],
	familyId: "atlas-grid",
	fontFamilies: [],
	paletteId: "atlas-ink",
	policyId: "legacy-full",
	renderKey: "atlas-grid:v2-0000002a:legacy-full:atlas-grid.atlas-ink",
	requestedTheme: {} as RequestedBookletTheme,
	seedToken: "v2-0000002a",
};

const COMPASS: FamilyDecoration = {
	anchorId: "title-1",
	assetId: "atlas-compass",
	color: "accent",
	kind: "asset",
	layer: "under-content",
	offsetMm: [0, 0],
	rotateDeg: [0, 0],
	sizeMm: 10,
};

/** A family page with one title anchor, one unit anchor and drawn decor. */
function buildPage(
	options: {
		readonly anchorKind?: string;
		readonly drawnBounds?: string | null;
	} = {},
): HTMLElement {
	const root = document.createElement("main");
	root.innerHTML = `
		<article data-booklet-page="true" data-page-id="page-1">
			<svg data-booklet-decor-layer="under-content">
				<g data-booklet-decor-bounds=""></g>
			</svg>
			<div data-booklet-anchor="title-1" data-booklet-anchor-kind="${options.anchorKind ?? "title"}" data-booklet-anchor-reserve="2">
				<h2 data-booklet-text-role="day-title">8月28日</h2>
			</div>
			<div data-booklet-anchor="unit-1" data-booklet-anchor-kind="unit"></div>
		</article>`;
	const page = root.querySelector<HTMLElement>("[data-booklet-page]");
	const drawn = root.querySelector("[data-booklet-decor-bounds]");
	if (!page || !drawn) {
		throw new Error("検証用ページを組み立てられませんでした。");
	}
	const bounds = options.drawnBounds ?? "10.00,10.00,10.00,10.00";
	drawn.setAttribute("data-booklet-decor-bounds", bounds);
	const stubBy = (
		selector: string,
		leftMm: number,
		topMm: number,
		widthMm: number,
		heightMm: number,
	) => {
		const element = root.querySelector(selector);
		if (!element) {
			throw new Error(`${selector}がありません。`);
		}
		stubRect(element, leftMm, topMm, widthMm, heightMm);
	};
	stubRect(page, 0, 0, 148, 210);
	stubBy("[data-booklet-anchor='title-1']", 10, 10, 100, 20);
	stubBy("[data-booklet-text-role]", 30, 10, 80, 20);
	stubBy("[data-booklet-anchor='unit-1']", 10, 40, 100, 30);
	return root;
}

describe("実ページからの装飾計測", () => {
	it("正常系: anchorの種類・予約領域・mm矩形を読み取る", () => {
		const page = buildPage().querySelector<HTMLElement>("[data-booklet-page]");
		if (!page) {
			throw new Error("ページがありません。");
		}
		expect(readDecorAnchors(page)).toEqual([
			{
				id: "title-1",
				kind: "title",
				rect: { heightMm: 20, widthMm: 100, xMm: 10, yMm: 10 },
				reserveMm: 2,
			},
			{
				id: "unit-1",
				kind: "unit",
				rect: { heightMm: 30, widthMm: 100, xMm: 10, yMm: 40 },
				reserveMm: 0,
			},
		]);
	});

	it("正常系: 計測と表示で共通のtext-roleから文字矩形を読み取る", () => {
		const page = buildPage().querySelector<HTMLElement>("[data-booklet-page]");
		if (!page) {
			throw new Error("ページがありません。");
		}
		expect(readProtectedTextRects(page)).toEqual([
			{
				rect: { heightMm: 20, widthMm: 80, xMm: 30, yMm: 10 },
				role: "day-title",
			},
		]);
	});

	it("正常系: 描画済みの装飾と解決した配置が一致すればページを返す", () => {
		const pages = prepareFamilyDecor(
			buildPage(),
			familyDesign,
			new Map([["page-1", [COMPASS]]]),
		);
		expect(pages).toHaveLength(1);
		expect(pages[0]?.pageId).toBe("page-1");
		expect(pages[0]?.decor.items).toHaveLength(1);
		expect(pages[0]?.decor.rotationFallbacks).toEqual([]);
	});

	it("境界値: CSSピクセル変換による0.05mm以内の丸め差を許容する", () => {
		const pages = prepareFamilyDecor(
			buildPage({ drawnBounds: "10.04,9.96,10.03,9.97" }),
			familyDesign,
			new Map([["page-1", [COMPASS]]]),
		);

		expect(pages).toHaveLength(1);
	});

	it("異常系: 描画された境界が配置と違えば準備完了にしない", () => {
		expect(() =>
			prepareFamilyDecor(
				buildPage({ drawnBounds: "10.00,10.00,12.00,12.00" }),
				familyDesign,
				new Map([["page-1", [COMPASS]]]),
			),
		).toThrow(BookletLayoutError);
		expect(() =>
			prepareFamilyDecor(buildPage(), familyDesign, new Map()),
		).toThrow(BookletLayoutError);
	});

	it("異常系: 紙面にないページへの装飾指定を黙って捨てない", () => {
		expect(() =>
			prepareFamilyDecor(
				buildPage(),
				familyDesign,
				new Map([
					["page-1", [COMPASS]],
					["page-9", [COMPASS]],
				]),
			),
		).toThrow(BookletLayoutError);
	});

	it("異常系: 未知のanchor種類は定義エラーとして扱う", () => {
		expect(() =>
			prepareFamilyDecor(
				buildPage({ anchorKind: "photo" }),
				familyDesign,
				new Map([["page-1", [COMPASS]]]),
			),
		).toThrow(DecorPlacementError);
	});

	it("境界値系: ページ幅を計測できなければmm換算しない", () => {
		const root = buildPage();
		const page = root.querySelector<HTMLElement>("[data-booklet-page]");
		if (!page) {
			throw new Error("ページがありません。");
		}
		stubRect(page, 0, 0, 0, 210);
		expect(() => readDecorAnchors(page)).toThrow(BookletLayoutError);
	});
});
