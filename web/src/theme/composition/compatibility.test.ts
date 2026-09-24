import { describe, expect, it } from "vitest";
import { directionDefinitionById } from "../directions/registry";
import type { DirectionId } from "../directions/types";
import { buildBaselineState } from "./baseline";
import {
	catalogFailure,
	enumerateScopes,
	evaluateCandidate,
	keysConflict,
	meetsRequirements,
} from "./compatibility";
import {
	REVIEWED_TEST_ARTWORK,
	testCatalog,
	testContext,
	testDay,
	testModel,
} from "./compositionTestKit";
import type { CompileContext, DraftState } from "./types";

const META = { catalogRevision: "test-revision", seed: "v2-00000007" };

function baseState(
	id: DirectionId,
	model = testModel(),
): {
	readonly context: CompileContext;
	readonly state: DraftState;
} {
	const context = testContext(model, REVIEWED_TEST_ARTWORK);
	const state = buildBaselineState(directionDefinitionById(id), context);
	if (!state) throw new Error(`baseline ${id} failed`);
	return { context, state };
}

function contribution(id: DirectionId, suffix: string) {
	const found = directionDefinitionById(id).contributions.find(
		(item) => item.id === `${id}:${suffix}`,
	);
	if (!found) throw new Error(`${id}:${suffix} missing`);
	return found;
}

describe("keysConflict", () => {
	it("正常系: 同じkeyと祖先・子孫keyは衝突する", () => {
		expect(keysConflict(["scene", "cover"], ["scene", "cover"])).toBe(true);
		expect(
			keysConflict(
				["scene", "day:d1"],
				["scene", "day:d1", "heading", "system"],
			),
		).toBe(true);
		expect(keysConflict(["scene", "day:d1", "body"], ["scene", "day:d1"])).toBe(
			true,
		);
	});

	it("境界値系: 文字列の前方一致ではなく区切り単位で比べる", () => {
		expect(keysConflict(["scene", "day:d1"], ["scene", "day:d1:d1-u2"])).toBe(
			false,
		);
		expect(
			keysConflict(
				["scene", "cover", "heading", "system"],
				["scene", "cover", "image", "treatment"],
			),
		).toBe(false);
	});
});

describe("catalogFailure", () => {
	it("正常系: 公開中の52方向カタログは定義エラーを持たない", () => {
		expect(
			catalogFailure(testCatalog(["travel-magazine", "rail", "stamp"])),
		).toBeNull();
	});

	it("異常系: 方向の重複と空の版を拒否する", () => {
		expect(catalogFailure(testCatalog(["rail", "rail"]))?.code).toBe(
			"invalid-catalog",
		);
		expect(
			catalogFailure({ ...testCatalog(["rail"]), revision: " " })?.code,
		).toBe("invalid-catalog");
	});
});

describe("requirements and scopes", () => {
	it("正常系: scopeはbook→scene順→region ID順に列挙する", () => {
		const { context, state } = baseState("travel-magazine");
		expect(
			enumerateScopes(
				contribution("newspaper", "heading-system"),
				state,
				context,
			),
		).toEqual([
			{ kind: "region", regionId: "heading", sceneId: "cover" },
			{ kind: "region", regionId: "heading", sceneId: "day:d1" },
			{ kind: "region", regionId: "heading", sceneId: "day:d2" },
			{ kind: "region", regionId: "heading", sceneId: "day:d3" },
		]);
		expect(
			enumerateScopes(
				contribution("stamp", "participation"),
				state,
				context,
			)[0],
		).toEqual({
			kind: "book",
		});
	});

	it("異常系: 縦書き見出しは縦書きを描けないmoduleへ使わない", () => {
		const { context, state } = baseState("travel-magazine");
		const scope = {
			kind: "region" as const,
			regionId: "heading" as const,
			sceneId: "cover",
		};
		expect(
			meetsRequirements(
				contribution("japan-poster", "heading-system"),
				scope,
				state,
				context,
			),
		).toBe(false);

		const poster = baseState("onsen");
		expect(
			evaluateCandidate({
				context: poster.context,
				contribution: contribution("japan-poster", "heading-system"),
				definition: directionDefinitionById("japan-poster"),
				meta: META,
				scope,
				state: poster.state,
			}),
		).not.toBeNull();
	});

	it("異常系: 予定のない日には本文構造の交換と押印欄を作らない", () => {
		const { context, state } = baseState("travel-magazine");
		const empty = {
			kind: "region" as const,
			regionId: "body" as const,
			sceneId: "day:d3",
		};
		expect(
			meetsRequirements(
				contribution("map", "content-structure"),
				empty,
				state,
				context,
			),
		).toBe(false);
		expect(
			evaluateCandidate({
				context,
				contribution: contribution("stamp", "participation"),
				definition: directionDefinitionById("stamp"),
				meta: META,
				scope: { kind: "scene", sceneId: "day:d3" },
				state,
			}),
		).toBeNull();
	});

	it("異常系: baselineの記入欄がある日に別方向の記入欄を重ねない", () => {
		const { context, state } = baseState("checklist");
		expect(state.days[0]?.memo?.participation).toBe("checklist");
		expect(
			evaluateCandidate({
				context,
				contribution: contribution("memory-album", "participation"),
				definition: directionDefinitionById("memory-album"),
				meta: META,
				scope: { kind: "scene", sceneId: "day:d1" },
				state,
			}),
		).toBeNull();
		// The empty day has no checklist memo, so the album page may go there.
		expect(
			evaluateCandidate({
				context,
				contribution: contribution("memory-album", "participation"),
				definition: directionDefinitionById("memory-album"),
				meta: META,
				scope: { kind: "scene", sceneId: "day:d3" },
				state,
			}),
		).not.toBeNull();
	});

	it("異常系: 章変化した日へ後から見出しを書き換えない", () => {
		const { context, state } = baseState("travel-magazine");
		const chapter = evaluateCandidate({
			context,
			contribution: contribution("wa-modern", "chapter-style"),
			definition: directionDefinitionById("wa-modern"),
			meta: META,
			scope: { kind: "scene", sceneId: "day:d1" },
			state,
		});
		if (!chapter) throw new Error("chapter-style should apply");
		expect(
			evaluateCandidate({
				context,
				contribution: contribution("newspaper", "heading-system"),
				definition: directionDefinitionById("newspaper"),
				meta: META,
				scope: { kind: "region", regionId: "heading", sceneId: "day:d1" },
				state: chapter.state,
			}),
		).toBeNull();
	});

	it("境界値系: 時間帯が一つだけの旅程にはday-storyの分割を提供しない", () => {
		const model = testModel({ days: [testDay("d1", 1, ["09:00", "10:00"])] });
		const { context, state } = baseState("travel-magazine", model);
		expect(
			meetsRequirements(
				contribution("day-story", "sequence"),
				{ kind: "book" },
				state,
				context,
			),
		).toBe(false);
	});
});
