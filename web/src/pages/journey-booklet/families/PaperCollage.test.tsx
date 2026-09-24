/** @vitest-environment jsdom */

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type {
	EditorialArrivalUnit,
	EditorialBooklet,
} from "../../../booklet/editorialModel";
import type { PaperCollagePagePlan } from "../../../booklet/families/paperCollage";
import type { FamilyDecorDesign } from "../../../booklet/family";
import { prepareFamilyDecorPages } from "./familyDecor";
import {
	PaperCollageCover,
	PaperCollageDayPage,
	PaperCollageDecor,
	paperCollageDecorationsByPage,
	paperCollageDecorDefinition,
	paperCollageTitleSizes,
} from "./PaperCollage";

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

const design: FamilyDecorDesign = {
	compositionId: "photo-left",
	decorAssetIds: [
		"paper-torn-sheet",
		"paper-tape",
		"paper-leaf",
		"paper-postage",
	],
	familyId: "paper-collage",
	seedToken: "v2-00000013",
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

/** The family's pages as a program scene draws them: decor, then content. */
function PaperCollagePages({
	decorDesign,
	pagePlan,
}: {
	readonly decorDesign: FamilyDecorDesign;
	readonly pagePlan: readonly PaperCollagePagePlan[];
}) {
	return (
		<main
			className={`paper-collage paper-collage--${decorDesign.compositionId}`}
		>
			{pagePlan.map((page) => (
				<article
					className={`booklet-page paper-collage-page paper-collage-page--${page.kind}`}
					data-booklet-page="true"
					data-page-id={page.pageId}
					key={page.pageId}
				>
					<PaperCollageDecor design={decorDesign} page={page} scope="output" />
					<div className="booklet-page__content">
						{page.kind === "cover" ? (
							<PaperCollageCover
								booklet={booklet}
								measurement={false}
								titleSizePt={36}
								titleSizesPt={paperCollageTitleSizes(undefined)}
							/>
						) : (
							<PaperCollageDayPage booklet={booklet} page={page} />
						)}
					</div>
				</article>
			))}
		</main>
	);
}

function prepareRenderedDecor(
	container: HTMLElement,
	pagePlan: readonly PaperCollagePagePlan[],
	decorDesign: FamilyDecorDesign,
): void {
	const pageElements = Array.from(
		container.querySelectorAll<HTMLElement>("[data-booklet-page]"),
	);
	for (const pageElement of pageElements) {
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
			decorDesign.compositionId,
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
	prepareFamilyDecorPages(
		pageElements,
		decorDesign,
		paperCollageDecorationsByPage(pagePlan, decorDesign.compositionId),
	);
}

describe("PaperCollageDayPage", () => {
	it("正常系: 短文付きと説明なしのカードを順序どおり描く", () => {
		const { container } = render(
			<PaperCollageDayPage
				booklet={booklet}
				page={{
					columns: [[0], [1]],
					continuation: false,
					dayIndex: 0,
					kind: "day",
					layoutVariant: "selected",
					pageId: "day-1",
				}}
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
		const { container } = render(
			<PaperCollageDayPage
				booklet={booklet}
				page={{
					columns: [[0], []],
					continuation: false,
					dayIndex: 9,
					kind: "day",
					layoutVariant: "selected",
					pageId: "missing-day",
				}}
			/>,
		);

		expect(container.querySelector(".paper-collage-card")).toBeNull();
	});
});

describe("PaperCollageDecor", () => {
	it.each(["photo-left", "photo-right"] as const)(
		"境界値: %sの実測anchorと描画済み装飾が一致する",
		(compositionId) => {
			const decorDesign = { ...design, compositionId };
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
				<PaperCollagePages decorDesign={decorDesign} pagePlan={pagePlan} />,
			);

			expect(() =>
				prepareRenderedDecor(container, pagePlan, decorDesign),
			).not.toThrow();
			expect(
				container.querySelector(
					`[data-page-id="continuation-${compositionId}"] .paper-collage-day-header__image`,
				),
			).toBeNull();
		},
	);
});
