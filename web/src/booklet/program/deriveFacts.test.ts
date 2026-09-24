import { describe, expect, it } from "vitest";
import type { BookletDay, BookletModel } from "../model";
import {
	deriveFacts,
	seasonalMotifFor,
	timeOfDayFor,
	timeSectionsFor,
} from "./deriveFacts";

function day(
	units: BookletDay["units"],
	date = "2026-03-01T00:00:00+09:00",
): BookletDay {
	return { date, dayNumber: 1, id: "day-1", illustration: null, units };
}

function unit(startAt: string, currency = "JPY", durationMinutes = 30) {
	return {
		id: startAt,
		leg: {
			duration_minutes: durationMinutes,
			estimated_cost: { amount: 100, currency },
			from: { id: "from", label: "出発地", name: "出発地" },
			id: `leg-${startAt}`,
			mode: "train",
			to: { id: "to", label: "到着地", name: "到着地" },
		},
		spot: {
			description: "",
			estimated_cost: { amount: 200, currency },
			id: `spot-${startAt}`,
			name: "訪問地",
			start_at: startAt,
		},
	};
}

function model(days: readonly BookletDay[]): BookletModel {
	return {
		cover: {
			budget: { amount: 1000, currency: "JPY" },
			departure: "東京",
			destination: "京都",
			departurePlace: null,
			destinationPlace: null,
			image: {
				contentUrl: "cover",
				height: 1,
				mediaType: "image/png",
				visualStyle: null,
				width: 1,
			},
			period: { start_date: "2026-03-01", end_date: "2026-03-01" },
		},
		days,
		journeyId: "journey",
	};
}

describe("deriveFacts", () => {
	it("正常系: 日内の連続した時間帯、移動分数、通貨別費用を導出する", () => {
		const facts = deriveFacts(
			model([
				day([
					unit("2026-03-01T06:00:00+09:00"),
					unit("2026-03-01T11:59:00+09:00"),
					unit("2026-03-01T12:00:00+09:00", "EUR", 40),
				]),
			]),
		);
		expect(
			facts.days[0].timeSections.map((section) => section.timeOfDay),
		).toEqual(["morning", "afternoon"]);
		expect(facts.movementMinutes).toBe(100);
		expect(facts.costTotals).toEqual([
			{ amount: 600, currency: "JPY" },
			{ amount: 300, currency: "EUR" },
		]);
	});

	it("正常系: 日ごとにも移動分数と同通貨の費用合計を持ち、通貨を跨いで加算しない", () => {
		const facts = deriveFacts(
			model([
				day([
					unit("2026-03-01T09:00:00+09:00", "JPY", 15),
					unit("2026-03-01T10:00:00+09:00", "EUR", 25),
				]),
				{ ...day([]), id: "day-2" },
			]),
		);
		expect(facts.days[0]).toMatchObject({
			costTotals: [
				{ amount: 300, currency: "JPY" },
				{ amount: 300, currency: "EUR" },
			],
			movementMinutes: 40,
		});
		expect(facts.days[1]).toMatchObject({ costTotals: [], movementMinutes: 0 });
	});

	it("異常系: RFC 3339ではない日時と不正な月を拒否する", () => {
		expect(() => timeOfDayFor("2026-03-01 10:00")).toThrow("時間帯");
		expect(() => timeOfDayFor("2026-03-01T任意文字列")).toThrow("時間帯");
		expect(() => seasonalMotifFor("2026-13-01")).toThrow("不正");
	});

	it("境界値系: 月と深夜の境界、空日の節を正しく扱う", () => {
		expect(seasonalMotifFor("2026-02-28")).toBe("winter");
		expect(seasonalMotifFor("2026-03-01")).toBe("spring");
		expect(timeOfDayFor("2026-03-01T00:00:00+09:00")).toBe("night");
		expect(timeOfDayFor("2026-03-01T17:00:00+09:00")).toBe("evening");
		expect(timeSectionsFor(day([]))).toEqual([]);
	});
});
