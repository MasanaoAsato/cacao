import { describe, expect, it } from "vitest";
import { COMPARISON_BOOKLET_MODEL } from "../../../e2e/fixtures/booklet-diversity";
import { productionCompositionCatalog } from "./compileBooklet";
import { testDay, testModel } from "./compositionTestKit";
import { distributionIssues, sampleDistribution } from "./distribution";

const STANDARD = COMPARISON_BOOKLET_MODEL;
const LONG = testModel({
	days: [1, 2, 3, 4].map((day) =>
		testDay(`d${day}`, day, [
			"08:00",
			"09:30",
			"11:00",
			"12:30",
			"14:00",
			"15:30",
			"17:00",
			"18:30",
		]),
	),
});

describe("製品compilerのseed分布", () => {
	it("正常系: 3日×4予定と長い4日旅程を、実際のactive catalogで集計する", () => {
		const catalog = productionCompositionCatalog();
		if (process.env.ARTWORK_RELEASE_CHECK === "1")
			expect(
				catalog.maxDirections,
				"複合方向の公開審査には上限5以上が必要です",
			).toBeGreaterThanOrEqual(5);
		const count = process.env.ARTWORK_RELEASE_CHECK === "1" ? 1000 : 32;
		for (const model of [STANDARD, LONG]) {
			const report = sampleDistribution(model, catalog, count);
			expect(
				Object.values(report.buckets).reduce((sum, count) => sum + count, 0) +
					report.failures.length,
			).toBe(count);
			expect(
				Object.values(report.byBase).reduce((sum, count) => sum + count, 0),
			).toBe(count - report.failures.length);
			expect(
				Object.values(report.stopReasons).reduce(
					(sum, count) => sum + count,
					0,
				),
			).toBe(count - report.failures.length);
			// Release conditions are checked only at stage C: drafts are not reviewed output.
			if (process.env.ARTWORK_RELEASE_CHECK === "1") {
				console.info(
					JSON.stringify({
						journey: model.days.length === 3 ? "standard" : "long",
						report,
					}),
				);
				expect(distributionIssues(report)).toEqual([]);
			}
		}
	});

	it("異常系・境界値系: 候補なし・50件未満・compile失敗を公開条件で拒否する", () => {
		const report = sampleDistribution(
			STANDARD,
			{ artwork: [], directions: [], revision: "empty" },
			1,
		);
		expect(report.failures).toEqual([{ seed: 0, code: "empty-catalog" }]);
		expect(distributionIssues(report)).toHaveLength(5);
	});

	it("境界値系: 日0・空日・未登録地域は存在しない表現数を強制しない", () => {
		const catalog = productionCompositionCatalog();
		for (const model of [
			testModel({ days: [] }),
			testModel({ days: [testDay("empty", 1, [])] }),
			testModel({ destinationPlace: { city: "未知の街", country: "日本" } }),
		]) {
			const report = sampleDistribution(model, catalog, 16);
			expect(report.failures).toEqual([]);
			expect(
				Object.values(report.buckets).reduce((sum, count) => sum + count, 0),
			).toBe(16);
		}
	});
});
