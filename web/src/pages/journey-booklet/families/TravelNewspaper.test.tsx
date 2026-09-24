/** @vitest-environment jsdom */

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type {
	EditorialArrivalUnit,
	EditorialBooklet,
} from "../../../booklet/editorialModel";
import { travelNewspaperPaletteFor } from "../../../theme/families/travelNewspaper";
import { familyProfileById } from "../program/modules/familyStyle";
import {
	collectTravelNewspaperDayHeights,
	TravelNewspaperArticles,
	TravelNewspaperCover,
	TravelNewspaperDayMeasurementSample,
	travelNewspaperStyleFor,
	travelNewspaperVariantOf,
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

describe("TravelNewspaperCover", () => {
	it("正常系: 題字・題名・期間と表紙画像を描く", () => {
		const { container } = render(<TravelNewspaperCover booklet={booklet} />);

		expect(
			container.querySelector('[data-booklet-text-role="cover-title"]')
				?.textContent,
		).toBe("金沢");
		expect(
			container.querySelectorAll(
				'[data-booklet-text-role="cover-period"] time',
			),
		).toHaveLength(2);
		expect(container.querySelectorAll(".booklet-cover__image")).toHaveLength(1);
	});
});

describe("TravelNewspaperArticles", () => {
	it("正常系: 日別記事と時刻表メタデータを描く", () => {
		const { container } = render(
			<TravelNewspaperArticles
				booklet={booklet}
				page={{
					dayIndex: 0,
					kind: "articles",
					pageId: "articles",
					unitIndexes: [0, 1],
				}}
			/>,
		);

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
		expect(
			container.querySelectorAll(".travel-newspaper-day-header__image"),
		).toHaveLength(1);
	});

	it("境界値: 継続ページでは日別挿絵を複製しない", () => {
		const { container } = render(
			<TravelNewspaperArticles
				booklet={booklet}
				page={{
					dayIndex: 0,
					kind: "continuation",
					pageId: "continuation",
					unitIndexes: [1],
				}}
			/>,
		);

		expect(
			container.querySelectorAll(".travel-newspaper-day-header__image"),
		).toHaveLength(0);
		expect(
			container.querySelector(".travel-newspaper-day-header--continuation"),
		).not.toBeNull();
		expect(container.querySelectorAll("[data-unit-id]")).toHaveLength(1);
	});

	it("境界値: 単位0件のページは予定なしの表示を描く", () => {
		const { container } = render(
			<TravelNewspaperArticles
				booklet={booklet}
				page={{
					dayIndex: 0,
					kind: "articles",
					pageId: "empty",
					unitIndexes: [],
				}}
			/>,
		);

		expect(
			container.querySelector('[data-booklet-text-role="empty-day"]'),
		).not.toBeNull();
	});

	it("異常系: 存在しない日のページは何も描かない", () => {
		const { container } = render(
			<TravelNewspaperArticles
				booklet={booklet}
				page={{
					dayIndex: 5,
					kind: "articles",
					pageId: "missing",
					unitIndexes: [0],
				}}
			/>,
		);

		expect(container.childElementCount).toBe(0);
	});
});

describe("TravelNewspaperDayMeasurementSample", () => {
	it("正常系: 計測用DOMはpage planなしで日の全unitと両ヘッダーを描く", () => {
		const day = booklet.days[0];
		if (!day) throw new Error("fixture day is missing");
		const { container } = render(
			<TravelNewspaperDayMeasurementSample day={day} />,
		);

		expect(
			container.querySelectorAll("[data-travel-newspaper-card]"),
		).toHaveLength(2);
		expect(
			container.querySelectorAll(".travel-newspaper-day-header"),
		).toHaveLength(2);
	});
});

describe("collectTravelNewspaperDayHeights", () => {
	it("異常系: 日別計測用紙面がなければdom-not-readyになる", () => {
		const root = document.createElement("div");
		expect(() =>
			collectTravelNewspaperDayHeights(root, booklet, 1),
		).toThrowError(expect.objectContaining({ code: "dom-not-ready" }));
	});
});

describe("travelNewspaperStyleFor", () => {
	it("正常系: 作風paletteと表紙位置をstyleへ渡す", () => {
		const styleOf = (profileId: string) => {
			const profile = familyProfileById("travel-newspaper", profileId);
			return travelNewspaperStyleFor({
				compositionId: "newspaper-columns",
				palette: travelNewspaperPaletteFor(profile.paletteId),
				typography: profile,
				variant: travelNewspaperVariantOf(profile.id),
			});
		};
		expect(styleOf("travel-newspaper.classic-travel")).toMatchObject({
			"--newspaper-cover-left": "10mm",
			"--newspaper-cover-width": "78mm",
			"--newspaper-cover-height": "74mm",
		});
		expect(styleOf("travel-newspaper.city-walk")).toMatchObject({
			"--newspaper-cover-left": "60mm",
		});
	});

	it("異常系: 未登録の構図を拒否する", () => {
		const profile = familyProfileById(
			"travel-newspaper",
			"travel-newspaper.classic-travel",
		);
		expect(() =>
			travelNewspaperStyleFor({
				compositionId: "unknown",
				palette: travelNewspaperPaletteFor(profile.paletteId),
				typography: profile,
				variant: "classic-travel",
			}),
		).toThrow();
	});
});
