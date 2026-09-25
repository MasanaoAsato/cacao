import { describe, expect, it } from "vitest";
import { COMPARISON_BOOKLET_MODEL } from "../../../e2e/fixtures/booklet-diversity";
import { plannedPublicationCatalog } from "../../../e2e/fixtures/booklet-publication-catalog";
import plan from "../../../e2e/fixtures/booklet-publication-plan.json";
import { ARTWORK_MANIFEST } from "../../assets/artwork/manifest";
import { CATALOG_REVISION } from "../composition/catalogRevision";
import {
	compileBooklet,
	productionCompositionCatalog,
} from "../composition/compileBooklet";
import { testModel } from "../composition/compositionTestKit";
import { REGISTERED_DIRECTION_DEFINITIONS } from "../directions/registry";
import type { DirectionId } from "../directions/types";
import artworkRecords from "./artwork.json";
import directionRecords from "./directions.json";
import {
	sampleComparisonIssues,
	selectPlannedArtwork,
	selectPublishedArtwork,
	selectPublishedDirections,
} from "./publication";
import sampleRecords from "./samples.json";
import type { ArtworkReview, DirectionReview, SampleReview } from "./types";
import { sampleRecipeIssues } from "./validateReviews";

const REVISION = "test-publication-v1";
const definition = REGISTERED_DIRECTION_DEFINITIONS.find(
	(item) => item.id === "minimal",
);
if (!definition) throw new Error("minimal direction missing");

function sample(id: DirectionId = "minimal"): SampleReview {
	return {
		sampleId: `sample:${id}:1`,
		seed: 6,
		catalogRevision: REVISION,
		baseDirectionId: id,
		effectiveDirectionIds: [id],
		contributionIds: [],
		assets: [],
		moduleIds: ["editorial-magazine"],
		pageCount: 4,
		nearestSampleId: null,
		perceptualGroupId: `group:${id}`,
		judgments: {
			material: "紙面の素材感を比較",
			typography: "見出しの差を確認",
		},
		decision: "accept",
		reviewer: "reviewer",
		fixture: "standard",
		samePageTriple: false,
		chapterChange: false,
	};
}

function directionReview(id: DirectionId = "minimal"): DirectionReview {
	const target = REGISTERED_DIRECTION_DEFINITIONS.find(
		(item) => item.id === id,
	);
	if (!target) throw new Error(id);
	return {
		id,
		revision: target.revision,
		reviewId: target.reviewId,
		sampleId: sample(id).sampleId,
		reviewer: "reviewer",
		status: "active",
	};
}

function reviewedArtwork(): {
	assets: typeof ARTWORK_MANIFEST;
	records: ArtworkReview[];
} {
	const assets = ARTWORK_MANIFEST.map((asset) => ({
		...asset,
		reviewId: `review:artwork:${asset.id}:v${asset.revision}`,
	}));
	return {
		assets,
		records: assets.map((asset) => ({
			id: asset.id,
			revision: asset.revision,
			reviewId: asset.reviewId,
			reviewer: "reviewer",
			status: "active" as const,
		})),
	};
}

