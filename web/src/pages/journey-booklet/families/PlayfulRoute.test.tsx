/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type {
	EditorialArrivalUnit,
	EditorialBooklet,
	EditorialDay,
} from "../../../booklet/editorialModel";
import type {
	PlayfulRouteDayPagePlan,
	PlayfulRoutePagePlan,
} from "../../../booklet/families/playfulRoute";
import type {
	PlayfulRouteCompositionId,
	PlayfulRouteDecorVariantId,
} from "../../../theme/families/playfulRoute";
import {
	playfulRouteDecorVariantFor,
	playfulRoutePaletteFor,
} from "../../../theme/families/playfulRoute";
import { familyProfileById } from "../program/modules/familyStyle";
import { prepareFamilyDecorPages } from "./familyDecor";
import {
	ensurePlayfulRouteDayPageContent,
	PlayfulDecor,
	PlayfulRouteCover,
	type PlayfulRouteDecorDesign,
	playfulRouteDayLabel,
	playfulRouteDecorDefinition,
	playfulRouteStyleFor,
	RouteDayPage,
} from "./PlayfulRoute";

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

const bookletDay = booklet.days[0] as EditorialDay;

function profileIdFor(decorVariantId: string | null): string {
	return decorVariantId === "sunny"
		? "playful-route.playful-pop"
		: "playful-route.playful-travel-diary";
}

/** The decor a program profile scene hands the family parts. */
function decorDesignFor(
	decorVariantId: PlayfulRouteDecorVariantId,
	compositionId: PlayfulRouteCompositionId = "zigzag",
): PlayfulRouteDecorDesign {
	return {
		compositionId,
		decorAssetIds: familyProfileById(
			"playful-route",
			profileIdFor(decorVariantId),
		).decorAssetIds,
		decorVariantId,
		familyId: "playful-route",
		seedToken: "v2-0000001c",
	};
}

