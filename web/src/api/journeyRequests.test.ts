import { describe, expect, it } from "vitest";
import { decodeJourneyRequest } from "./journeyRequests";

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
