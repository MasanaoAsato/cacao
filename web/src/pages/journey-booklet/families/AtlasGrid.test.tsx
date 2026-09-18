/** @vitest-environment jsdom */

import { render } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import type {
	EditorialArrivalUnit,
	EditorialBooklet,
} from "../../../booklet/editorialModel";
import type { AtlasGridPagePlan } from "../../../booklet/families/atlasGrid";
import type { ResolvedBookletDesign } from "../../../booklet/family";
import { createBookletTheme } from "../../../theme/bookletTheme";
import { AtlasGridDocument, atlasDecorDefinition } from "./AtlasGrid";
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
		stayCost: { amount: 1200, currency: "JPY" },
		timeLabel: "09:00",
		transportCost: { amount: 450, currency: "JPY" },
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
		{
			date: "2026-09-17T00:00:00+09:00",
			dayNumber: 2,
			id: "day-2",
			illustration: null,
			units: [],
		},
	],
	journeyId: "journey-1",
	policyId: "timetable",
};

const requestedTheme = createBookletTheme({ value: 0, version: "v2" });

const design: ResolvedBookletDesign = {
	comparisonKey: "atlas-grid.blueprint.side-index",
	compositionId: "side-index",
	decorAssetIds: ["atlas-compass", "atlas-route-mark", "atlas-perforation"],
	decorVariantId: null,
	familyId: "atlas-grid",
	fontFamilies: ["Zen Kaku Gothic New", "Noto Sans JP"],
	paletteId: "blueprint",
	policyId: "timetable",
	renderKey: "atlas-grid:v2-0000002a:timetable:atlas-grid.blueprint.side-index",
	requestedTheme,
	seedToken: "v2-0000002a",
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
	pagePlan: readonly AtlasGridPagePlan[],
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
		const definition = atlasDecorDefinition(page, resolvedDesign.compositionId);
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
				atlasDecorDefinition(page, resolvedDesign.compositionId).decorations,
			]),
		),
	);
}

describe("AtlasGridDocument", () => {
	it("正常系: 複数日・費用・atlas素材を表紙と同じ文書へ描く", () => {
		const pagePlan: readonly AtlasGridPagePlan[] = [
			{ kind: "cover", pageId: "cover" },
			{
				kind: "table",
				pageId: "table-1",
				sections: [
					{ continuation: false, dayIndex: 0, unitIndexes: [0, 1] },
					{ continuation: false, dayIndex: 1, unitIndexes: [] },
				],
			},
		];
		const { container } = render(
			<AtlasGridDocument
				booklet={booklet}
				design={design}
				pagePlan={pagePlan}
				rootRef={createRef<HTMLElement>()}
				titleSizePt={40}
			/>,
		);

		expect(container.querySelectorAll("[data-booklet-page]")).toHaveLength(2);
		expect(container.textContent).toContain("近江町市場");
		expect(container.textContent).toContain("兼六園");
		expect(container.textContent).toContain("滞在費 1,200 JPY");
		expect(container.textContent).toContain("移動費 450 JPY");
		expect(container.textContent).toContain("予定はありません");
		expect(
			Array.from(
				container.querySelectorAll("[data-booklet-decor-asset]"),
				(element) => element.getAttribute("data-booklet-decor-asset"),
			),
		).toEqual(["atlas-route-mark", "atlas-perforation", "atlas-compass"]);
	});

	it("境界値: 継続ページに同日の帯と続き表記を描く", () => {
		const pagePlan: readonly AtlasGridPagePlan[] = [
			{ kind: "cover", pageId: "cover" },
			{
				kind: "table",
				pageId: "table-2",
				sections: [{ continuation: true, dayIndex: 0, unitIndexes: [1] }],
			},
		];
		const { container } = render(
			<AtlasGridDocument
				booklet={booklet}
				design={design}
				pagePlan={pagePlan}
				rootRef={createRef<HTMLElement>()}
				titleSizePt={34}
			/>,
		);

		expect(container.textContent).toContain("旅程一覧・続き");
		expect(container.textContent).toContain("1日目（続き）");
		expect(container.textContent).toContain("兼六園");
		expect(container.textContent).not.toContain("近江町市場");
	});

	it.each(["wide-image", "side-index"] as const)(
		"回帰: %sの実測anchorと描画済み装飾が一致する",
		(compositionId) => {
			const resolvedDesign = { ...design, compositionId };
			const pagePlan: readonly AtlasGridPagePlan[] = [
				{ kind: "cover", pageId: `cover-${compositionId}` },
				{
					kind: "table",
					pageId: `table-${compositionId}`,
					sections: [{ continuation: false, dayIndex: 0, unitIndexes: [0, 1] }],
				},
			];
			const { container } = render(
				<AtlasGridDocument
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
		},
	);
});
