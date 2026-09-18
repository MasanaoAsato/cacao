/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { render } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import type {
	EditorialArrivalUnit,
	EditorialBooklet,
} from "../../../booklet/editorialModel";
import type { PlayfulRoutePagePlan } from "../../../booklet/families/playfulRoute";
import type { ResolvedBookletDesign } from "../../../booklet/family";
import { createBookletTheme } from "../../../theme/bookletTheme";
import type {
	PlayfulRouteCompositionId,
	PlayfulRouteDecorVariantId,
} from "../../../theme/families/playfulRoute";
import { playfulRouteDecorVariantFor } from "../../../theme/families/playfulRoute";
import {
	ensurePlayfulRouteContent,
	PlayfulRouteDocument,
	playfulRouteDecorDefinition,
} from "./PlayfulRoute";
import { prepareFamilyDecor } from "./useFamilyPagePlan";

function unit(id: string, name: string): EditorialArrivalUnit {
	return {
		description: null,
		durationMinutes: 35,
		id,
		legId: `leg-${id}`,
		route: null,
		spotId: `spot-${id}`,
		spotName: name,
		startAt: "2026-09-16T09:00:00+09:00",
		stayCost: null,
		timeLabel: "09:00",
		transportCost: null,
		transportMode: "train",
	};
}

const booklet: EditorialBooklet = {
	cover: {
		budget: null,
		image: {
			contentUrl: "/cover.png",
			height: 1200,
			mediaType: "image/png",
			visualStyle: null,
			width: 800,
		},
		period: {
			end_date: "2026-09-18T00:00:00+09:00",
			start_date: "2026-09-16T00:00:00+09:00",
		},
		route: null,
		title: "金沢",
	},
	days: [
		{
			date: "2026-09-16T00:00:00+09:00",
			dayNumber: 1,
			id: "day-1",
			illustration: null,
			units: [unit("unit-1", "近江町市場"), unit("unit-2", "兼六園")],
		},
	],
	journeyId: "journey-1",
	policyId: "route",
};

function designFor(
	decorVariantId: PlayfulRouteDecorVariantId,
	compositionId: PlayfulRouteCompositionId = "zigzag",
): ResolvedBookletDesign {
	const comparisonKey = `playful-route.berry-sun.${compositionId}.${decorVariantId}`;
	return {
		comparisonKey,
		compositionId,
		decorAssetIds: playfulRouteDecorVariantFor(decorVariantId).decorAssetIds,
		decorVariantId,
		familyId: "playful-route",
		fontFamilies: ["Dela Gothic One", "M PLUS Rounded 1c", "Noto Sans JP"],
		paletteId: "berry-sun",
		policyId: "route",
		renderKey: `playful-route:v2-0000001c:route:${comparisonKey}`,
		requestedTheme: createBookletTheme({ value: 28, version: "v2" }),
		seedToken: "v2-0000001c",
	};
}

const design = designFor("sunny");

const PX_PER_MM = 4;

function stubRect(
	element: Element,
	xMm: number,
	yMm: number,
	widthMm: number,
	heightMm: number,
): void {
	element.getBoundingClientRect = () =>
		({
			bottom: (yMm + heightMm) * PX_PER_MM,
			height: heightMm * PX_PER_MM,
			left: xMm * PX_PER_MM,
			right: (xMm + widthMm) * PX_PER_MM,
			toJSON: () => ({}),
			top: yMm * PX_PER_MM,
			width: widthMm * PX_PER_MM,
			x: xMm * PX_PER_MM,
			y: yMm * PX_PER_MM,
		}) as DOMRect;
}

function prepareRenderedDecor(
	container: HTMLElement,
	pagePlan: readonly PlayfulRoutePagePlan[],
	resolvedDesign: ResolvedBookletDesign,
): void {
	for (const pageElement of container.querySelectorAll<HTMLElement>(
		"[data-booklet-page]",
	)) {
		stubRect(pageElement, 0, 0, 148, 210);
	}
	for (const text of container.querySelectorAll<HTMLElement>(
		"[data-booklet-text-role]",
	)) {
		stubRect(text, 0, 0, 0, 0);
	}
	for (const page of pagePlan) {
		const definition = playfulRouteDecorDefinition(
			page,
			resolvedDesign.compositionId,
			resolvedDesign.decorVariantId,
			booklet,
		);
		for (const anchor of definition.anchors) {
			const element = container.querySelector<HTMLElement>(
				`[data-page-id="${page.pageId}"] [data-booklet-anchor="${anchor.id}"]`,
			);
			if (!element) {
				throw new Error(`装飾基準「${anchor.id}」がありません。`);
			}
			stubRect(
				element,
				anchor.rect.xMm,
				anchor.rect.yMm,
				anchor.rect.widthMm,
				anchor.rect.heightMm,
			);
		}
	}
	prepareFamilyDecor(
		container,
		resolvedDesign,
		new Map(
			pagePlan.map((page) => [
				page.pageId,
				playfulRouteDecorDefinition(
					page,
					resolvedDesign.compositionId,
					resolvedDesign.decorVariantId,
					booklet,
				).decorations,
			]),
		),
	);
}

