import type { Page } from "@playwright/test";

export const COMPARISON_EXPECTED_UNITS = Array.from(
	{ length: 12 },
	(_, index) => {
		const ordinal = index + 1;
		const hour = ["09", "11", "14", "16"][index % 4] ?? "09";
		return {
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
				description:
					ordinal === 4
						? ""
						: "比較用に固定した説明文です。京都の街並みと文化をゆっくり楽しみます。",
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

const comparisonImageList = {
	images: [
		{
			attempt_count: 1,
			content_url: "/api/v1/journey-images/comparison-cover/content",
			failure_code: null,
			height: 1200,
			id: "comparison-cover",
			media_type: "image/svg+xml",
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
			media_type: "image/svg+xml",
			slot: { ordinal: 1, purpose: "illustration" },
			status: "ready",
			visual_style: null,
			width: 1200,
		},
	],
	journey_request_id: "request-comparison",
};

const comparisonSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1200" viewBox="0 0 800 1200">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#1f4968"/><stop offset="1" stop-color="#d58a5b"/></linearGradient></defs>
  <rect width="800" height="1200" fill="url(#g)"/>
  <circle cx="580" cy="250" r="170" fill="#f9d88d" opacity=".82"/>
  <path d="M0 900 C220 760 430 1080 800 820 V1200 H0Z" fill="#183a42" opacity=".72"/>
</svg>`;

export const comparisonSvgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(comparisonSvg)}`;

export async function routeComparisonBookletApi(page: Page): Promise<void> {
	await page.route("**/api/v1/**", async (route) => {
		const url = route.request().url();
		if (url.endsWith("/journeys/journey-comparison")) {
			await route.fulfill({ json: comparisonJourney });
			return;
		}
		if (url.endsWith("/journey-requests/request-comparison/images")) {
			await route.fulfill({ json: comparisonImageList });
			return;
		}
		if (url.endsWith("/journey-requests/request-comparison")) {
			await route.fulfill({ json: comparisonRequest });
			return;
		}
		if (url.includes("/journey-images/") && url.endsWith("/content")) {
			await route.fulfill({
				body: comparisonSvg,
				contentType: "image/svg+xml",
			});
			return;
		}
		await route.fallback();
	});
}
