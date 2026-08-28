import { describe, expect, it, vi } from "vitest";
import { decodeJourney, getJourney } from "./journeys";

const journeyPayload = {
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

describe("journeys API", () => {
	it("正常系: Journeyレスポンスをデコードできる", () => {
		const journey = decodeJourney(journeyPayload);

		expect(journey.days[0]?.spots[0]?.name).toBe("浅草");
		expect(journey.days[0]?.legs[0]?.to.spot_id).toBe("spot-1");
	});

	it("異常系: RFC 3339でない日時を拒否する", () => {
		expect(() =>
			decodeJourney({
				...journeyPayload,
				days: [{ ...journeyPayload.days[0], date: "2026/08/28" }],
			}),
		).toThrow("RFC 3339");
	});

	it("異常系: 暦として存在しないRFC 3339日時を拒否する", () => {
		expect(() =>
			decodeJourney({
				...journeyPayload,
				days: [
					{ ...journeyPayload.days[0], date: "2026-02-30T00:00:00+09:00" },
				],
			}),
		).toThrow("RFC 3339");
	});

	it("正常系: Journey取得はIDをURLエンコードする", async () => {
		const fetchImpl = vi.fn(
			async () => new Response(JSON.stringify(journeyPayload), { status: 200 }),
		);

		await getJourney("journey/1", { fetchImpl });

		expect(fetchImpl).toHaveBeenCalledWith(
			"/api/v1/journeys/journey%2F1",
			expect.objectContaining({ method: "GET" }),
		);
	});
});
