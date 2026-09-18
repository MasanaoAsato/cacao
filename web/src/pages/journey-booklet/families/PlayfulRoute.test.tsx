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

const design: ResolvedBookletDesign = {
	comparisonKey: "playful-route.berry-sun.zigzag",
	compositionId: "zigzag",
	decorAssetIds: [
		"playful-bag",
		"playful-sun",
		"playful-squiggle",
		"playful-burst",
	],
	familyId: "playful-route",
	fontFamilies: ["Dela Gothic One", "M PLUS Rounded 1c", "Noto Sans JP"],
	paletteId: "berry-sun",
	policyId: "route",
	renderKey: "playful-route:v2-0000001c:route:playful-route.berry-sun.zigzag",
	requestedTheme: createBookletTheme({ value: 28, version: "v2" }),
	seedToken: "v2-0000001c",
};

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
				playfulRouteDecorDefinition(page, resolvedDesign.compositionId, booklet)
					.decorations,
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

	it.each(["zigzag", "ribbon"] as const)(
		"境界値: %sの実測anchor・折れ線・描画済み装飾が一致する",
		(compositionId) => {
			const resolvedDesign = { ...design, compositionId };
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
