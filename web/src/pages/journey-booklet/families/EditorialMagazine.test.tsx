/** @vitest-environment jsdom */

import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
	EditorialArrivalUnit,
	EditorialBooklet,
	EditorialDay,
} from "../../../booklet/editorialModel";
import { editorialMagazinePaletteFor } from "../../../theme/families/editorialMagazine";
import { familyProfileById } from "../program/modules/familyStyle";
import {
	collectEditorialMagazineDayMeasurement,
	editorialMagazineStyleFor,
	editorialMagazineVariantOf,
	MagazineCover,
	MagazineDayMeasurementSample,
	MagazineDayPage,
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

function firstDay(source: EditorialBooklet = booklet): EditorialDay {
	const day = source.days[0];
	if (!day) throw new Error("日がありません。");
	return day;
}

function styleOf(styleProfileId: string) {
	const profile = familyProfileById("editorial-magazine", styleProfileId);
	return editorialMagazineStyleFor({
		compositionId: "magazine-feature",
		palette: editorialMagazinePaletteFor(profile.paletteId),
		typography: profile,
		variant: editorialMagazineVariantOf(profile.id),
	});
}

afterEach(() => {
	vi.restoreAllMocks();
});

describe("MagazineCover / MagazineDayPage", () => {
	it("正常系: 表紙と日別記事を描き、説明が空ならcaption要素を作らない", () => {
		const { container } = render(
			<>
				<MagazineCover booklet={booklet} measurement={false} />
				<MagazineDayPage
					day={firstDay()}
					page={{
						dayIndex: 0,
						kind: "article",
						pageId: "article",
						unitIndexes: [0, 1],
					}}
				/>
			</>,
		);

		expect(
			container.querySelector('[data-booklet-text-role="cover-title"]')
				?.textContent,
		).toBe("金沢");
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

	it("境界値系: 長いspot名を切り詰めず記事カードへ渡す", () => {
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
			<MagazineDayPage
				day={firstDay(longBooklet)}
				page={{
					dayIndex: 0,
					kind: "article",
					pageId: "article",
					unitIndexes: [0, 1],
				}}
			/>,
		);

		expect(
			container.querySelector(
				'[data-unit-id="unit-1"] [data-booklet-text-role="spot-name"]',
			)?.textContent,
		).toBe(longSpotName);
	});

	it("境界値系: 継続ページでは日別挿絵を複製しない", () => {
		const { container } = render(
			<MagazineDayPage
				day={firstDay()}
				page={{
					dayIndex: 0,
					kind: "continuation",
					pageId: "continuation",
					unitIndexes: [1],
				}}
			/>,
		);

		expect(
			container.querySelectorAll(".editorial-magazine-day-header__image"),
		).toHaveLength(0);
		expect(
			container.querySelector(".editorial-magazine-day-header--continuation"),
		).not.toBeNull();
		expect(container.querySelectorAll("[data-unit-id]")).toHaveLength(1);
	});

	it("境界値系: 予定0件の日の記事ページは予定なしの文言を描く", () => {
		const emptyDay: EditorialDay = { ...firstDay(), units: [] };
		const { container } = render(
			<MagazineDayPage
				day={emptyDay}
				page={{
					dayIndex: 0,
					kind: "article",
					pageId: "article",
					unitIndexes: [],
				}}
			/>,
		);

		expect(
			container.querySelector('[data-booklet-text-role="empty-day"]')
				?.textContent,
		).toBe("予定はありません");
	});

	it("境界値系: 先頭カードが継続ページへ送られた記事ページには予定なしの文言を出さない", () => {
		const { container } = render(
			<MagazineDayPage
				day={firstDay()}
				page={{
					dayIndex: 0,
					kind: "article",
					pageId: "article",
					unitIndexes: [],
				}}
			/>,
		);

		expect(
			container.querySelector('[data-booklet-text-role="empty-day"]'),
		).toBeNull();
		expect(container.querySelectorAll("[data-unit-id]")).toHaveLength(0);
	});
});

describe("MagazineDayMeasurementSample", () => {
	it("正常系: 計測candidate DOMは全unitをpage planなしで描く", () => {
		const { container } = render(
			<MagazineDayMeasurementSample day={firstDay()} />,
		);

		expect(
			container.querySelectorAll("[data-editorial-magazine-card]"),
		).toHaveLength(2);
		expect(
			container.querySelectorAll(".editorial-magazine-day-header"),
		).toHaveLength(2);
		expect(
			container.querySelector('[data-editorial-magazine-card="unit-1"] h3'),
		).not.toBeNull();
		expect(
			container.querySelector(
				'[data-editorial-magazine-card="unit-1"] [data-booklet-text-role="unit-description"]',
			),
		).not.toBeNull();
	});
});

describe("collectEditorialMagazineDayMeasurement", () => {
	function renderSample() {
		return render(
			<div
				className="editorial-magazine-page"
				data-editorial-magazine-measurement-day="day-1"
			>
				<MagazineDayMeasurementSample day={firstDay()} />
			</div>,
		);
	}

	function mockRects(heightPx: (element: Element) => number) {
		vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
			function (this: HTMLElement) {
				const width = this.matches(".editorial-magazine-page") ? 296 : 256;
				const height = heightPx(this);
				return {
					bottom: height,
					height,
					left: 0,
					right: width,
					toJSON: () => ({}),
					top: 0,
					width,
					x: 0,
					y: 0,
				};
			},
		);
	}

	it("正常系: ページ幅148mm換算でヘッダーとカードの高さを返す", () => {
		mockRects((element) => {
			if (element.matches(".editorial-magazine-day-header--continuation"))
				return 20;
			if (element.matches(".editorial-magazine-day-header")) return 60;
			if (element.getAttribute("data-editorial-magazine-card") === "unit-1")
				return 80;
			return 50;
		});
		const { container } = renderSample();

		const measurement = collectEditorialMagazineDayMeasurement(
			container as HTMLElement,
			{ ...booklet, days: [firstDay()] },
		);

		expect(measurement).toEqual({
			articleHeaderHeightMm: 30,
			articleStartYmm: 80,
			cardGapMm: 3,
			continuationHeaderHeightMm: 10,
			continuationStartYmm: 30,
			pageBottomYmm: 200,
			unitHeightsMm: new Map([
				["unit-1", 40],
				["unit-2", 25],
			]),
		});
	});

	it("異常系: 日別計測用DOMがなければdom-not-readyになる", () => {
		mockRects(() => 10);
		const { container } = render(
			<MagazineDayMeasurementSample day={firstDay()} />,
		);

		expect(() =>
			collectEditorialMagazineDayMeasurement(container as HTMLElement, {
				...booklet,
				days: [firstDay()],
			}),
		).toThrowError(expect.objectContaining({ code: "dom-not-ready" }));
	});

	it("異常系: 高さ0の計測カードはdom-not-readyになる", () => {
		mockRects((element) =>
			element.hasAttribute("data-editorial-magazine-card") ? 0 : 10,
		);
		const { container } = renderSample();

		expect(() =>
			collectEditorialMagazineDayMeasurement(container as HTMLElement, {
				...booklet,
				days: [firstDay()],
			}),
		).toThrowError(expect.objectContaining({ code: "dom-not-ready" }));
	});
});

describe("editorialMagazineStyleFor", () => {
	it("正常系: 作風ごとの表紙画像寸法をstyleから渡す", () => {
		expect(styleOf("editorial-magazine.quiet-photo")).toMatchObject({
			"--editorial-cover-height": "92mm",
			"--editorial-cover-left": "10mm",
			"--editorial-cover-width": "128mm",
		});
		expect(styleOf("editorial-magazine.bold-culture")).toMatchObject({
			"--editorial-cover-height": "72mm",
			"--editorial-cover-left": "60mm",
			"--editorial-cover-width": "78mm",
		});
	});

	it("異常系: 未登録の構図は拒否する", () => {
		const profile = familyProfileById(
			"editorial-magazine",
			"editorial-magazine.quiet-photo",
		);
		expect(() =>
			editorialMagazineStyleFor({
				compositionId: "unknown",
				palette: editorialMagazinePaletteFor(profile.paletteId),
				typography: profile,
				variant: "quiet-photo",
			}),
		).toThrow("editorial-magazineの構図「unknown」がありません。");
	});
});
