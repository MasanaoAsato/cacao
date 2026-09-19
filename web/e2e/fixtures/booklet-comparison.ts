import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import { bookletFixtureJourneyId, routeBookletApi } from "./booklet.js";

export const COMPARISON_EXPECTED_UNITS = Array.from(
	{ length: 12 },
	(_, index) => {
		const ordinal = index + 1;
		const hour = ["09", "11", "14", "16"][index % 4] ?? "09";
		return {
			description:
				ordinal === 4
					? ""
					: "比較用に固定した説明文です。京都の街並みと文化をゆっくり楽しみます。",
			id: `comparison-leg-${ordinal}:comparison-spot-${ordinal}`,
			name:
				ordinal === 7
					? "京都国際マンガミュージアムABCDEFGHIJKLMN1234567890で企画展を鑑賞"
					: `京都を味わう訪問先 ${ordinal}`,
			startAt: `2026-08-${String(28 + Math.floor(index / 4)).padStart(2, "0")}T${hour}:00:00+09:00`,
		};
	},
);

const comparisonJourney = {
	days: Array.from({ length: 3 }, (_, dayIndex) => {
		const dayOrdinal = dayIndex + 1;
		const spots = Array.from({ length: 4 }, (_, spotIndex) => {
			const ordinal = dayIndex * 4 + spotIndex + 1;
			const expected = COMPARISON_EXPECTED_UNITS[ordinal - 1];
			if (!expected) {
				throw new Error("比較用の掲載単位を作成できません。");
			}
			return {
				description: expected.description,
				estimated_cost: { amount: 800 + ordinal * 100, currency: "JPY" },
				id: `comparison-spot-${ordinal}`,
				name: expected.name,
				start_at: expected.startAt,
			};
		});
		return {
			date: `2026-08-${String(27 + dayOrdinal).padStart(2, "0")}T00:00:00+09:00`,
			id: `comparison-day-${dayOrdinal}`,
			legs: spots.map((spot, spotIndex) => {
				const ordinal = dayIndex * 4 + spotIndex + 1;
				return {
					duration_minutes: 20 + ordinal * 5,
					estimated_cost: { amount: 250 + ordinal * 25, currency: "JPY" },
					from: {
						label:
							ordinal === 1 ? "東京駅" : `京都を味わう訪問先 ${ordinal - 1}`,
					},
					id: `comparison-leg-${ordinal}`,
					mode: ordinal % 2 === 0 ? "walk" : "train",
					to: { label: spot.name, spot_id: spot.id },
				};
			}),
			spots,
		};
	}),
	day_count: 3,
	id: "journey-comparison",
	request_id: "request-comparison",
};

const comparisonRequest = {
	budget: { amount: 60000, currency: "JPY" },
	departure: "東京",
	destination: "京都",
	id: "request-comparison",
	period: {
		end_date: "2026-08-30T00:00:00+09:00",
		start_date: "2026-08-28T00:00:00+09:00",
	},
};

const comparisonEmptyDayJourney = {
	...comparisonJourney,
	days: [
		{
			...comparisonJourney.days[0],
			id: "comparison-empty-day",
			legs: [],
			spots: [],
		},
		...comparisonJourney.days,
	],
	day_count: 4,
	id: "journey-comparison-empty-day",
	request_id: "request-comparison-empty-day",
};

const comparisonNoDaysJourney = {
	...comparisonJourney,
	days: [],
	day_count: 0,
	id: "journey-comparison-no-days",
	request_id: "request-comparison-no-days",
};

const comparisonImageList = {
	images: [
		{
			attempt_count: 1,
			content_url: "/api/v1/journey-images/comparison-cover/content",
			failure_code: null,
			height: 1200,
			id: "comparison-cover",
			media_type: "image/png",
			slot: { ordinal: 1, purpose: "cover" },
			status: "ready",
			visual_style: "editorial-photograph",
			width: 800,
		},
		{
			attempt_count: 1,
			content_url: "/api/v1/journey-images/comparison-illustration/content",
			failure_code: null,
			height: 900,
			id: "comparison-illustration",
			media_type: "image/png",
			slot: { ordinal: 1, purpose: "illustration" },
			status: "ready",
			visual_style: null,
			width: 1200,
		},
	],
	journey_request_id: "request-comparison",
};

type ComparisonApiFixture = {
	readonly imageList: typeof comparisonImageList;
	readonly journey: typeof comparisonJourney;
	readonly request: typeof comparisonRequest;
};

const comparisonFixtures = {
	"empty-day": {
		imageList: {
			...comparisonImageList,
			journey_request_id: "request-comparison-empty-day",
		},
		journey: comparisonEmptyDayJourney,
		request: { ...comparisonRequest, id: "request-comparison-empty-day" },
	},
	"no-days": {
		imageList: {
			...comparisonImageList,
			journey_request_id: "request-comparison-no-days",
		},
		journey: comparisonNoDaysJourney,
		request: { ...comparisonRequest, id: "request-comparison-no-days" },
	},
	standard: {
		imageList: comparisonImageList,
		journey: comparisonJourney,
		request: comparisonRequest,
	},
} as const satisfies Readonly<
	Record<"empty-day" | "no-days" | "standard", ComparisonApiFixture>
>;

const comparisonCoverPng = readFileSync(
	new URL("./images/cover-scene.png", import.meta.url),
);
const comparisonIllustrationPng = readFileSync(
	new URL("./images/illustration-scene.png", import.meta.url),
);

export const comparisonCoverDataUrl = `data:image/png;base64,${comparisonCoverPng.toString("base64")}`;
export const comparisonIllustrationDataUrl = `data:image/png;base64,${comparisonIllustrationPng.toString("base64")}`;

export type ComparisonFixtureScenario =
	| "dense"
	| "empty-day"
	| "no-days"
	| "standard";

export function comparisonJourneyId(
	scenario: ComparisonFixtureScenario,
): string {
	if (scenario === "dense") {
		return bookletFixtureJourneyId("dense");
	}
	return comparisonFixtures[scenario].journey.id;
}

export async function routeComparisonBookletApi(
	page: Page,
	scenario: ComparisonFixtureScenario = "standard",
): Promise<void> {
	if (scenario === "dense") {
		await routeBookletApi(page, "dense", "artwork");
		return;
	}
	const fixture = comparisonFixtures[scenario];
	await page.route("**/api/v1/**", async (route) => {
		const url = route.request().url();
		if (url.endsWith(`/journeys/${fixture.journey.id}`)) {
			await route.fulfill({ json: fixture.journey });
			return;
		}
		if (
			url.endsWith(
				`/journey-requests/${fixture.imageList.journey_request_id}/images`,
			)
		) {
			await route.fulfill({ json: fixture.imageList });
			return;
		}
		if (url.endsWith(`/journey-requests/${fixture.request.id}`)) {
			await route.fulfill({ json: fixture.request });
			return;
		}
		if (url.includes("/journey-images/") && url.endsWith("/content")) {
			await route.fulfill({
				body: url.includes("illustration")
					? comparisonIllustrationPng
					: comparisonCoverPng,
				contentType: "image/png",
			});
			return;
		}
		await route.fallback();
	});
}
