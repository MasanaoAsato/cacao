/** @vitest-environment jsdom */

import { render } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import type {
	EditorialArrivalUnit,
	EditorialBooklet,
} from "../../../booklet/editorialModel";
import type { EditorialMagazinePagePlan } from "../../../booklet/families/editorialMagazine";
import type { ResolvedBookletDesign } from "../../../booklet/family";
import { createBookletTheme } from "../../../theme/bookletTheme";
import { styleProfileFor } from "../../../theme/families/styleProfiles";
import {
	EditorialMagazineDocument,
	EditorialMagazineMeasurement,
	editorialMagazineStyle,
} from "./EditorialMagazine";

function unit(
	id: string,
	name: string,
	description: string | null,
): EditorialArrivalUnit {
	return {
		description,
		durationMinutes: null,
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
			illustration: {
				contentUrl: "/day.png",
				height: 800,
				mediaType: "image/png",
				visualStyle: null,
				width: 800,
			},
			units: [
				unit("unit-1", "近江町市場", "朝の市場を歩く。"),
				unit("unit-2", "兼六園", null),
			],
		},
	],
	journeyId: "journey-1",
	policyId: "captions",
};

const styleProfile = styleProfileFor("editorial-magazine.quiet-photo");
const design: ResolvedBookletDesign = {
	comparisonKey:
		"editorial-magazine.editorial-magazine.quiet-photo.quiet-photo.magazine-feature",
	compositionId: "magazine-feature",
	decorAssetIds: [],
	decorVariantId: null,
	familyId: "editorial-magazine",
	fontFamilies: [
		styleProfile.fontFamilies.display,
		styleProfile.fontFamilies.body,
		styleProfile.fontFamilies.utility,
	],
	paletteId: styleProfile.paletteId,
	policyId: "captions",
	renderKey:
		"editorial-magazine:v2-00000013:captions:editorial-magazine.editorial-magazine.quiet-photo.quiet-photo.magazine-feature",
	requestedTheme: createBookletTheme({ value: 19, version: "v2" }),
	seedToken: "v2-00000013",
	styleProfile,
	styleProfileId: styleProfile.id,
};

describe("EditorialMagazineDocument", () => {
	it("正常系: 表紙と日別記事を描き、説明が空ならcaption要素を作らない", () => {
		const pagePlan: readonly EditorialMagazinePagePlan[] = [
			{ kind: "cover", pageId: "cover" },
			{
				dayIndex: 0,
				kind: "article",
				pageId: "article",
				unitIndexes: [0, 1],
			},
		];
		const { container } = render(
			<EditorialMagazineDocument
				booklet={booklet}
				design={design}
				pagePlan={pagePlan}
				rootRef={createRef<HTMLElement>()}
			/>,
		);

		expect(
			container.querySelectorAll('[data-booklet-family="editorial-magazine"]'),
		).toHaveLength(3);
		expect(
			container
				.querySelector(".booklet-document")
				?.getAttribute("data-booklet-design"),
		).toBe(design.requestedTheme.recipe.id);
		expect(container.querySelectorAll("[data-unit-id]")).toHaveLength(2);
		expect(
			container
				.querySelector('[data-unit-id="unit-1"] time')
				?.getAttribute("dateTime"),
		).toBe("2026-09-16T09:00:00+09:00");
		expect(
			container.querySelector(
				'[data-unit-id="unit-1"] [data-booklet-text-role="spot-name"]',
			)?.textContent,
		).toBe("近江町市場");
		expect(
			container.querySelector(
				'[data-unit-id="unit-1"] [data-booklet-text-role="unit-description"]',
			)?.textContent,
		).toBe("朝の市場を歩く。");
		expect(
			container.querySelector(
				'[data-unit-id="unit-2"] [data-booklet-text-role="unit-description"]',
			),
		).toBeNull();
		expect(
			container.querySelectorAll(".editorial-magazine-cover__image"),
		).toHaveLength(1);
		expect(
			container.querySelectorAll(".editorial-magazine-day-header__image"),
		).toHaveLength(1);
	});

	it("境界値: 長いspot名を切り詰めず記事カードへ渡す", () => {
		const longSpotName =
			"京都国際マンガミュージアムABCDEFGHIJKLMN1234567890で企画展を鑑賞";
		const longBooklet: EditorialBooklet = {
			...booklet,
			days: booklet.days.map((day) => ({
				...day,
				units: day.units.map((unit, index) =>
					index === 0 ? { ...unit, spotName: longSpotName } : unit,
				),
			})),
		};
		const { container } = render(
			<EditorialMagazineDocument
				booklet={longBooklet}
				design={design}
				pagePlan={[
					{ kind: "cover", pageId: "cover" },
					{
						dayIndex: 0,
						kind: "article",
						pageId: "article",
						unitIndexes: [0, 1],
					},
				]}
				rootRef={createRef<HTMLElement>()}
			/>,
		);

		expect(
			container.querySelector(
				'[data-unit-id="unit-1"] [data-booklet-text-role="spot-name"]',
			)?.textContent,
		).toBe(longSpotName);
	});

	it("境界値: 継続ページでは日別挿絵を複製しない", () => {
		const { container } = render(
			<EditorialMagazineDocument
				booklet={booklet}
				design={design}
				pagePlan={[
					{ kind: "cover", pageId: "cover" },
					{
						dayIndex: 0,
						kind: "continuation",
						pageId: "continuation",
						unitIndexes: [1],
					},
				]}
				rootRef={createRef<HTMLElement>()}
			/>,
		);

		expect(
			container.querySelectorAll(".editorial-magazine-day-header__image"),
		).toHaveLength(0);
		expect(
			container
				.querySelector('[data-page-id="continuation"]')
				?.getAttribute("data-day-id"),
		).toBe("day-1");
	});

	it("正常系: 計測candidate DOMは全unitをpage planなしで描く", () => {
		const rootRef = createRef<HTMLDivElement>();
		const { container } = render(
			<EditorialMagazineMeasurement
				booklet={booklet}
				design={design}
				rootRef={rootRef}
			/>,
		);

		expect(
			container.querySelectorAll("[data-editorial-magazine-card]"),
		).toHaveLength(2);
		expect(
			container.querySelectorAll("[data-editorial-magazine-measurement-day]"),
		).toHaveLength(1);
		expect(rootRef.current?.dataset.bookletThemeKey).toBe(design.renderKey);
		expect(
			container.querySelector('[data-editorial-magazine-card="unit-1"] h3'),
		).not.toBeNull();
		expect(
			container.querySelector(
				'[data-editorial-magazine-card="unit-1"] [data-booklet-text-role="unit-description"]',
			),
		).not.toBeNull();
	});

	it("正常系: 作風ごとの表紙画像寸法をstyleから渡す", () => {
		const boldProfile = styleProfileFor("editorial-magazine.bold-culture");
		const boldDesign: ResolvedBookletDesign = {
			...design,
			paletteId: boldProfile.paletteId,
			styleProfile: boldProfile,
			styleProfileId: boldProfile.id,
		};

		expect(editorialMagazineStyle(design)).toMatchObject({
			"--editorial-cover-height": "92mm",
			"--editorial-cover-left": "10mm",
			"--editorial-cover-width": "128mm",
		});
		expect(editorialMagazineStyle(boldDesign)).toMatchObject({
			"--editorial-cover-height": "72mm",
			"--editorial-cover-left": "60mm",
			"--editorial-cover-width": "78mm",
		});
	});
});
