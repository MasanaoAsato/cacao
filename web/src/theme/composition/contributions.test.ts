import { describe, expect, it } from "vitest";
import {
	ACTIVE_DIRECTION_DEFINITIONS,
	directionDefinitionById,
} from "../directions/registry";
import type { DirectionId } from "../directions/types";

function contributionIds(id: DirectionId): readonly string[] {
	return directionDefinitionById(id).contributions.map((item) => item.id);
}

describe("standardContributions", () => {
	it("正常系: 52方向すべてが章変化の操作を持ち、IDは方向内で一意", () => {
		for (const definition of ACTIVE_DIRECTION_DEFINITIONS) {
			const ids = definition.contributions.map((item) => item.id);
			expect(ids).toContain(`${definition.id}:chapter-style`);
			expect(new Set(ids).size).toBe(ids.length);
			for (const contribution of definition.contributions)
				expect(contribution.operations.length).toBeGreaterThan(0);
		}
	});

	it("正常系: 設計表の方向集合へ見出し・図版・画像処理・記入欄・章・本文構造を提供する", () => {
		expect(contributionIds("rail")).toContain("rail:heading-system");
		expect(contributionIds("wa-modern")).toContain("wa-modern:hero-art");
		expect(contributionIds("film")).toContain("film:image-treatment");
		expect(contributionIds("mission")).toContain("mission:participation");
		expect(contributionIds("day-story")).toContain("day-story:sequence");
		expect(contributionIds("map")).toContain("map:content-structure");
		expect(contributionIds("road-trip")).toContain("road-trip:surface-art");
	});

	it("正常系: 本文構造の交換元は各方向のbaseline moduleを参照する", () => {
		for (const definition of ACTIVE_DIRECTION_DEFINITIONS) {
			for (const contribution of definition.contributions) {
				for (const operation of contribution.operations) {
					if (operation.kind === "content-structure")
						expect(operation.sourceModuleId).toBe(definition.baseline().module);
				}
			}
		}
	});

	it("異常系: 配色だけの寄与は作らない（タッチのないご当地カラーに面の交換はない）", () => {
		expect(contributionIds("local-color")).toEqual([
			"local-color:chapter-style",
		]);
	});

	it("境界値系: 縦書きの見出しは縦書きを描くmoduleだけを要求する", () => {
		const heading = directionDefinitionById("japan-poster").contributions.find(
			(item) => item.id === "japan-poster:heading-system",
		);
		expect(heading?.requires.modules).toEqual(["vertical-poster"]);
		const horizontal = directionDefinitionById("rail").contributions.find(
			(item) => item.id === "rail:heading-system",
		);
		expect(horizontal?.requires.modules).toBeNull();
	});

	it("正常系: 25.1の画像処理と記入欄をbaseline自身の機能として持つ", () => {
		const config = (id: DirectionId) =>
			directionDefinitionById(id).baseline().config;
		expect(config("film").imageTreatment).toBe("film");
		expect(config("polaroid").imageTreatment).toBe("polaroid");
		expect(config("social").imageTreatment).toBe("post");
		expect(config("scrapbook").imageTreatment).toBe("collage");
		expect(config("stamp").participation).toBe("stamp");
		expect(config("checklist").participation).toBe("checklist");
		expect(config("mission").participation).toBe("mission");
		expect(config("memory-album").participation).toBe("memory-album");
	});
});
