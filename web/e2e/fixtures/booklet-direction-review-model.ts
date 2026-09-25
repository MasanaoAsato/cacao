import type { BookletModel } from "../../src/booklet/model";

const VISIT_TIMES = ["09:30", "11:00", "14:00", "16:00"] as const;
const VISITS = [
	"歴史地区の散策",
	"朝の市場",
	"川沿いの庭園",
	"町の工芸館",
] as const;
const COVER = "/e2e/fixtures/images/cover-scene.png";
const ILLUSTRATION = "/e2e/fixtures/images/illustration-scene.png";

/** Fixed, image-complete three-day trip shared by all 52 draft previews. */
export const REVIEW_MODEL: BookletModel = {
	cover: {
		budget: { amount: 80000, currency: "JPY" },
		departure: "東京",
		departurePlace: { city: "東京", country: "日本" },
		destination: "京都",
		destinationPlace: { city: "京都", country: "日本" },
		image: {
			contentUrl: COVER,
			height: 1200,
			mediaType: "image/png",
			visualStyle: null,
			width: 800,
		},
		period: {
			start_date: "2026-08-28T00:00:00+09:00",
			end_date: "2026-08-30T00:00:00+09:00",
		},
	},
	days: [1, 2, 3].map((number) => {
		const date = `2026-08-${27 + number}`;
		return {
			date: `${date}T00:00:00+09:00`,
			dayNumber: number,
			id: `review-day-${number}`,
			illustration: {
				contentUrl: ILLUSTRATION,
				height: 900,
				mediaType: "image/png",
				visualStyle: null,
				width: 1200,
			},
			units: VISITS.map((name, index) => {
				const spotId = `review-${number}-spot-${index + 1}`;
				return {
					id: `review-${number}-unit-${index + 1}`,
					leg: {
						duration_minutes: 20,
						estimated_cost: { amount: 350, currency: "JPY" },
						from: { label: index === 0 ? "宿泊地" : VISITS[index - 1] },
						id: `review-${number}-leg-${index + 1}`,
						mode: index % 2 === 0 ? "train" : "walk",
						to: { label: name, spot_id: spotId },
					},
					spot: {
						description: "景色と地域の文化をゆっくり楽しみます。",
						estimated_cost: { amount: 1200, currency: "JPY" },
						id: spotId,
						name,
						start_at: `${date}T${VISIT_TIMES[index]}:00+09:00`,
					},
				};
			}),
		};
	}),
	journeyId: "review-fixture-only",
};

/** Four valid month samples expose every seasonal view without changing the itinerary. */
export const SEASON_REVIEW_MONTHS = ["03", "08", "09", "12"] as const;
export type SeasonReviewMonth = (typeof SEASON_REVIEW_MONTHS)[number];

export function reviewModelForMonth(month: SeasonReviewMonth): BookletModel {
	if (month === "08") return REVIEW_MODEL;
	const moveMonth = (date: string) =>
		date.replace(/^2026-08-/, `2026-${month}-`);
	return {
		...REVIEW_MODEL,
		cover: {
			...REVIEW_MODEL.cover,
			period: {
				start_date: moveMonth(REVIEW_MODEL.cover.period.start_date),
				end_date: moveMonth(REVIEW_MODEL.cover.period.end_date),
			},
		},
		days: REVIEW_MODEL.days.map((day) => ({
			...day,
			date: moveMonth(day.date),
			units: day.units.map((unit) => ({
				...unit,
				spot: { ...unit.spot, start_at: moveMonth(unit.spot.start_at) },
			})),
		})),
	};
}
