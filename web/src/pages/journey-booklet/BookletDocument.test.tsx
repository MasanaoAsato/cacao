/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { render } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import type { BookletModel, BookletPagePlan } from "../../booklet/model";
import {
	createBookletTheme,
	getThemeCandidates,
	resolveBookletTheme,
} from "../../theme/bookletTheme";
import { BookletDocument, BookletMeasurement } from "./BookletDocument";

const model: BookletModel = {
	cover: {
		budget: { amount: 10000, currency: "JPY" },
		destination: "非常に長い目的地名を含む美しい旅先",
		departure: "東京",
		image: {
			contentUrl: "/cover.png",
			height: 1200,
			mediaType: "image/png",
			width: 800,
		},
		period: {
			end_date: "2026-08-29T00:00:00+09:00",
			start_date: "2026-08-28T00:00:00+09:00",
		},
	},
	days: [
		{
			date: "2026-08-28T00:00:00+09:00",
			dayNumber: 1,
			id: "day-1",
			units: [
				{
					id: "unit-1",
					leg: {
						duration_minutes: 30,
						estimated_cost: { amount: 300, currency: "JPY" },
						from: { label: "東京" },
						id: "leg-1",
						mode: "train",
						to: { label: "京都", spot_id: "spot-1" },
					},
					spot: {
						description: "歴史的な通りを歩き、景色を楽しみます。",
						estimated_cost: { amount: 800, currency: "JPY" },
						id: "spot-1",
						name: "京都散策",
						start_at: "2026-08-28T10:00:00+09:00",
					},
				},
			],
		},
	],
	journeyId: "journey-1",
};

const pagePlan: readonly BookletPagePlan[] = [
	{ kind: "cover", pageId: "cover-journey-1" },
	{
		continuation: false,
		dayIndex: 0,
		kind: "day",
		pageId: "day-day-1-2",
		unitIndexes: [0],
	},
];

function resolvedTheme() {
	const requested = createBookletTheme({ value: 7, version: "v1" });
	const candidate = getThemeCandidates(requested)[0];
	if (!candidate) {
		throw new Error("テーマ候補がありません。");
	}
	return resolveBookletTheme(requested, candidate);
}

describe("BookletDocument", () => {
	it("正常系: A5全面表紙と実ページへ同一テーマキーを設定する", () => {
		const rootRef = createRef<HTMLElement>();
		const theme = resolvedTheme();
		const { container } = render(
			<BookletDocument
				model={model}
				pagePlan={pagePlan}
				rootRef={rootRef}
				theme={theme}
			/>,
		);

		const cover = container.querySelector(".booklet-page--cover");
		expect(cover?.querySelector(".booklet-cover__image")).toHaveAttribute(
			"src",
			"/cover.png",
		);
		expect(
			cover?.querySelector("svg.booklet-cover__panel"),
		).toBeInTheDocument();
		expect(
			container.querySelector(".booklet-page--day svg.booklet-page__surface"),
		).toBeInTheDocument();
		expect(container.querySelectorAll("[data-booklet-page]")).toHaveLength(2);
		expect(
			new Set(
				Array.from(
					container.querySelectorAll<HTMLElement>("[data-booklet-page]"),
				).map((page) => page.dataset.bookletThemeKey),
			),
		).toEqual(new Set([theme.resolvedThemeKey]));
	});

	it("境界値系: safe-coverを計測DOMだけでなくそのまま描画できる", () => {
		const requested = createBookletTheme({ value: 7, version: "v1" });
		const safeCandidate = getThemeCandidates({
			...requested,
			recipe: { ...requested.recipe, densityId: "airy" },
		}).at(-1);
		if (!safeCandidate) {
			throw new Error("安全候補がありません。");
		}
		const rootRef = createRef<HTMLDivElement>();
		const { container } = render(
			<BookletMeasurement
				model={model}
				rootRef={rootRef}
				theme={safeCandidate}
			/>,
		);
		expect(
			container.querySelector(".booklet-theme--cover-safe-cover"),
		).toBeInTheDocument();
		expect(
			container.querySelector("[data-booklet-cover-safe-area]"),
		).toBeInTheDocument();
		expect(
			container.querySelector("[data-booklet-text-role=spot-description]"),
		).toBeInTheDocument();
	});
});
