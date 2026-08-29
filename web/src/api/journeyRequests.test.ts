import { describe, expect, it, vi } from "vitest";
import {
	createJourneyRequest,
	decodeCreateJourneyRequest,
	decodeJourneyRequest,
} from "./journeyRequests";

const requestPayload = {
	budget: { amount: 80000, currency: "JPY" },
	departure: "東京",
	destination: "京都",
	id: "request-1",
	period: {
		end_date: "2026-08-30T00:00:00+09:00",
		start_date: "2026-08-28T00:00:00+09:00",
	},
};

describe("journey requests API", () => {
	it("正常系: 旅程リクエスト作成レスポンスをデコードできる", () => {
		expect(decodeCreateJourneyRequest({ request_id: "request-1" })).toEqual({
			request_id: "request-1",
		});
	});

	it("異常系: 作成レスポンスにrequest_idがなければ拒否する", () => {
		expect(() => decodeCreateJourneyRequest({})).toThrow("request_id");
	});

	it("正常系: 作成POSTは全フィールドをJSONで送信する", async () => {
		const fetchImpl = vi.fn(
			async () =>
				new Response(JSON.stringify({ request_id: "request-1" }), {
					status: 201,
				}),
		);
		const payload = {
			amount: 90000,
			currency: "JPY",
			departure_city: "千葉",
			departure_country: "Japan",
			destination_city: "宇都宮",
			destination_country: "Japan",
			end_date: "2026-10-25T00:00:00Z",
			start_date: "2026-10-23T00:00:00Z",
		};

		await createJourneyRequest(payload, { fetchImpl });

		expect(fetchImpl).toHaveBeenCalledWith(
			"/api/v1/journey-requests",
			expect.objectContaining({
				body: JSON.stringify(payload),
				method: "POST",
			}),
		);
	});

	it("正常系: 旅程リクエストをデコードできる", () => {
		expect(decodeJourneyRequest(requestPayload)).toEqual(requestPayload);
	});

	it("異常系: 予算の通貨がないレスポンスを拒否する", () => {
		expect(() =>
			decodeJourneyRequest({
				...requestPayload,
				budget: { amount: 80000 },
			}),
		).toThrow("currency");
	});

	it("境界値系: 開始日と終了日が同じレスポンスを受け付ける", () => {
		const sameDay = {
			...requestPayload,
			period: {
				end_date: "2026-08-28T00:00:00+09:00",
				start_date: "2026-08-28T00:00:00+09:00",
			},
		};

		expect(decodeJourneyRequest(sameDay).period).toEqual(sameDay.period);
	});
});