describe("PlayfulRouteDocument", () => {
	it("正常系: 日内番号・時刻・訪問先・移動を元の順で描く", () => {
		const pagePlan: readonly PlayfulRoutePagePlan[] = [
			{ kind: "cover", pageId: "cover" },
			{
				blockHeightsMm: [32, 32],
				continuation: false,
				dayIndex: 0,
				kind: "day",
				layoutVariant: "selected",
				pageId: "day-1",
				unitIndexes: [0, 1],
			},
		];
		const { container } = render(
			<PlayfulRouteDocument
				booklet={booklet}
				design={design}
				pagePlan={pagePlan}
				rootRef={createRef<HTMLElement>()}
				titleSizePt={40}
			/>,
		);

		const blocks = container.querySelectorAll(".playful-route-block");
		expect(blocks).toHaveLength(2);
		expect(blocks[0]?.textContent).toContain("01");
		expect(blocks[1]?.textContent).toContain("02");
		expect(blocks[0]?.textContent).toContain("電車・35分");
		expect(container.textContent).not.toContain("説明");
		expect(
			container.querySelector("[data-booklet-decor-connector]"),
		).toHaveAttribute(
			"data-booklet-decor-connector",
			"route-unit-unit-1>route-unit-unit-2",
		);
		const documentRoot =
			container.querySelector<HTMLElement>(".booklet-document");
		expect(documentRoot).not.toBeNull();
		expect(() =>
			ensurePlayfulRouteContent(documentRoot as HTMLElement, booklet, pagePlan),
		).not.toThrow();
	});

	it("異常系: ページ計画にない日を描画しない", () => {
		const pagePlan: readonly PlayfulRoutePagePlan[] = [
			{ kind: "cover", pageId: "cover" },
			{
				blockHeightsMm: [32],
				continuation: false,
				dayIndex: 9,
				kind: "day",
				layoutVariant: "selected",
				pageId: "missing-day",
				unitIndexes: [0],
			},
		];
		const { container } = render(
			<PlayfulRouteDocument
				booklet={booklet}
				design={design}
				pagePlan={pagePlan}
				rootRef={createRef<HTMLElement>()}
				titleSizePt={40}
			/>,
		);

		expect(container.querySelector(".playful-route-block")).toBeNull();
		expect(() =>
			ensurePlayfulRouteContent(
				container.querySelector(".booklet-document") as HTMLElement,
				booklet,
				pagePlan,
			),
		).toThrow("掲載モデルにありません");
	});

	it.each([
		["zigzag", "sunny"],
		["zigzag", "walking"],
		["ribbon", "sunny"],
		["ribbon", "walking"],
	] as const)(
		"境界値: %s・%sの実測anchor・折れ線・描画済み装飾が一致する",
		(compositionId, decorVariantId) => {
			const resolvedDesign = designFor(decorVariantId, compositionId);
			const pagePlan: readonly PlayfulRoutePagePlan[] = [
				{ kind: "cover", pageId: `cover-${compositionId}` },
				{
					blockHeightsMm: [32, 32],
					continuation: true,
					dayIndex: 0,
					kind: "day",
					layoutVariant: "compact-header",
					pageId: `day-${compositionId}`,
					unitIndexes: [0, 1],
				},
			];
			const { container } = render(
				<PlayfulRouteDocument
					booklet={booklet}
					design={resolvedDesign}
					pagePlan={pagePlan}
					rootRef={createRef<HTMLElement>()}
					titleSizePt={40}
				/>,
			);

			expect(() =>
				prepareRenderedDecor(container, pagePlan, resolvedDesign),
			).not.toThrow();
			expect(
				container.querySelector(
					`[data-page-id="day-${compositionId}"] .playful-route-day-header__image`,
				),
			).toBeNull();
			expect(
				container.querySelector("[data-booklet-decor-connector]"),
			).toHaveAttribute("points");
			expect(
				container.querySelector(`[data-page-id="day-${compositionId}"]`),
			).toHaveAttribute("data-booklet-composition", "compact-header");
		},
	);
});