/** Cover and day pages drawn with the kept parts, as a profile scene does. */
function PlayfulPages({
	design,
	pagePlan,
}: {
	readonly design: PlayfulRouteDecorDesign;
	readonly pagePlan: readonly PlayfulRoutePagePlan[];
}) {
	const profile = familyProfileById(
		"playful-route",
		profileIdFor(design.decorVariantId),
	);
	return (
		<div
			className={`playful-route playful-route--${design.compositionId}`}
			data-testid="playful-root"
			style={playfulRouteStyleFor({
				compositionId: design.compositionId,
				palette: playfulRoutePaletteFor(profile.paletteId),
				photoTreatment: profile.photoTreatment,
				ruleTreatment: profile.ruleTreatment,
				typography: profile,
			})}
		>
			{pagePlan.map((page) => (
				<article
					className={`booklet-page playful-route-page playful-route-page--${page.kind}`}
					data-booklet-page="true"
					data-page-id={page.pageId}
					key={page.pageId}
				>
					<PlayfulDecor
						booklet={booklet}
						design={design}
						page={page}
						scope="output"
					/>
					<div className="booklet-page__content">
						{page.kind === "cover" ? (
							<PlayfulRouteCover
								booklet={booklet}
								measurement={false}
								titleSizePt={40}
								titleSizesPt={[40, 34, 28, 22]}
							/>
						) : (
							<RouteDayPage booklet={booklet} page={page} />
						)}
					</div>
				</article>
			))}
		</div>
	);
}

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
	design: PlayfulRouteDecorDesign,
): void {
	const pages = Array.from(
		container.querySelectorAll<HTMLElement>("[data-booklet-page]"),
	);
	for (const pageElement of pages) {
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
			design.compositionId,
			design.decorVariantId,
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
	prepareFamilyDecorPages(
		pages,
		design,
		new Map(
			pagePlan.map((page) => [
				page.pageId,
				playfulRouteDecorDefinition(
					page,
					design.compositionId,
					design.decorVariantId,
					booklet,
				).decorations,
			]),
		),
	);
}

const dayPage: PlayfulRouteDayPagePlan = {
	blockHeightsMm: [32, 32],
	continuation: false,
	dayIndex: 0,
	kind: "day",
	layoutVariant: "selected",
	pageId: "day-1",
	unitIndexes: [0, 1],
};

const contentExpectation = {
	label: playfulRouteDayLabel(1),
	ordinalOffset: 0,
	unitLabel: null,
} as const;

describe("playful-routeの表紙と日ページ", () => {
	it("正常系: 日内番号・時刻・訪問先・移動を元の順で描く", () => {
		const design = decorDesignFor("sunny");
		const pagePlan: readonly PlayfulRoutePagePlan[] = [
			{ kind: "cover", pageId: "cover" },
			dayPage,
		];
		const { container, getByTestId } = render(
			<PlayfulPages design={design} pagePlan={pagePlan} />,
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
		const root = getByTestId("playful-root");
		expect(root.style.getPropertyValue("--playful-route-utility-family")).toBe(
			'"Noto Sans JP", sans-serif',
		);
		expect(root.style.getPropertyValue("--playful-route-utility-weight")).toBe(
			"400",
		);
		expect(
			container.querySelector(".playful-route-cover__period"),
		).not.toBeNull();
		expect(
			container.querySelector(
				'.playful-route-page--cover [data-booklet-text-role="cover-destination"]',
			),
		).toHaveTextContent("金沢");
		expect(() =>
			ensurePlayfulRouteDayPageContent(
				container.querySelector('[data-page-id="day-1"]') as HTMLElement,
				bookletDay,
				dayPage,
				contentExpectation,
			),
		).not.toThrow();
	});

	it("異常系: ページ計画にない日を描画しない", () => {
		const design = decorDesignFor("sunny");
		const missingDay: PlayfulRouteDayPagePlan = {
			...dayPage,
			blockHeightsMm: [32],
			dayIndex: 9,
			pageId: "missing-day",
			unitIndexes: [0],
		};
		const { container } = render(
			<PlayfulPages
				design={design}
				pagePlan={[{ kind: "cover", pageId: "cover" }, missingDay]}
			/>,
		);

		expect(container.querySelector(".playful-route-block")).toBeNull();
	});

	it("異常系: ページ計画の掲載単位がモデルになければ内容確認で拒否する", () => {
		const design = decorDesignFor("sunny");
		const { container } = render(
			<PlayfulPages design={design} pagePlan={[dayPage]} />,
		);

		expect(() =>
			ensurePlayfulRouteDayPageContent(
				container.querySelector('[data-page-id="day-1"]') as HTMLElement,
				bookletDay,
				{ ...dayPage, blockHeightsMm: [32], unitIndexes: [9] },
				contentExpectation,
			),
		).toThrow("掲載単位がモデルにありません");
	});

	it("異常系: 日見出しや掲載順が描画と一致しなければ内容確認で拒否する", () => {
		const design = decorDesignFor("sunny");
		const { container } = render(
			<PlayfulPages design={design} pagePlan={[dayPage]} />,
		);
		const pageElement = container.querySelector(
			'[data-page-id="day-1"]',
		) as HTMLElement;

		expect(() =>
			ensurePlayfulRouteDayPageContent(pageElement, bookletDay, dayPage, {
				...contentExpectation,
				label: playfulRouteDayLabel(2),
			}),
		).toThrow("日見出しが掲載モデルと一致しません");
		expect(() =>
			ensurePlayfulRouteDayPageContent(pageElement, bookletDay, dayPage, {
				...contentExpectation,
				ordinalOffset: 1,
			}),
		).toThrow("表示文字が掲載モデルと一致しません");
		expect(() =>
			ensurePlayfulRouteDayPageContent(
				pageElement,
				bookletDay,
				{ ...dayPage, unitIndexes: [1, 0] },
				contentExpectation,
			),
		).toThrow("掲載単位ID順がページ計画と一致しません");
	});

	it.each([
		["zigzag", "sunny"],
		["zigzag", "walking"],
		["ribbon", "sunny"],
		["ribbon", "walking"],
	] as const)(
		"境界値: %s・%sの実測anchor・折れ線・描画済み装飾が一致する",
		(compositionId, decorVariantId) => {
			const design = decorDesignFor(decorVariantId, compositionId);
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
				<PlayfulPages design={design} pagePlan={pagePlan} />,
			);

			expect(() =>
				prepareRenderedDecor(container, pagePlan, design),
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
				container.querySelector(
					`[data-page-id="day-${compositionId}"] .playful-route-blocks`,
				),
			).toHaveClass(
				"playful-route-blocks--compact-header",
				"playful-route-blocks--continuation",
			);
		},
	);
});

describe("playful-routeの装飾パターン描画", () => {
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

	it("境界値: 日の途中から始まるsceneはzigzagの左右を日内の位置で保つ", () => {
		const fromStart = playfulRouteDecorDefinition(
			dayPage,
			"zigzag",
			"sunny",
			booklet,
		);
		const fromSecond = playfulRouteDecorDefinition(
			dayPage,
			"zigzag",
			"sunny",
			booklet,
			1,
		);

		expect(fromStart.anchors.slice(0, 2).map((item) => item.rect.xMm)).toEqual([
			10, 34,
		]);
		expect(fromSecond.anchors.slice(0, 2).map((item) => item.rect.xMm)).toEqual(
			[34, 10],
		);
	});

	it.each(["sunny", "walking"] as const)(
		"正常系: %sを表紙と本文の両方で描く",
		(decorVariantId) => {
			const design = decorDesignFor(decorVariantId);
			expect(design.decorAssetIds).toEqual(
				playfulRouteDecorVariantFor(decorVariantId).decorAssetIds,
			);
			const pagePlan: readonly PlayfulRoutePagePlan[] = [
				{ kind: "cover", pageId: "cover" },
				dayPage,
			];
			const { container } = render(
				<PlayfulPages design={design} pagePlan={pagePlan} />,
			);

			prepareRenderedDecor(container, pagePlan, design);
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
		const design = decorDesignFor("walking");
		const pagePlan: readonly PlayfulRoutePagePlan[] = [
			{ kind: "cover", pageId: "cover" },
			{ ...dayPage, layoutVariant: "wide-ribbon" },
		];
		const { container } = render(
			<PlayfulPages design={design} pagePlan={pagePlan} />,
		);

		expect(() =>
			prepareRenderedDecor(container, pagePlan, design),
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
