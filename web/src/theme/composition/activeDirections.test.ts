import { describe, expect, it } from "vitest";
import { ARTWORK_CATALOG } from "../artwork/catalog";
import { REGISTERED_DIRECTION_DEFINITIONS } from "../directions/registry";
import {
	activeDirectionDefinitions,
	isDirectionArtworkReady,
} from "./activeDirections";
import { compileBooklet, productionCompositionCatalog } from "./compileBooklet";
import { REVIEWED_TEST_ARTWORK, testModel } from "./compositionTestKit";

const ART_DEPENDENT = [
	"vintage-journal",
	"wa-modern",
	"game-ui",
	"rpg",
	"nordic",
	"gourmet",
	"literature",
	"museum",
	"encyclopedia",
	"season",
	"local-motif",
	"stamp",
	"mission",
	"chapters",
];

describe("activeDirectionDefinitions", () => {
	it("正常系: 全素材が審査済みなら登録52方向がすべてactive", () => {
		expect(
			activeDirectionDefinitions(
				REGISTERED_DIRECTION_DEFINITIONS,
				REVIEWED_TEST_ARTWORK,
			),
		).toHaveLength(52);
	});

	it("異常系: 審査済み素材がなければ、必須の主役絵枠を持つ方向だけが外れる", () => {
		const active = activeDirectionDefinitions(
			REGISTERED_DIRECTION_DEFINITIONS,
			[],
		);
		const inactive = REGISTERED_DIRECTION_DEFINITIONS.filter(
			(definition) => !active.includes(definition),
		).map((definition) => definition.id);
		expect(new Set(inactive)).toEqual(new Set(ART_DEPENDENT));
		// Registered order is kept for the remaining directions.
		expect(active.map((definition) => definition.id)).toEqual(
			REGISTERED_DIRECTION_DEFINITIONS.map(
				(definition) => definition.id,
			).filter((id) => !ART_DEPENDENT.includes(id)),
		);
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
