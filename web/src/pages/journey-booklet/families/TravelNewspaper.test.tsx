/** @vitest-environment jsdom */

import { render } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import type {
	EditorialArrivalUnit,
	EditorialBooklet,
} from "../../../booklet/editorialModel";
import type { TravelNewspaperPagePlan } from "../../../booklet/families/travelNewspaper";
import type { ResolvedBookletDesign } from "../../../booklet/family";
import { createBookletTheme } from "../../../theme/bookletTheme";
import { styleProfileFor } from "../../../theme/families/styleProfiles";
import {
	TravelNewspaperDocument,
	TravelNewspaperMeasurement,
	travelNewspaperStyle,
} from "./TravelNewspaper";

function unit(
	id: string,
	name: string,
	transportMode: string | null,
): EditorialArrivalUnit {
	return {
		description: "この説明は時刻表紙面には出ない。",
		durationMinutes: transportMode ? 25 : null,
		id,
		legId: `leg-${id}`,
		route: { from: "出発", to: "到着" },
		spotId: `spot-${id}`,
		spotName: name,
		startAt: "2026-09-16T09:00:00+09:00",
		stayCost: null,
		timeLabel: "09:00",
		transportCost: null,
		transportMode,
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
				unit("unit-1", "近江町市場", "train"),
				unit("unit-2", "兼六園", null),
			],
		},
	],
	journeyId: "journey-1",
	policyId: "timetable",
};

const profile = styleProfileFor("travel-newspaper.classic-travel");
const design: ResolvedBookletDesign = {
	comparisonKey:
		"travel-newspaper.travel-newspaper.classic-travel.classic-travel.newspaper-columns",
	compositionId: "newspaper-columns",
	decorAssetIds: [],
	decorVariantId: null,
	familyId: "travel-newspaper",
	fontFamilies: [
		profile.fontFamilies.display,
		profile.fontFamilies.body,
		profile.fontFamilies.utility,
	],
	paletteId: profile.paletteId,
	policyId: "timetable",
	renderKey:
		"travel-newspaper:v2-00000013:timetable:travel-newspaper.travel-newspaper.classic-travel.classic-travel.newspaper-columns",
	requestedTheme: createBookletTheme({ value: 19, version: "v2" }),
	seedToken: "v2-00000013",
	styleProfile: profile,
	styleProfileId: profile.id,
};

describe("TravelNewspaperDocument", () => {
	it("正常系: 表紙・日別記事・時刻表メタデータとdata属性を描く", () => {
		const pagePlan: readonly TravelNewspaperPagePlan[] = [
			{ kind: "cover", pageId: "cover" },
			{
				dayIndex: 0,
				kind: "articles",
				pageId: "articles",
				unitIndexes: [0, 1],
			},
		];
		const { container } = render(
			<TravelNewspaperDocument
				booklet={booklet}
				design={design}
				pagePlan={pagePlan}
				rootRef={createRef<HTMLElement>()}
			/>,
		);

		expect(
			container.querySelectorAll('[data-booklet-family="travel-newspaper"]'),
		).toHaveLength(3);
		expect(
			container.querySelector(
				'[data-booklet-resolved-composition="newspaper-columns"]',
			),
		).not.toBeNull();
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
				'[data-unit-id="unit-1"] [data-booklet-text-role="transport-summary"]',
			)?.textContent,
		).toContain("電車");
		expect(
			container.querySelector(
				'[data-unit-id="unit-2"] [data-booklet-text-role="transport-summary"]',
			),
		).toBeNull();
		expect(
			container.querySelector(
				'[data-unit-id="unit-1"] [data-booklet-text-role="unit-description"]',
			),
		).toBeNull();
		expect(container.querySelectorAll(".booklet-cover__image")).toHaveLength(1);
	});

	it("境界値: 継続ページでは日別挿絵を複製しない", () => {
		const { container } = render(
			<TravelNewspaperDocument
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
			container.querySelectorAll(".travel-newspaper-day-header__image"),
		).toHaveLength(0);
		expect(
			container
				.querySelector('[data-page-id="continuation"]')
				?.getAttribute("data-day-id"),
		).toBe("day-1");
	});

	it("正常系: 計測candidate DOMはpage planなしで全unitを描く", () => {
		const rootRef = createRef<HTMLDivElement>();
		const { container } = render(
			<TravelNewspaperMeasurement
				booklet={booklet}
				design={design}
				rootRef={rootRef}
			/>,
		);

		expect(
			container.querySelectorAll("[data-travel-newspaper-card]"),
		).toHaveLength(2);
		expect(
			container.querySelectorAll("[data-travel-newspaper-measurement-day]"),
		).toHaveLength(1);
		expect(rootRef.current?.dataset.bookletThemeKey).toBe(design.renderKey);
	});

	it("正常系: 作風paletteと表紙位置をstyleへ渡す", () => {
		const cityProfile = styleProfileFor("travel-newspaper.city-walk");
		const cityDesign: ResolvedBookletDesign = {
			...design,
			paletteId: cityProfile.paletteId,
			styleProfile: cityProfile,
			styleProfileId: cityProfile.id,
		};
		expect(travelNewspaperStyle(design)).toMatchObject({
			"--newspaper-cover-left": "10mm",
			"--newspaper-cover-width": "78mm",
			"--newspaper-cover-height": "74mm",
		});
		expect(travelNewspaperStyle(cityDesign)).toMatchObject({
			"--newspaper-cover-left": "60mm",
		});
	});
});
