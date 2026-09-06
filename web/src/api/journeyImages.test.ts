import { describe, expect, it, vi } from "vitest";
import {
	decodeJourneyImageList,
	type JourneyImageApiResponse,
	requestCoverImage,
	requestJourneyImages,
	retryJourneyImage,
	selectCoverImage,
	selectIllustrations,
} from "./journeyImages";

const readyCover: JourneyImageApiResponse = {
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

const readyIllustration = (ordinal: number): JourneyImageApiResponse => ({
	attempt_count: 1,
	content_url: `/api/v1/journey-images/illustration-${ordinal}/content`,
	failure_code: null,
	height: 900,
	id: `illustration-${ordinal}`,
	media_type: "image/png",
	slot: { ordinal, purpose: "illustration" },
	status: "ready",
	visual_style: null,
	width: 1200,
});

describe("journey images API", () => {
	it("正常系: 表紙画像要求POSTはcoverスロットだけを送信する", async () => {
		const fetchImpl = vi.fn(
			async () =>
				new Response(
					JSON.stringify({
						images: [readyCover],
						journey_request_id: "request-1",
					}),
					{ status: 202 },
				),
		);

		await requestCoverImage("request/1", { fetchImpl });

		expect(fetchImpl).toHaveBeenCalledWith(
			"/api/v1/journey-requests/request%2F1/images",
			expect.objectContaining({
				body: JSON.stringify({ slots: [{ ordinal: 1, purpose: "cover" }] }),
				method: "POST",
			}),
		);
	});

	it("正常系: 失敗画像のretry POSTをデコードできる", async () => {
		const fetchImpl = vi.fn(
			async () => new Response(JSON.stringify(readyCover), { status: 202 }),
		);

		await retryJourneyImage("image/1", { fetchImpl });

		expect(fetchImpl).toHaveBeenCalledWith(
			"/api/v1/journey-images/image%2F1/retry",
			expect.objectContaining({ method: "POST" }),
		);
	});

	it("正常系: 表紙と挿絵の複数スロットを1回のPOSTで送信する", async () => {
		const fetchImpl = vi.fn(
			async () =>
				new Response(
					JSON.stringify({
						images: [readyCover, readyIllustration(1)],
						journey_request_id: "request-1",
					}),
					{ status: 202 },
				),
		);
		const slots = [
			{ ordinal: 1, purpose: "cover" as const },
			{ ordinal: 1, purpose: "illustration" as const },
		];

		await requestJourneyImages("request-1", slots, { fetchImpl });

		expect(fetchImpl).toHaveBeenCalledWith(
			"/api/v1/journey-requests/request-1/images",
			expect.objectContaining({
				body: JSON.stringify({ slots }),
				method: "POST",
			}),
		);
	});

	it("正常系: 表紙スロットを選択できる", () => {
		const response = decodeJourneyImageList({
			images: [readyCover],
			journey_request_id: "request-1",
		});

		expect(selectCoverImage(response.images)).toEqual(readyCover);
	});

	it("正常系: 挿絵を序数順に選択できる", () => {
		const images = [readyIllustration(3), readyIllustration(1)];

		expect(selectIllustrations(images)).toEqual([
			readyIllustration(1),
			readyIllustration(3),
		]);
	});

	it("異常系: 表紙スロットが複数なら拒否する", () => {
		expect(() =>
			selectCoverImage([readyCover, { ...readyCover, id: "image-2" }]),
		).toThrow("複数");
	});

	it("異常系: 未知の画像状態を拒否する", () => {
		expect(() =>
			decodeJourneyImageList({
				images: [{ ...readyCover, status: "queued" }],
				journey_request_id: "request-1",
			}),
		).toThrow("未知");
	});

	it("境界値系: 表紙スロットがない場合はnullを返す", () => {
		expect(
			selectCoverImage([
				{ ...readyCover, slot: { ordinal: 1, purpose: "spot" } },
			]),
		).toBe(null);
	});

	it("境界値系: 挿絵がない場合は空配列を返す", () => {
		expect(selectIllustrations([readyCover])).toEqual([]);
	});
});
