import { describe, expect, it } from "vitest";
import { COMPARISON_BOOKLET_MODEL } from "../../../e2e/fixtures/booklet-diversity";
import { ARTWORK_MANIFEST } from "../../assets/artwork/manifest";
import { CATALOG_REVISION } from "../composition/catalogRevision";
import {
	compileBooklet,
	productionCompositionCatalog,
} from "../composition/compileBooklet";
import { fullTestCatalog } from "../composition/compositionTestKit";
import { REGISTERED_DIRECTION_DEFINITIONS } from "../directions/registry";
import artwork from "./artwork.json";
import directions from "./directions.json";
import samples from "./samples.json";
import {
	type ReviewRecords,
	reviewIssues,
	type SampleReview,
	sampleRecipeIssues,
} from "./validateReviews";

const model = COMPARISON_BOOKLET_MODEL;
const fixtures = {
	standard: model,
	kyoto: {
		...model,
		cover: {
			...model.cover,
			destinationPlace: { city: "京都", country: "日本" },
		},
	},
	tokyo: {
		...model,
		cover: {
			...model.cover,
			destinationPlace: { city: "東京", country: "日本" },
		},
	},
	paris: {
		...model,
		cover: {
			...model.cover,
			destinationPlace: { city: "Paris", country: "France" },
		},
	},
};

describe("25.5 release review gate", () => {
	it("異常系: 暫定使用の承認を素材品質と208作例の最終審査へ流用しない", () => {
		const issues = reviewIssues(
			{
				directions: directions as ReviewRecords["directions"],
				artwork: artwork as ReviewRecords["artwork"],
				samples,
			},
			REGISTERED_DIRECTION_DEFINITIONS,
			ARTWORK_MANIFEST,
			CATALOG_REVISION,
		);
		expect(issues).toContain(
			"direction travel-magazine: provisional approval is not final review",
		);
		expect(issues).toContain(
			`artwork ${ARTWORK_MANIFEST[0]?.id}: provisional approval is not final review`,
		);
		expect(issues).toContain("expected 208 samples, got 0");
	});
	it("異常系: 記録のない作品や未審査素材をactiveとは認定しない", () => {
		const issues = reviewIssues(
			{ directions: [], artwork: [], samples: [] },
			REGISTERED_DIRECTION_DEFINITIONS,
			ARTWORK_MANIFEST,
			CATALOG_REVISION,
		);
		expect(issues).toContain(
			"direction travel-magazine: active review/revision/sample missing",
		);
		expect(issues).toContain(
			`artwork ${ARTWORK_MANIFEST[0]?.id}: active review/revision missing`,
		);
		expect(issues).toContain("expected 208 samples, got 0");
	});

	it("正常系・境界値系: 保存seedと寄与が一致し、値を変えると拒否する", () => {
		const catalog = fullTestCatalog();
		const result = compileBooklet(
			model,
			{ seed: { value: 6, version: "v2" } },
			catalog,
		);
		if (result.status !== "compiled") throw new Error(result.message);
		const sample: SampleReview = {
			sampleId: "test-only",
			seed: 6,
			catalogRevision: catalog.revision,
			baseDirectionId: result.trace.baseDirectionId,
			effectiveDirectionIds: result.trace.effectiveDirectionIds,
			contributionIds: result.trace.contributions.map(
				(item) => item.contributionId,
			),
			assets: result.trace.assets.flatMap((item) =>
				item.assetId ? [item.assetId] : [],
			),
			moduleIds: [
				...new Set(result.program.scenes.map((scene) => scene.moduleId)),
			],
			pageCount: 1,
			nearestSampleId: null,
			perceptualGroupId: "test",
			judgments: {},
			decision: "revise",
			reviewer: "test",
			fixture: "standard",
			samePageTriple: false,
			chapterChange: false,
		};
		expect(sampleRecipeIssues([sample], catalog, fixtures)).toEqual([]);
		expect(
			sampleRecipeIssues(
				[{ ...sample, effectiveDirectionIds: ["film"] }],
				catalog,
				fixtures,
			),
		).toEqual(["test-only: saved recipe differs from compiler output"]);
		expect(
			sampleRecipeIssues(
				[{ ...sample, chapterChange: true }],
				catalog,
				fixtures,
			),
		).toEqual(["test-only: saved recipe differs from compiler output"]);
	});

	it.runIf(process.env.ARTWORK_RELEASE_CHECK === "1")(
		"公開時: 全52方向・288素材・208作例の審査記録と製品compilerを照合する",
		() => {
			const records: ReviewRecords = {
				directions: directions as ReviewRecords["directions"],
				artwork: artwork as ReviewRecords["artwork"],
				samples,
			};
			expect(
				reviewIssues(
					records,
					REGISTERED_DIRECTION_DEFINITIONS,
					ARTWORK_MANIFEST,
					CATALOG_REVISION,
				),
			).toEqual([]);
			expect(
				sampleRecipeIssues(
					records.samples,
					productionCompositionCatalog(),
					fixtures,
				),
			).toEqual([]);
		},
	);
});