describe("playful-routeの装飾パターン描画", () => {
	const dayPage: Extract<PlayfulRoutePagePlan, { readonly kind: "day" }> = {
		blockHeightsMm: [32, 32],
		continuation: false,
		dayIndex: 0,
		kind: "day",
		layoutVariant: "selected",
		pageId: "day-1",
		unitIndexes: [0, 1],
	};

	it("正常系: walkingは同じ予約領域に足跡と曲がった矢印を置く", () => {
		const cover = playfulRouteDecorDefinition(
			{ kind: "cover", pageId: "cover" },
			"zigzag",
			"walking",
			booklet,
		);

		expect(cover.decorations).toEqual([
			expect.objectContaining({
				anchorId: "playful-cover-sun",
				assetId: "playful-sun",
				color: "muted",
				sizeMm: 20,
			}),
			expect.objectContaining({
				anchorId: "playful-cover-bag",
				assetId: "playful-footprints",
				color: "accent",
				offsetMm: [0, 0],
				rotateDeg: [0, 0],
				sizeMm: 24,
			}),
			expect.objectContaining({
				anchorId: "playful-cover-burst",
				assetId: "playful-curved-arrow",
				color: "border",
				offsetMm: [0, 2],
				rotateDeg: [0, 0],
				sizeMm: 8,
			}),
		]);
		// The reserved regions keep 20.9's rects; only the artwork changes.
		expect(cover.anchors).toEqual(
			playfulRouteDecorDefinition(
				{ kind: "cover", pageId: "cover" },
				"zigzag",
				"sunny",
				booklet,
			).anchors,
		);
	});

	it.each(["sunny", "walking"] as const)(
		"正常系: %sは本文下部の装飾領域を自分の素材で埋める",
		(decorVariantId) => {
			const day = playfulRouteDecorDefinition(
				dayPage,
				"zigzag",
				decorVariantId,
				booklet,
			);

			expect(day.anchors.at(-1)).toMatchObject({
				id: "playful-day-squiggle",
				rect: { heightMm: 8, widthMm: 24, xMm: 62, yMm: 194 },
			});
			expect(day.decorations.at(-1)).toEqual(
				expect.objectContaining({
					anchorId: "playful-day-squiggle",
					assetId:
						decorVariantId === "sunny"
							? "playful-squiggle"
							: "playful-curved-arrow",
					color: "accent",
					offsetMm: [0, 0],
					sizeMm: 8,
				}),
			);
		},
	);

	it.each(["sunny", "walking"] as const)(
		"正常系: %sを観測属性へ出し、表紙と本文の両方で描く",
		(decorVariantId) => {
			const resolvedDesign = designFor(decorVariantId);
			const pagePlan: readonly PlayfulRoutePagePlan[] = [
				{ kind: "cover", pageId: "cover" },
				dayPage,
			];
			const { container } = render(
				<PlayfulRouteDocument
					booklet={booklet}
					design={resolvedDesign}
					pagePlan={pagePlan}
					rootRef={createRef<HTMLElement>()}
					titleSizePt={40}
				/>,
			);

			expect(container.querySelector(".booklet-document")).toHaveAttribute(
				"data-booklet-decor-variant",
				decorVariantId,
			);
			prepareRenderedDecor(container, pagePlan, resolvedDesign);
			const drawn = Array.from(
				container.querySelectorAll("[data-booklet-decor-asset]"),
				(element) => element.getAttribute("data-booklet-decor-asset"),
			);
			expect(drawn).toEqual(
				decorVariantId === "sunny"
					? ["playful-sun", "playful-bag", "playful-burst", "playful-squiggle"]
					: [
							"playful-sun",
							"playful-footprints",
							"playful-curved-arrow",
							"playful-curved-arrow",
						],
			);
			expect(
				container.querySelector(
					'[data-page-id="cover"] [data-booklet-decor-anchor="playful-cover-burst"]',
				),
			).toHaveAttribute(
				"data-booklet-decor-bounds",
				decorVariantId === "sunny"
					? "10.00,68.00,24.00,12.00"
					: "10.00,70.00,24.00,8.00",
			);
		},
	);

	it("正常系: wide-ribbonへ退避しても選んだパターンを引き継ぐ", () => {
		const resolvedDesign = designFor("walking");
		const pagePlan: readonly PlayfulRoutePagePlan[] = [
			{ kind: "cover", pageId: "cover" },
			{ ...dayPage, layoutVariant: "wide-ribbon" },
		];
		const { container } = render(
			<PlayfulRouteDocument
				booklet={booklet}
				design={resolvedDesign}
				pagePlan={pagePlan}
				rootRef={createRef<HTMLElement>()}
				titleSizePt={40}
			/>,
		);

		expect(() =>
			prepareRenderedDecor(container, pagePlan, resolvedDesign),
		).not.toThrow();
		expect(
			container.querySelectorAll(
				'[data-page-id="day-1"] [data-booklet-decor-asset="playful-curved-arrow"]',
			),
		).toHaveLength(1);
	});

	it("異常系: null・未登録のパターンでは装飾を決められない", () => {
		for (const decorVariantId of [null, "rainy"]) {
			expect(() =>
				playfulRouteDecorDefinition(
					{ kind: "cover", pageId: "cover" },
					"zigzag",
					decorVariantId,
					booklet,
				),
			).toThrow("装飾パターン");
			expect(() =>
				playfulRouteDecorDefinition(dayPage, "zigzag", decorVariantId, booklet),
			).toThrow("装飾パターン");
		}
	});
});
