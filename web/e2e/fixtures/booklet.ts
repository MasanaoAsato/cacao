import type { Page } from "@playwright/test";

const journey = {
	days: [
		{
			date: "2026-08-28T00:00:00+09:00",
			id: "day-1",
			legs: [
				{
					duration_minutes: 35,
					estimated_cost: { amount: 420, currency: "JPY" },
					from: { label: "東京駅" },
					id: "leg-1",
					mode: "train",
					to: { label: "京都の長い目的地名称", spot_id: "spot-1" },
				},
			],
			spots: [
				{
					description:
						"長い連続英数字ABCDEFGHIJKLMN1234567890を含む説明文です。景色を楽しみながら、無理なく次の目的地へ向かいます。",
					estimated_cost: { amount: 1000, currency: "JPY" },
					id: "spot-1",
					name: "歴史地区をめぐる散策",
					start_at: "2026-08-28T10:00:00+09:00",
				},
			],
		},
		{
			date: "2026-08-29T00:00:00+09:00",
			id: "day-2",
			legs: [
				{
					duration_minutes: 20,
					estimated_cost: { amount: 210, currency: "JPY" },
					from: { label: "宿泊地" },
					id: "leg-2",
					mode: "walk",
					to: { label: "市場", spot_id: "spot-2" },
				},
			],
			spots: [
				{
					description: "朝の市場で地域の食材と文化を味わいます。",
					estimated_cost: { amount: 1200, currency: "JPY" },
					id: "spot-2",
					name: "朝の市場",
					start_at: "2026-08-29T09:30:00+09:00",
				},
			],
		},
	],
	day_count: 2,
	id: "journey-1",
	request_id: "request-1",
};

const request = {
	budget: { amount: 80000, currency: "JPY" },
	departure: "東京",
	destination: "非常に長い目的地名称を含む京都の旅",
	id: "request-1",
	period: {
		end_date: "2026-08-29T00:00:00+09:00",
		start_date: "2026-08-28T00:00:00+09:00",
	},
};

const imageList = {
	images: [
		{
			attempt_count: 1,
			content_url: "/api/v1/journey-images/image-1/content",
			failure_code: null,
			height: 1200,
			id: "image-1",
			media_type: "image/svg+xml",
			slot: { ordinal: 1, purpose: "cover" },
			status: "ready",
			width: 800,
		},
	],
	journey_request_id: "request-1",
};

const coverSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1200" viewBox="0 0 800 1200">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#1f4968"/><stop offset="1" stop-color="#d58a5b"/></linearGradient></defs>
  <rect width="800" height="1200" fill="url(#g)"/>
  <circle cx="580" cy="250" r="170" fill="#f9d88d" opacity=".82"/>
  <path d="M0 900 C220 760 430 1080 800 820 V1200 H0Z" fill="#183a42" opacity=".72"/>
</svg>`;

export async function routeBookletApi(page: Page): Promise<void> {
	await page.route("**/api/v1/**", async (route) => {
		const url = route.request().url();
		if (url.endsWith("/journeys/journey-1")) {
			await route.fulfill({ json: journey });
			return;
		}
		if (url.endsWith("/journey-requests/request-1/images")) {
			await route.fulfill({ json: imageList });
			return;
		}
		if (url.endsWith("/journey-requests/request-1")) {
			await route.fulfill({ json: request });
			return;
		}
		if (url.endsWith("/journey-images/image-1/content")) {
			await route.fulfill({ body: coverSvg, contentType: "image/svg+xml" });
			return;
		}
		await route.fallback();
	});
}