describe("25.6 publication", () => {
	it("正常系・異常系: 暫定素材も承認した版だけを公開し、根拠欠落を拒否する", () => {
		const asset = ARTWORK_MANIFEST[0];
		if (!asset) throw new Error("artwork missing");
		const record: ArtworkReview = {
			id: asset.id,
			revision: asset.revision,
			reviewId: asset.reviewId ?? "",
			reviewer: "reviewer",
			status: "active",
			provisional: { evidence: "現行版の使用を承認", reason: "改稿予定" },
		};
		expect(selectPublishedArtwork([asset], [record]).selected).toEqual([asset]);
		expect(
			selectPublishedArtwork(
				[{ ...asset, revision: asset.revision + 1 }],
				[record],
			).selected,
		).toEqual([]);
		expect(
			selectPublishedArtwork(
				[asset],
				[{ ...record, provisional: { evidence: "", reason: "改稿予定" } }],
			).selected,
		).toEqual([]);
		expect(
			selectPublishedArtwork([asset], [{ ...record, status: "reviewed" }])
				.selected,
		).toEqual([]);
	});

	it("正常系: 単独紙面の暫定承認からsampleを捏造せずに公開できる", () => {
		const provisional = {
			catalogRevision: REVISION,
			evidence: "ユーザーが単独紙面を確認",
			reason: "素材改稿中の暫定使用",
		};
		const review: DirectionReview = {
			...directionReview(),
			sampleId: null,
			provisional,
		};
		expect(
			selectPublishedDirections([definition], [review], [], [], REVISION)
				.selected,
		).toEqual([definition]);
		for (const invalid of [
			{ ...review, sampleId: "invented" },
			{ ...review, revision: 2 },
			{ ...review, provisional: undefined },
			{ ...review, provisional: { ...provisional, evidence: "" } },
			{ ...review, provisional: { ...provisional, reason: "" } },
			{ ...review, provisional: { ...provisional, catalogRevision: "old" } },
		]) {
			const selected = selectPublishedDirections(
				[definition],
				[invalid],
				[],
				[],
				REVISION,
			);
			expect(selected.selected).toEqual([]);
			expect(selected.issues).toHaveLength(1);
		}
		expect(
			selectPublishedDirections([definition], [review], [], [], REVISION, 2)
				.selected,
		).toEqual([]);
	});

	it("正常系: 暫定公開の52方向と288素材を本番compilerから選べる", () => {
		const catalog = productionCompositionCatalog();
		expect(catalog.directions).toHaveLength(52);
		expect(catalog.artwork).toHaveLength(288);
		expect(catalog.maxDirections).toBe(1);
		expect(
			artworkRecords.every(
				(record) => record.status === "active" && record.provisional,
			),
		).toBe(true);
		const selected = new Set<string>();
		const model = {
			...COMPARISON_BOOKLET_MODEL,
			cover: {
				...COMPARISON_BOOKLET_MODEL.cover,
				destinationPlace: { city: "京都", country: "日本" },
			},
		};
		for (let value = 0; value < 1000; value += 1) {
			const result = compileBooklet(model, { seed: { value, version: "v2" } });
			if (result.status !== "compiled") throw new Error(result.message);
			expect(result.trace.effectiveDirectionIds).toHaveLength(1);
			selected.add(result.trace.baseDirectionId);
		}
		expect(selected).toEqual(new Set(plan.directionIds));
	});

	it("正常系: active方向だけを抽選と追加寄与に渡す", () => {
		const selected = selectPublishedDirections(
			REGISTERED_DIRECTION_DEFINITIONS,
			[directionReview()],
			[sample()],
			[],
			REVISION,
		);
		expect(selected.issues).toEqual([]);
		expect(selected.selected.map((item) => item.id)).toEqual(["minimal"]);
		const result = compileBooklet(
			testModel(),
			{ seed: { value: 6, version: "v2" } },
			{ artwork: [], directions: selected.selected, revision: REVISION },
		);
		expect(result.status).toBe("compiled");
		if (result.status === "compiled") {
			expect(result.trace.effectiveDirectionIds).toEqual(["minimal"]);
			expect(result.trace.contributions).toEqual([]);
		}
	});

	it("正常系: 共用素材が揃っても方向の承認は個別に必要", () => {
		const { assets, records } = reviewedArtwork();
		const published = selectPublishedArtwork(assets, records);
		expect(published.issues).toEqual([]);
		const selected = selectPublishedDirections(
			REGISTERED_DIRECTION_DEFINITIONS,
			[directionReview("travel-magazine")],
			[sample("travel-magazine")],
			published.selected.map((asset) => ({ ...asset, src: "/test" })),
			REVISION,
		);
		expect(selected.issues).toEqual([]);
		expect(selected.selected.map((item) => item.id)).toEqual([
			"travel-magazine",
		]);
	});

	it("異常系: 版違い・重複・仮reviewId・未採用sampleを拒否する", () => {
		const asset = ARTWORK_MANIFEST[0];
		if (!asset) throw new Error("artwork missing");
		const badAsset = selectPublishedArtwork(
			[{ ...asset, reviewId: "preview-only" }],
			[
				{
					id: asset.id,
					revision: asset.revision,
					reviewId: "preview-only",
					reviewer: "x",
					status: "active",
				},
			],
		);
		expect(badAsset.issues).toHaveLength(1);
		expect(badAsset.selected).toEqual([]);
		const badDirection = selectPublishedDirections(
			REGISTERED_DIRECTION_DEFINITIONS,
			[directionReview(), { ...directionReview(), revision: 2 }],
			[{ ...sample(), decision: "revise" }],
			[],
			REVISION,
		);
		expect(
			badDirection.issues.some((issue) => issue.includes("duplicate")),
		).toBe(true);
		expect(
			badDirection.issues.some((issue) => issue.includes("mismatch")),
		).toBe(true);
	});

	it("異常系: active方向の必須素材不足と参照作例欠落を設定不整合にする", () => {
		const missingArtwork = selectPublishedDirections(
			REGISTERED_DIRECTION_DEFINITIONS,
			[directionReview("travel-magazine")],
			[sample("travel-magazine")],
			[],
			REVISION,
		);
		expect(missingArtwork.issues).toContain(
			"direction travel-magazine: required active artwork missing",
		);
		expect(missingArtwork.selected).toEqual([]);
		const missingSample = selectPublishedDirections(
			REGISTERED_DIRECTION_DEFINITIONS,
			[directionReview()],
			[],
			[],
			REVISION,
		);
		expect(missingSample.issues).toContain(
			"direction minimal: active review/revision/sample mismatch",
		);
	});

	it("境界値系: 記録0件は正常な未公開状態で、実行時はempty-catalog", () => {
		expect(selectPublishedArtwork(ARTWORK_MANIFEST, [])).toEqual({
			selected: [],
			issues: [],
		});
		const selected = selectPublishedDirections(
			REGISTERED_DIRECTION_DEFINITIONS,
			[],
			[],
			[],
			CATALOG_REVISION,
		);
		expect(selected).toEqual({ selected: [], issues: [] });
		expect(
			compileBooklet(
				testModel(),
				{ seed: { value: 6, version: "v2" } },
				{
					artwork: [],
					directions: [],
					revision: CATALOG_REVISION,
				},
			),
		).toMatchObject({ status: "failed", code: "empty-catalog" });
	});

	it("通常ビルド: active記録と製品catalogを照合し、採用作例を再現する", () => {
		const catalog = productionCompositionCatalog();
		const activeReviews = (directionRecords as DirectionReview[]).filter(
			(review) => review.status === "active",
		);
		expect(new Set(catalog.directions.map((item) => item.id))).toEqual(
			new Set(activeReviews.map((review) => review.id)),
		);
		if (activeReviews.length > 0 || catalog.artwork.length > 0) {
			expect(new Set(catalog.directions.map((item) => item.id))).toEqual(
				new Set(plan.directionIds),
			);
			expect(new Set(catalog.artwork.map((item) => item.id))).toEqual(
				new Set(plan.artworkIds),
			);
		}
		const activeSamples = activeReviews
			.filter((review) => !review.provisional)
			.map((review) => {
				const found = (sampleRecords as SampleReview[]).find(
					(sample) => sample.sampleId === review.sampleId,
				);
				if (!found) throw new Error(`採用作例がありません: ${review.sampleId}`);
				return found;
			});
		const standard = COMPARISON_BOOKLET_MODEL;
		const fixture = (city: string, country: string) => ({
			...standard,
			cover: {
				...standard.cover,
				destinationPlace: { city, country },
			},
		});
		expect(
			sampleRecipeIssues(activeSamples, catalog, {
				standard,
				kyoto: fixture("京都", "日本"),
				tokyo: fixture("東京", "日本"),
				paris: fixture("Paris", "France"),
			}),
		).toEqual([]);
	});

	it("境界値系: 素材不要の公開予定1方向は記録なしでも正式比較へ渡せる", () => {
		const catalog = plannedPublicationCatalog({
			directionIds: ["minimal"],
			artworkIds: [],
		});
		expect(catalog).toMatchObject({
			directions: [definition],
			artwork: [],
			revision: CATALOG_REVISION,
		});
		const result = compileBooklet(
			testModel(),
			{ seed: { value: 6, version: "v2" } },
			catalog,
		);
		expect(result.status).toBe("compiled");
	});

	it("異常系: 公開予定の素材がreviewedでなければ正式比較に使えない", () => {
		expect(() =>
			plannedPublicationCatalog({
				directionIds: ["travel-magazine"],
				artworkIds: ["unreviewed-or-unknown"],
			}),
		).toThrow(/reviewed\/active/);
	});

	it("正常系: reviewed素材は予定カタログで使えるが本番候補からは外す", () => {
		const asset = ARTWORK_MANIFEST[0];
		if (!asset) throw new Error("artwork missing");
		const defined = { ...asset, reviewId: "review:asset:1" };
		const record: ArtworkReview = {
			id: asset.id,
			revision: asset.revision,
			reviewId: "review:asset:1",
			reviewer: "reviewer",
			status: "reviewed",
		};
		expect(selectPlannedArtwork([defined], [record]).selected).toEqual([
			defined,
		]);
		expect(selectPublishedArtwork([defined], [record]).selected).toEqual([]);
	});

	it("境界値系: activeからreviewedへ戻すと候補から外れる", () => {
		const active = directionReview();
		expect(
			selectPublishedDirections(
				REGISTERED_DIRECTION_DEFINITIONS,
				[active],
				[sample()],
				[],
				REVISION,
			).selected,
		).toHaveLength(1);
		expect(
			selectPublishedDirections(
				REGISTERED_DIRECTION_DEFINITIONS,
				[{ ...active, status: "reviewed" }],
				[sample()],
				[],
				REVISION,
			).selected,
		).toEqual([]);
	});

	it("異常系: 比較軸・近傍・catalogRevisionを検査する", () => {
		expect(sampleComparisonIssues(sample(), new Map(), REVISION, true)).toEqual(
			[],
		);
		expect(
			sampleComparisonIssues(
				{ ...sample(), catalogRevision: "old" },
				new Map(),
				REVISION,
				true,
			),
		).toContain(`sample ${sample().sampleId}: invalid recipe or revision`);
		expect(
			sampleComparisonIssues(
				{ ...sample(), judgments: { density: "x" } },
				new Map(),
				REVISION,
				true,
			),
		).toContain(
			`sample ${sample().sampleId}: comparison to nearest accepted work is missing`,
		);
		expect(
			sampleComparisonIssues(
				{ ...sample(), nearestSampleId: null },
				new Map(),
				REVISION,
				false,
			),
		).toContain(
			`sample ${sample().sampleId}: comparison to nearest accepted work is missing`,
		);
	});
});
