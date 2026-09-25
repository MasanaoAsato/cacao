import { describe, expect, it } from "vitest";
import { ARTWORK_CATALOG } from "../artwork/catalog";
import { REGISTERED_DIRECTION_DEFINITIONS } from "../directions/registry";
import {
	activeDirectionDefinitions,
	isDirectionArtworkReady,
} from "./activeDirections";
import { compileBooklet, productionCompositionCatalog } from "./compileBooklet";
import { REVIEWED_TEST_ARTWORK, testModel } from "./compositionTestKit";

const ALL_IDS = new Set(
	REGISTERED_DIRECTION_DEFINITIONS.map((item) => item.id),
);

// These four directions deliberately use no authored decoration.
const ART_INDEPENDENT = ["minimal", "photo-book", "local-color", "practical"];

describe("activeDirectionDefinitions", () => {
	it("正常系: 全素材が審査済みなら登録52方向がすべてactive", () => {
		expect(
			activeDirectionDefinitions(
				REGISTERED_DIRECTION_DEFINITIONS,
				REVIEWED_TEST_ARTWORK,
				ALL_IDS,
			),
		).toHaveLength(52);
	});

	it("異常系: active素材がなければ、素材を使う方向は公開候補から外れる", () => {
		const active = activeDirectionDefinitions(
			REGISTERED_DIRECTION_DEFINITIONS,
			[],
			ALL_IDS,
		);
		const inactive = REGISTERED_DIRECTION_DEFINITIONS.filter(
			(definition) => !active.includes(definition),
		).map((definition) => definition.id);
		expect(new Set(inactive)).toEqual(
			new Set(
				REGISTERED_DIRECTION_DEFINITIONS.map(
					(definition) => definition.id,
				).filter((id) => !ART_INDEPENDENT.includes(id)),
			),
		);
		// Registered order is kept for the remaining directions.
		expect(active.map((definition) => definition.id)).toEqual(
			REGISTERED_DIRECTION_DEFINITIONS.map(
				(definition) => definition.id,
			).filter((id) => ART_INDEPENDENT.includes(id)),
		);
	});

	it("異常系: 共用素材を使う未承認方向は候補にも寄与にも入らない", () => {
		const active = activeDirectionDefinitions(
			REGISTERED_DIRECTION_DEFINITIONS,
			REVIEWED_TEST_ARTWORK,
			new Set(["travel-magazine"]),
		);
		expect(active.map((item) => item.id)).toEqual(["travel-magazine"]);
		const result = compileBooklet(
			testModel(),
			{ seed: { value: 6, version: "v2" } },
			{ artwork: REVIEWED_TEST_ARTWORK, directions: active, revision: "test" },
		);
		expect(result.status).toBe("compiled");
		if (result.status === "compiled") {
			expect(result.trace.effectiveDirectionIds).toEqual(["travel-magazine"]);
			expect(result.trace.contributions).toEqual([]);
		}
	});

	it("境界値系: 季節方向は春夏秋冬のviewが一つでも欠ければactiveにしない", () => {
		const season = REGISTERED_DIRECTION_DEFINITIONS.find(
			(definition) => definition.id === "season",
		);
		if (!season) throw new Error("season");
		expect(isDirectionArtworkReady(season, REVIEWED_TEST_ARTWORK)).toBe(true);
		const withoutWinter = REVIEWED_TEST_ARTWORK.map((asset) =>
			asset.role === "season-pattern"
				? {
						...asset,
						views: asset.views?.filter((view) => view.id !== "winter"),
					}
				: asset,
		);
		expect(isDirectionArtworkReady(season, withoutWinter)).toBe(false);
	});

	it("正常系: 製品catalogのactive方向だけで抽選するのでartwork-unavailableにならない", () => {
		const catalog = productionCompositionCatalog();
		expect(catalog.directions).toEqual(
			activeDirectionDefinitions(
				REGISTERED_DIRECTION_DEFINITIONS,
				ARTWORK_CATALOG,
				new Set(catalog.directions.map((item) => item.id)),
			),
		);
		const model = testModel();
		for (let value = 0; value < 200; value += 1) {
			const result = compileBooklet(
				model,
				{ seed: { value, version: "v2" } },
				catalog,
			);
			expect(result.status === "failed" ? result.code : "compiled").not.toBe(
				"artwork-unavailable",
			);
		}
	});
});
