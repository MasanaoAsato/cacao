import { describe, expect, it } from "vitest";
import type { BookletModel } from "./model";
import { type BookletPageMeasurement, paginateBooklet } from "./paginate";

function makeModel(unitCount = 2): BookletModel {
	return {
		cover: {
			budget: { amount: 10000, currency: "JPY" },
			destination: "京都",
			destinationPlace: null,
			departure: "東京",
			departurePlace: null,
			image: {
				contentUrl: "/api/v1/journey-images/image-1/content",
				height: 1200,
				mediaType: "image/png",
				visualStyle: null,
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
				illustration: null,
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
		contentWidth: 100,
		days: [
			{
				continuationHeaderHeight: 15,
				headerHeight: 20,
				headerHeightWithoutIllustration: 20,
				unitHeights,
			},
		],
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

	it("境界値系: 合計が本文高さと等しい場合は同じページに置く", () => {
		const pages = paginateBooklet(makeModel(2), makeMeasurement([40, 40]));

		expect(pages).toHaveLength(2);
		expect(pages[1]).toMatchObject({ unitIndexes: [0, 1] });
	});

	it("正常系: 2列では1列目が埋まってから2列目、両列が埋まってから次ページへ送る", () => {
		const pages = paginateBooklet(makeModel(5), {
			...makeMeasurement([50, 40, 60, 30, 30]),
			columns: 2,
		});

		// 列の高さは 100 - 20 = 80: 1列目 [50]、2列目 [40] で両列が埋まり、
		// 継続ページ（高さ 100 - 15 = 85）は 1列目 [60]、2列目 [30, 30]。
		expect(pages).toHaveLength(3);
		expect(pages[1]).toMatchObject({
			continuation: false,
			unitIndexes: [0, 1],
		});
		expect(pages[2]).toMatchObject({
			continuation: true,
			unitIndexes: [2, 3, 4],
		});
	});

	it("境界値系: 2列でも1単位が列の高さを超えれば停止する", () => {
		expect(() =>
			paginateBooklet(makeModel(1), {
				...makeMeasurement([81]),
				columns: 2,
			}),
		).toThrow("収まりません");
	});

	it("異常系: 3列の計測値を拒否する", () => {
		expect(() =>
			paginateBooklet(makeModel(1), {
				...makeMeasurement([10]),
				columns: 3 as unknown as 2,
			}),
		).toThrow("列数が不正です");
	});

	it("正常系: 挿絵込みでは収まらない最初のSpotから挿絵を外す", () => {
		const model = makeModel(1);
		const day = model.days[0];
		if (!day) {
			throw new Error("日がありません。");
		}
		const modelWithIllustration: BookletModel = {
			...model,
			days: [
				{
					...day,
					illustration: {
						contentUrl: "/illustration.png",
						height: 900,
						mediaType: "image/png",
						visualStyle: null,
						width: 1200,
					},
				},
			],
		};
		const pages = paginateBooklet(modelWithIllustration, {
			contentHeight: 100,
			contentWidth: 100,
			days: [
				{
					continuationHeaderHeight: 15,
					headerHeight: 80,
					headerHeightWithoutIllustration: 20,
					unitHeights: [25],
				},
			],
		});

		expect(pages[1]).toMatchObject({ illustration: false, unitIndexes: [0] });
	});
});
