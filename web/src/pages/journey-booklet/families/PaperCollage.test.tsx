/** @vitest-environment jsdom */

import { render } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import type {
	EditorialArrivalUnit,
	EditorialBooklet,
} from "../../../booklet/editorialModel";
import type { PaperCollagePagePlan } from "../../../booklet/families/paperCollage";
import type { ResolvedBookletDesign } from "../../../booklet/family";
import { createBookletTheme } from "../../../theme/bookletTheme";
import { styleProfileFor } from "../../../theme/families/styleProfiles";
import {
	PaperCollageDocument,
	paperCollageDecorDefinition,
} from "./PaperCollage";
import { prepareFamilyDecor } from "./useFamilyPagePlan";

function unit(
	id: string,
	name: string,
	description: string | null,
): EditorialArrivalUnit {
	return {
		description,
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
		transportMode: null,
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
			units: [
				unit("unit-1", "近江町市場", "朝の市場をゆっくり歩く。"),
				unit("unit-2", "兼六園", null),
			],
		},
	],
	journeyId: "journey-1",
	policyId: "captions",
};

const design: ResolvedBookletDesign = {
	comparisonKey: "paper-collage.sage-paper.photo-left",
	compositionId: "photo-left",
	decorAssetIds: [
		"paper-torn-sheet",
		"paper-tape",
		"paper-leaf",
		"paper-postage",
	],
	decorVariantId: null,
	familyId: "paper-collage",
	fontFamilies: ["Kaisei Decol", "Noto Serif JP", "Noto Sans JP"],
	paletteId: "sage-paper",
	policyId: "captions",
	renderKey:
		"paper-collage:v2-00000013:captions:paper-collage.sage-paper.photo-left",
	requestedTheme: createBookletTheme({ value: 19, version: "v2" }),
	seedToken: "v2-00000013",
	styleProfile: styleProfileFor("paper-collage.paper-cut"),
	styleProfileId: "paper-collage.paper-cut",
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
	pagePlan: readonly PaperCollagePagePlan[],
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
		const definition = paperCollageDecorDefinition(
			page,
			resolvedDesign.compositionId,
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
				paperCollageDecorDefinition(page, resolvedDesign.compositionId)
					.decorations,
			]),
		),
	);
}

describe("PaperCollageDocument", () => {
	it("正常系: 短文付きと説明なしのカードを順序どおり描く", () => {
		const pagePlan: readonly PaperCollagePagePlan[] = [
			{ kind: "cover", pageId: "cover" },
			{
				columns: [[0], [1]],
				continuation: false,
				dayIndex: 0,
				kind: "day",
				layoutVariant: "selected",
				pageId: "day-1",
			},
		];
		const { container } = render(
			<PaperCollageDocument
				booklet={booklet}
				design={design}
				pagePlan={pagePlan}
				rootRef={createRef<HTMLElement>()}
				titleSizePt={36}
			/>,
		);

		const cards = container.querySelectorAll(".paper-collage-card");
		expect(cards).toHaveLength(2);
		expect(cards[0]?.textContent).toContain("朝の市場をゆっくり歩く。");
		expect(
			cards[1]?.querySelector('[data-booklet-text-role="unit-description"]'),
		).toBeNull();
		expect(
			container.querySelector(".paper-collage-day-header__image img"),
		).toHaveProperty("src", "http://localhost:3000/cover.png");
	});

	it("異常系: ページ計画にない日を描画しない", () => {
		const pagePlan: readonly PaperCollagePagePlan[] = [
			{
				columns: [[0], []],
				continuation: false,
				dayIndex: 9,
				kind: "day",
				layoutVariant: "selected",
				pageId: "missing-day",
			},
		];
		const { container } = render(
			<PaperCollageDocument
				booklet={booklet}
				design={design}
				pagePlan={pagePlan}
				rootRef={createRef<HTMLElement>()}
				titleSizePt={36}
			/>,
		);

		expect(container.querySelector(".paper-collage-card")).toBeNull();
	});

	it.each(["photo-left", "photo-right"] as const)(
		"境界値: %sの実測anchorと描画済み装飾が一致する",
		(compositionId) => {
			const resolvedDesign = { ...design, compositionId };
			const pagePlan: readonly PaperCollagePagePlan[] = [
				{ kind: "cover", pageId: `cover-${compositionId}` },
				{
					columns: [[0], [1]],
					continuation: false,
					dayIndex: 0,
					kind: "day",
					layoutVariant: "selected",
					pageId: `day-${compositionId}`,
				},
				{
					columns: [[1], []],
					continuation: true,
					dayIndex: 0,
					kind: "day",
					layoutVariant: "selected",
					pageId: `continuation-${compositionId}`,
				},
			];
			const { container } = render(
				<PaperCollageDocument
					booklet={booklet}
					design={resolvedDesign}
					pagePlan={pagePlan}
					rootRef={createRef<HTMLElement>()}
					titleSizePt={36}
				/>,
			);

			expect(() =>
				prepareRenderedDecor(container, pagePlan, resolvedDesign),
			).not.toThrow();
			expect(
				container.querySelector(
					`[data-page-id="continuation-${compositionId}"] .paper-collage-day-header__image`,
				),
			).toBeNull();
		},
	);
});
