import { describe, expect, it, vi } from "vitest";
import {
	decodeJourneyImageList,
	type JourneyImageApiResponse,
	requestCoverImage,
	retryJourneyImage,
	selectCoverImage,
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

	it("正常系: 表紙スロットを選択できる", () => {
		const response = decodeJourneyImageList({
			images: [readyCover],
			journey_request_id: "request-1",
		});

		expect(selectCoverImage(response.images)).toEqual(readyCover);
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
});
