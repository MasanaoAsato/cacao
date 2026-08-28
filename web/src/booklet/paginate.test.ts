import { describe, expect, it } from "vitest";
import type { BookletModel } from "./model";
import { type BookletPageMeasurement, paginateBooklet } from "./paginate";

function makeModel(unitCount = 2): BookletModel {
	return {
		cover: {
			budget: { amount: 10000, currency: "JPY" },
			destination: "京都",
			departure: "東京",
			image: {
				contentUrl: "/api/v1/journey-images/image-1/content",
				height: 1200,
				mediaType: "image/png",
				width: 800,
			},
			period: {
				end_date: "2026-08-28T00:00:00+09:00",
				start_date: "2026-08-28T00:00:00+09:00",
			},
		},
		days: [
			{
				date: "2026-08-28T00:00:00+09:00",
				dayNumber: 1,
				id: "day-1",
				units: Array.from({ length: unitCount }, (_, index) => ({
					id: `unit-${index + 1}`,
					leg: {
						duration_minutes: 20,
						estimated_cost: { amount: 100, currency: "JPY" },
						from: { label: "出発地" },
						id: `leg-${index + 1}`,
						mode: "train",
						to: { label: `Spot ${index + 1}`, spot_id: `spot-${index + 1}` },
					},
					spot: {
						description: "説明",
						estimated_cost: { amount: 100, currency: "JPY" },
						id: `spot-${index + 1}`,
						name: `Spot ${index + 1}`,
						start_at: "2026-08-28T10:00:00+09:00",
					},
				})),
			},
		],
		journeyId: "journey-1",
	};
}

function makeMeasurement(
	unitHeights: readonly number[],
): BookletPageMeasurement {
	return {
		contentHeight: 100,
		coverHeight: 40,
		days: [{ continuationHeaderHeight: 15, headerHeight: 20, unitHeights }],
	};
}

describe("paginateBooklet", () => {
	it("正常系: 収まる複数Spotは同じページに配置する", () => {
		const pages = paginateBooklet(makeModel(2), makeMeasurement([35, 35]));

		expect(pages).toHaveLength(2);
		expect(pages[1]).toMatchObject({ kind: "day", unitIndexes: [0, 1] });
	});

	it("正常系: 日の境界とSpot境界を守って分割する", () => {
		const pages = paginateBooklet(makeModel(3), makeMeasurement([30, 30, 30]));

		expect(pages).toHaveLength(3);
		expect(pages[1]).toMatchObject({
			continuation: false,
			unitIndexes: [0, 1],
		});
		expect(pages[2]).toMatchObject({ continuation: true, unitIndexes: [2] });
	});

	it("異常系: 単一Spotがヘッダー込みで収まらない場合は停止する", () => {
		expect(() => paginateBooklet(makeModel(1), makeMeasurement([81]))).toThrow(
			"収まりません",
		);
	});

	it("異常系: 表紙が本文高さを超える場合は停止する", () => {
		expect(() =>
			paginateBooklet(makeModel(), {
				...makeMeasurement([20, 20]),
				coverHeight: 101,
			}),
		).toThrow("表紙");
	});

	it("境界値系: 合計が本文高さと等しい場合は同じページに置く", () => {
		const pages = paginateBooklet(makeModel(2), makeMeasurement([40, 40]));

		expect(pages).toHaveLength(2);
		expect(pages[1]).toMatchObject({ unitIndexes: [0, 1] });
	});
});
