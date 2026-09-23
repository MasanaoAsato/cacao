import { describe, expect, it } from "vitest";
import {
	ACTIVE_DIRECTION_IDS,
	DIRECTION_REGISTRY,
	isDirectionEligible,
} from "./registry";

function requiredDirection(id: "local-color" | "local-motif") {
	const definition = DIRECTION_REGISTRY.get(id);
	if (!definition) throw new Error(`方向「${id}」が登録されていません。`);
	return definition;
}

describe("direction catalog", () => {
	it("正常系: 52方向はそれぞれ単独で全冊子coverageを持つ", () => {
		expect(ACTIVE_DIRECTION_IDS).toHaveLength(52);
		expect(new Set(ACTIVE_DIRECTION_IDS).size).toBe(52);
		for (const definition of DIRECTION_REGISTRY.values()) {
			expect(definition.baseline().coverage).toEqual({
				continuationPage: true,
				cover: true,
				emptyDay: true,
				fullItinerary: true,
			});
			expect(definition.contributions).not.toHaveLength(0);
		}
	});

	it("異常系: 未登録地ではご当地の2方向を候補に入れない", () => {
		const context = { destinationPlace: { city: "新京都", country: "日本" } };
		expect(isDirectionEligible(requiredDirection("local-color"), context)).toBe(
			false,
		);
		expect(isDirectionEligible(requiredDirection("local-motif"), context)).toBe(
			false,
		);
	});

	it("境界値系: 登録地はご当地の2方向を候補にできる", () => {
		const context = { destinationPlace: { city: "東京", country: "日本" } };
		expect(isDirectionEligible(requiredDirection("local-color"), context)).toBe(
			true,
		);
		expect(isDirectionEligible(requiredDirection("local-motif"), context)).toBe(
			true,
		);
	});
});
