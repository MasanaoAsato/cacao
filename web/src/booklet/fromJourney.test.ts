import { describe, expect, it } from "vitest";
import type { JourneyImageApiResponse } from "../api/journeyImages";
import type { JourneyRequestApiResponse } from "../api/journeyRequests";
import type { JourneyApiResponse } from "../api/journeys";
import { CoverImageNotReadyError, createBookletModel } from "./fromJourney";

const journey: JourneyApiResponse = {
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
					to: { label: "浅草", spot_id: "spot-1" },
				},
			],
			spots: [
				{
					description: "川沿いを歩く。",
					estimated_cost: { amount: 1000, currency: "JPY" },
					id: "spot-1",
					name: "浅草",
					start_at: "2026-08-28T10:00:00+09:00",
				},
			],
		},
	],
	day_count: 1,
	id: "journey-1",
	request_id: "request-1",
};

const request: JourneyRequestApiResponse = {
	budget: { amount: 80000, currency: "JPY" },
	departure: "東京",
	destination: "京都",
	id: "request-1",
	period: {
		end_date: "2026-08-30T00:00:00+09:00",
		start_date: "2026-08-28T00:00:00+09:00",
	},
};

const coverImage: JourneyImageApiResponse = {
	attempt_count: 1,
	content_url: "/api/v1/journey-images/image-1/content",
	failure_code: null,
	height: 1200,
	id: "image-1",
	media_type: "image/png",
	slot: { ordinal: 1, purpose: "cover" },
	status: "ready",
	visual_style: "editorial-photograph",
	width: 800,
};

describe("createBookletModel", () => {
	it("正常系: APIデータを到着単位のモデルへ変換する", () => {
		const model = createBookletModel({ coverImage, journey, request });

		expect(model.cover.destination).toBe("京都");
		expect(model.days[0]?.units[0]?.leg.to.spot_id).toBe("spot-1");
		expect(model.days[0]?.units[0]?.spot.name).toBe("浅草");
	});

	it("正常系: 未知の画風はnullとしてモデルへ変換する", () => {
		const model = createBookletModel({
			coverImage: { ...coverImage, visual_style: "unknown-style" },
			journey,
			request,
		});

		expect(model.cover.image.visualStyle).toBeNull();
	});

	it("異常系: 表紙画像が未準備ならモデルを作らない", () => {
		expect(() =>
			createBookletModel({
				coverImage: { ...coverImage, status: "processing" },
				journey,
				request,
			}),
		).toThrow(CoverImageNotReadyError);
	});

	it("異常系: 表紙画像URLが対象画像のcontent endpointでなければ拒否する", () => {
		expect(() =>
			createBookletModel({
				coverImage: {
					...coverImage,
					content_url: "https://example.com/cover.png",
				},
				journey,
				request,
			}),
		).toThrow("URL");
	});

	it("異常系: SpotとLegの件数が異なる場合は対応付けない", () => {
		expect(() =>
			createBookletModel({
				coverImage,
				journey: {
					...journey,
					days: [{ ...journey.days[0], legs: [] }],
				},
				request,
			}),
		).toThrow("件数");
	});

	it("境界値系: 期間が同じ日時でもモデルを作れる", () => {
		const sameDayRequest = {
			...request,
			period: {
				end_date: request.period.start_date,
				start_date: request.period.start_date,
			},
		};

		expect(
			createBookletModel({ coverImage, journey, request: sameDayRequest }).cover
				.period,
		).toEqual(sameDayRequest.period);
	});
});
