import { describe, expect, it } from "vitest";
import type { PolicyId } from "./editorialModel";
import { BookletDataError } from "./fromJourney";
import type { BookletModel } from "./model";
import { projectBooklet } from "./projectBooklet";

const model: BookletModel = {
	cover: {
		budget: { amount: 10000, currency: "JPY" },
		departure: "東京, Japan",
		departurePlace: { city: "東京", country: "Japan" },
		destination: "京都, Japan",
		destinationPlace: { city: "京都", country: "Japan" },
		image: {
			contentUrl: "/cover.png",
			height: 800,
			mediaType: "image/png",
			visualStyle: null,
			width: 1200,
		},
		period: {
			end_date: "2026-08-29T00:00:00+09:00",
			start_date: "2026-08-28T00:00:00+09:00",
		},
	},
	days: [
		{
			date: "2026-08-28T00:00:00+09:00",
			dayNumber: 1,
			id: "day-1",
			illustration: null,
			units: [
				{
					id: "leg-1:spot-1",
					leg: {
						duration_minutes: 30,
						estimated_cost: { amount: 300, currency: "JPY" },
						from: { label: "東京" },
						id: "leg-1",
						mode: "train",
						to: { label: "京都", spot_id: "spot-1" },
					},
					spot: {
						description: " 歴史的な通りを歩きます。次は景色を楽しみます。 ",
						estimated_cost: { amount: 800, currency: "JPY" },
						id: "spot-1",
						name: "京都散策",
						start_at: "2026-08-28T10:00:00+09:00",
					},
				},
			],
		},
	],
	journeyId: "journey-1",
};

function modelWithDescription(description: string): BookletModel {
	const day = model.days[0];
	if (!day) {
		throw new Error("テスト用の日程がありません。");
	}
	const unit = day.units[0];
	if (!unit) {
		throw new Error("テスト用の掲載単位がありません。");
	}

	return {
		...model,
		days: [
			{
				...day,
				units: [
					{
						...unit,
						spot: { ...unit.spot, description },
					},
				],
			},
		],
	};
}

describe("projectBooklet", () => {
	it.each([
		["legacy-full", "京都, Japan", "2026/08/28 10:00", true, true, true],
		["timetable", "京都", "10:00", false, false, true],
		["captions", "京都", "10:00", false, true, false],
		["route", "京都", "10:00", false, false, true],
	] as const)(
		"正常系: %sの掲載方針に必要な情報だけを射影する",
		(policyId, title, timeLabel, hasRoute, hasDescription, hasTransport) => {
			const projected = projectBooklet(model, policyId);
			const unit = projected.days[0]?.units[0];

			expect(projected.policyId).toBe(policyId);
			expect(projected.cover.title).toBe(title);
			expect(projected.cover.route === null).toBe(!hasRoute);
			expect(projected.cover.budget === null).toBe(!hasRoute);
			expect(unit).toMatchObject({
				id: "leg-1:spot-1",
				legId: "leg-1",
				spotId: "spot-1",
				timeLabel,
			});
			expect(unit?.description === null).toBe(!hasDescription);
			expect(unit?.transportMode === null).toBe(!hasTransport);
			expect(unit?.route === null).toBe(!hasRoute);
			expect(unit?.transportCost === null).toBe(
				policyId !== "legacy-full" && policyId !== "timetable",
			);
		},
	);

	it("異常系: 未登録の掲載方針を別の方針へ置き換えず拒否する", () => {
		expect(() => projectBooklet(model, "unknown-policy" as PolicyId)).toThrow(
			BookletDataError,
		);
	});

	it("境界値系: 短文はコードポイント単位で80文字まで保持する", () => {
		const character80 = "😀".repeat(80);
		const projected = projectBooklet(
			modelWithDescription(`\n${character80}x。\n`),
			"captions",
		);

		expect(projected.days[0]?.units[0]?.description).toBe(character80);
	});

	it.each([
		["0文字", "", null],
		["80文字", "a".repeat(80), "a".repeat(80)],
		["81文字", "a".repeat(81), "a".repeat(80)],
	])(
		"境界値系: 終端記号のない%sを決定的に掲載する",
		(_label, description, expected) => {
			const projected = projectBooklet(
				modelWithDescription(description),
				"captions",
			);

			expect(projected.days[0]?.units[0]?.description).toBe(expected);
		},
	);

	it("原データを変更せず、構成要素がない場合は既存の地名を表題に使う", () => {
		const before = structuredClone(model);
		const projected = projectBooklet(
			{
				...model,
				cover: { ...model.cover, destinationPlace: null },
			},
			"captions",
		);

		expect(projected.cover.title).toBe("京都, Japan");
		expect(model).toEqual(before);
	});
});
