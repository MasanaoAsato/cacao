import { afterEach, describe, expect, it, vi } from "vitest";
import type { DayScene, ProgramScene } from "../../booklet/program/model";
import { programIssues } from "../../booklet/program/validateProgram";
import { defineDirection } from "../directions/definition";
import { REGISTERED_DIRECTION_DEFINITIONS } from "../directions/registry";
import type { DirectionId } from "../directions/types";
import { compileBooklet } from "./compileBooklet";
import {
	fullTestCatalog,
	REVIEWED_TEST_ARTWORK,
	scriptedRandom,
	testCatalog,
	testDay,
	testModel,
} from "./compositionTestKit";
import type { CompileResult, CompositionOperation } from "./types";

const SEED = { seed: { value: 7, version: "v2" as const } };
const FUSION_ORDER: readonly DirectionId[] = [
	"travel-magazine",
	"film",
	"newspaper",
	"chapters",
	"stamp",
];

function compiled(result: CompileResult) {
	if (result.status !== "compiled")
		throw new Error(`compile failed: ${result.code} ${result.message}`);
	return result;
}

function scene(
	result: ReturnType<typeof compiled>,
	sceneId: string,
): ProgramScene {
	const found = result.program.scenes.find((item) => item.sceneId === sceneId);
	if (!found) throw new Error(`scene ${sceneId} missing`);
	return found;
}

function directionsWithEffects(result: ReturnType<typeof compiled>) {
	return new Set(
		result.program.scenes.flatMap((item) =>
			item.effects.map((effect) => effect.directionId),
		),
	);
}

afterEach(() => {
	vi.restoreAllMocks();
});

describe("compileBooklet", () => {
	it.each([1, 2, 5])(
		"正常系・境界値系: 上限%i方向で追加を止め、実際の寄与を残す",
		(limit) => {
			const model = testModel();
			const result = compiled(
				compileBooklet(
					model,
					SEED,
					{ ...testCatalog(FUSION_ORDER), maxDirections: limit },
					{
						random: scriptedRandom({
							choices: { direction: 0, operation: 0.99, scope: 0 },
							steps: 5,
						}),
					},
				),
			);
			expect(result.trace.effectiveDirectionIds).toEqual(
				FUSION_ORDER.slice(0, limit),
			);
			expect(result.trace.contributions).toHaveLength(limit - 1);
			expect(result.trace.stopReason).toBe("max-directions");
			expect(programIssues(result.program, model)).toEqual([]);
		},
	);

	it("正常系: 上限2でも途中で乱数停止したら単独で終了する", () => {
		const result = compiled(
			compileBooklet(
				testModel(),
				SEED,
				{ ...testCatalog(FUSION_ORDER), maxDirections: 2 },
				{ random: scriptedRandom({ steps: 0 }) },
			),
		);
		expect(result.trace.effectiveDirectionIds).toHaveLength(1);
		expect(result.trace.stopReason).toBe("random-stop");
	});

	it("異常系: 不正な上限はカタログエラーとして拒否する", () => {
		for (const limit of [0, -1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1]) {
			expect(
				compileBooklet(testModel(), SEED, {
					...testCatalog(FUSION_ORDER),
					maxDirections: limit,
				}),
			).toMatchObject({ status: "failed", code: "invalid-catalog" });
		}
	});

	it("正常系: step 0で停止すると単独方向の冊子になる", () => {
		const result = compiled(
			compileBooklet(testModel(), SEED, testCatalog(FUSION_ORDER), {
				random: scriptedRandom({ steps: 0 }),
			}),
		);

		expect(result.trace.effectiveDirectionIds).toEqual(["travel-magazine"]);
		expect(result.trace.contributions).toEqual([]);
		expect(result.trace.stopReason).toBe("random-stop");
		expect(result.program.scenes.map((item) => item.sceneId)).toEqual([
			"cover",
			"day:d1",
			"day:d2",
			"day:d3",
		]);
		expect(result.program.baseDirectionId).toBe("travel-magazine");
		expect(result.program.catalogRevision).toBe("test-revision");
		expect(result.program.seed).toBe("v2-00000007");
	});

	it.each([
		[2, ["film:image-treatment"]],
		[3, ["film:image-treatment", "newspaper:heading-system"]],
		[
			4,
			["film:image-treatment", "newspaper:heading-system", "chapters:sequence"],
		],
		[
			5,
			[
				"film:image-treatment",
				"newspaper:heading-system",
				"chapters:sequence",
				"stamp:participation",
			],
		],
	])(
		"正常系: %i方向を実際の操作として構築し、全方向の寄与が出力sceneに残る",
		(count, ids) => {
			const result = compiled(
				compileBooklet(testModel(), SEED, testCatalog(FUSION_ORDER), {
					random: scriptedRandom({
						choices: { direction: 0, operation: 0.99, scope: 0 },
						steps: count - 1,
					}),
				}),
			);

			expect(
				result.trace.contributions.map((item) => item.contributionId),
			).toEqual(ids);
			expect(result.trace.effectiveDirectionIds).toEqual(
				FUSION_ORDER.slice(0, count),
			);
			const withEffects = directionsWithEffects(result);
			for (const id of FUSION_ORDER.slice(0, count))
				expect(withEffects.has(id)).toBe(true);
			expect(programIssues(result.program, testModel())).toEqual([]);
		},
	);

	it("正常系: 同じページで3方向が融合し、章と記入欄も同じcompilerで追加される", () => {
		const result = compiled(
			compileBooklet(testModel(), SEED, testCatalog(FUSION_ORDER), {
				random: scriptedRandom({
					choices: { direction: 0, operation: 0.99, scope: 0 },
					steps: 4,
				}),
			}),
		);

		const cover = scene(result, "cover");
		expect(cover.config.imageTreatment).toEqual({
			directionId: "film",
			treatment: "film",
		});
		expect(cover.config.heading.system).toBe("masthead");
		expect(new Set(cover.effects.map((effect) => effect.directionId))).toEqual(
			new Set(["travel-magazine", "film", "newspaper"]),
		);
		expect(result.program.scenes.map((item) => item.sceneId)).toEqual([
			"cover",
			"divider:d1",
			"day:d1",
			"memo:d1",
			"divider:d2",
			"day:d2",
			"memo:d2",
			"divider:d3",
			"day:d3",
		]);
	});

	it("境界値系: 訪問一覧の記入欄は日の全unitを参照し、アルバムの記入欄はunitを参照しない", () => {
		const memosOf = (result: ReturnType<typeof compiled>) =>
			result.program.scenes.flatMap((item) =>
				item.kind === "memo" ? [item] : [],
			);
		const stamp = compiled(
			compileBooklet(testModel(), SEED, testCatalog(FUSION_ORDER), {
				random: scriptedRandom({
					choices: { direction: 0, operation: 0.99, scope: 0 },
					steps: 4,
				}),
			}),
		);
		const d1Units = testModel().days[0]?.units.map((unit) => unit.id);
		expect(scene(stamp, "memo:d1")).toMatchObject({
			participation: "stamp",
			unitRefs: d1Units,
		});

		// The album's own baseline and the album fused into another direction.
		const own = compiled(
			compileBooklet(testModel(), SEED, testCatalog(["memory-album"]), {
				random: scriptedRandom({ steps: 0 }),
			}),
		);
		const fused = compiled(
			compileBooklet(
				testModel(),
				SEED,
				testCatalog(["travel-magazine", "memory-album"]),
				{
					random: scriptedRandom({
						choices: { direction: 0, operation: 0.99, scope: 0 },
						steps: 1,
					}),
				},
			),
		);
		for (const result of [own, fused]) {
			const memos = memosOf(result);
			expect(memos.length).toBeGreaterThan(0);
			for (const memo of memos) {
				expect(memo.participation).toBe("memory-album");
				expect(memo.unitRefs).toEqual([]);
			}
			expect(programIssues(result.program, testModel())).toEqual([]);
		}
	});

	it("正常系: 章変化はday sceneを別方向のmodule・styleへ置き換え、他の日は保つ", () => {
		const result = compiled(
			compileBooklet(
				testModel(),
				SEED,
				testCatalog(["travel-magazine", "wa-modern"]),
				{
					random: scriptedRandom({
						choices: { operation: 0, scope: 0 },
						steps: 1,
					}),
				},
			),
		);

		const changed = scene(result, "day:d1");
		expect(changed.moduleId).toBe("woodcut-folio");
		expect(changed.config.surface.directionId).toBe("wa-modern");
		expect(changed.effects).toContainEqual(
			expect.objectContaining({ directionId: "wa-modern", kind: "chapter" }),
		);
		expect(changed.config.bindings[0]?.assetId).toMatch(/^woodcut-/);
		expect(scene(result, "day:d2").moduleId).toBe("editorial-magazine");
		expect(scene(result, "cover").moduleId).toBe("editorial-magazine");
	});

	it("正常系: 章変化を日内の時間帯区間へ適用すると元の順序のままsceneを分割する", () => {
		// chapter-style scopes: day:d1, 3 sections of d1, day:d2, day:d3 → index 1 is the first section.
		const result = compiled(
			compileBooklet(
				testModel(),
				SEED,
				testCatalog(["travel-magazine", "wa-modern"]),
				{
					random: scriptedRandom({
						choices: { operation: 0, scope: 1.5 / 6 },
						steps: 1,
					}),
				},
			),
		);

		expect(result.trace.contributions[0]?.scope).toEqual({
			dayId: "d1",
			kind: "unit-range",
			unitIds: ["d1-u0", "d1-u1"],
		});
		const days = result.program.scenes.filter(
			(item): item is DayScene => item.kind === "day" && item.dayId === "d1",
		);
		expect(
			days.map((item) => [
				item.sceneId,
				item.moduleId,
				item.unitIds,
				item.showIllustration,
			]),
		).toEqual([
			["day:d1", "woodcut-folio", ["d1-u0", "d1-u1"], true],
			["day:d1:d1-u2", "editorial-magazine", ["d1-u2"], false],
			["day:d1:d1-u3", "editorial-magazine", ["d1-u3"], false],
		]);
	});

	it("正常系: 同じ入力・seed・catalogなら一致し、時刻とMath.randomを読まない", () => {
		const random = vi.spyOn(Math, "random");
		const now = vi.spyOn(Date, "now");
		const catalog = fullTestCatalog();
		const first = compileBooklet(testModel(), SEED, catalog);
		const second = compileBooklet(testModel(), SEED, catalog);

		expect(second).toEqual(first);
		expect(random).not.toHaveBeenCalled();
		expect(now).not.toHaveBeenCalled();
	});

	it("正常系: 素材数を増やしてもbase方向の選択は変わらない", () => {
		const options = { random: scriptedRandom({ base: 0.5, steps: 0 }) };
		// These directions do not request authored artwork.
		const directions: DirectionId[] = ["minimal", "photo-book", "practical"];
		const without = compiled(
			compileBooklet(testModel(), SEED, testCatalog(directions, []), options),
		);
		const withAll = compiled(
			compileBooklet(testModel(), SEED, testCatalog(directions), options),
		);

		expect(without.program.baseDirectionId).toBe("photo-book");
		expect(withAll.program.baseDirectionId).toBe("photo-book");
	});

	it("正常系: 方向は候補scope数に関係なく等確率で選ばれる", () => {
		// newspaper has four heading scopes, film one cover image scope; each is still 1/2.
		const catalog = testCatalog(["travel-magazine", "newspaper", "film"]);
		const pick = (direction: number) =>
			compiled(
				compileBooklet(
					testModel({ days: [testDay("d1", 1, ["10:00"], false)] }),
					SEED,
					catalog,
					{
						random: scriptedRandom({
							choices: { direction, operation: 0.99 },
							steps: 1,
						}),
					},
				),
			).trace.contributions[0]?.directionId;

		expect(pick(0.49)).toBe("newspaper");
		expect(pick(0.5)).toBe("film");
	});

	it("正常系: 登録地ではご当地モチーフの固定題材を主役絵に選ぶ", () => {
		const result = compiled(
			compileBooklet(
				testModel({ destinationPlace: { city: "京都市", country: "日本" } }),
				SEED,
				testCatalog(["local-motif"]),
				{ random: scriptedRandom({ steps: 0 }) },
			),
		);

		const binding = scene(result, "day:d1").config.bindings[0];
		expect(binding?.assetId).toBe("cut-paper-machiya-grid-hero-r1");
	});

	it("正常系: 季節方向は旅程月の季節viewを日別の挿絵枠に選ぶ", () => {
		const result = compiled(
			compileBooklet(testModel(), SEED, testCatalog(["season"]), {
				random: scriptedRandom({ steps: 0 }),
			}),
		);

		expect(scene(result, "day:d1").config.bindings[0]).toMatchObject({
			role: "season-pattern",
			viewId: "spring",
		});
	});

	it("異常系: 空カタログはempty-catalog", () => {
		const result = compileBooklet(testModel(), SEED, {
			artwork: [],
			directions: [],
			revision: "test-revision",
		});

		expect(result).toMatchObject({ code: "empty-catalog", status: "failed" });
	});

	it("異常系: 未知の操作は定義エラーで、候補外として握り潰さない", () => {
		const broken = defineDirection({
			contributions: [
				{
					id: "minimal:css",
					operations: [{ kind: "css" } as unknown as CompositionOperation],
					requires: {
						data: [],
						modules: null,
						regions: [],
						sceneKinds: ["day"],
					},
					targetScope: ["scene"],
					visibleEffect: "chapter",
				},
			],
			id: "minimal",
			module: "woodcut-folio",
			signature: { description: "test", label: "test" },
			styleBundleId: "bright",
			touch: "none",
		});
		const result = compileBooklet(testModel(), SEED, {
			artwork: [],
			directions: [broken],
			revision: "test-revision",
		});

		expect(result).toMatchObject({
			code: "unknown-operation",
			status: "failed",
		});
	});

	it("異常系: 対象地域が未登録ならご当地方向だけのカタログはno-eligible-direction", () => {
		const result = compileBooklet(
			testModel({ destinationPlace: { city: "新京都", country: "日本" } }),
			SEED,
			testCatalog(["local-motif", "local-color"]),
		);

		expect(result).toMatchObject({
			code: "no-eligible-direction",
			status: "failed",
		});
	});

	it("異常系: 必須slotに審査済み素材がなければartwork-unavailable", () => {
		const result = compileBooklet(
			testModel(),
			SEED,
			testCatalog(["wa-modern"], []),
			{
				random: scriptedRandom({ steps: 0 }),
			},
		);

		expect(result).toMatchObject({
			code: "artwork-unavailable",
			status: "failed",
		});
	});

	it("異常系: 既に書き込まれた見出しへ別方向の見出しは重ねず、別scopeを選ぶ", () => {
		const result = compiled(
			compileBooklet(
				testModel(),
				SEED,
				testCatalog(["travel-magazine", "newspaper", "travel-note"]),
				{
					random: scriptedRandom({
						choices: { direction: 0, operation: 0.99, scope: 0 },
						steps: 2,
					}),
				},
			),
		);

		expect(result.trace.contributions.map((item) => item.scope)).toEqual([
			{ kind: "region", regionId: "heading", sceneId: "cover" },
			{ kind: "region", regionId: "heading", sceneId: "day:d1" },
		]);
	});

	it("異常系: 挿絵のない日には画像処理を候補に入れない", () => {
		const model = testModel({
			days: [testDay("d1", 1, ["10:00"]), testDay("d2", 2, ["10:00"], false)],
		});
		const result = compiled(
			compileBooklet(model, SEED, testCatalog(["travel-magazine", "film"]), {
				random: scriptedRandom({
					choices: { operation: 0.99, scope: 0.99 },
					steps: 1,
				}),
			}),
		);

		// d2 has no illustration, so the last image scope is d1, not d2.
		expect(result.trace.contributions[0]?.scope).toEqual({
			kind: "region",
			regionId: "image",
			sceneId: "day:d1",
		});
	});

	it("境界値系: 候補がなくなるとno-compatible-contributionで正常終了する", () => {
		const result = compiled(
			compileBooklet(
				testModel(),
				SEED,
				testCatalog(["travel-magazine", "film"]),
				{
					random: scriptedRandom({ steps: 10 }),
				},
			),
		);

		expect(result.trace.contributions).toHaveLength(1);
		expect(result.trace.stopReason).toBe("no-compatible-contribution");
	});

	it("境界値系: 日0件でも表紙と連続線の終章で成立する", () => {
		const model = testModel({ days: [] });
		const result = compiled(
			compileBooklet(
				model,
				SEED,
				testCatalog(["continuous-story", "chapters"]),
				{
					random: scriptedRandom({ steps: 3 }),
				},
			),
		);

		expect(result.program.scenes.map((item) => item.kind)).toEqual([
			"cover",
			"endcap",
		]);
		// chapters requires a day for dividers; its chapter-style has no day to replace.
		expect(result.trace.stopReason).toBe("no-compatible-contribution");
	});

	it("境界値系: 52方向すべてが単独で表紙・全予定・空日を満たす", () => {
		const model = testModel({
			destinationPlace: { city: "Kyoto", country: "Japan" },
		});
		const catalog = fullTestCatalog();
		REGISTERED_DIRECTION_DEFINITIONS.forEach((definition, index) => {
			const result = compiled(
				compileBooklet(model, SEED, catalog, {
					random: scriptedRandom({
						base: (index + 0.5) / REGISTERED_DIRECTION_DEFINITIONS.length,
						steps: 0,
					}),
				}),
			);
			expect(result.program.baseDirectionId).toBe(definition.id);
			expect(programIssues(result.program, model)).toEqual([]);
			expect(
				result.program.scenes.filter((item) => item.kind === "day").length,
			).toBeGreaterThanOrEqual(3);
		});
	});

	it("境界値系: 審査済み素材が揃えば通常のseed 0..199はすべてcompileに成功する", () => {
		const catalog = fullTestCatalog();
		const model = testModel({
			destinationPlace: { city: "Paris", country: "France" },
		});
		const counts = new Map<number, number>();
		for (let value = 0; value < 200; value += 1) {
			const result = compiled(
				compileBooklet(model, { seed: { value, version: "v2" } }, catalog),
			);
			const size = result.trace.effectiveDirectionIds.length;
			counts.set(size, (counts.get(size) ?? 0) + 1);
			expect(programIssues(result.program, model)).toEqual([]);
		}
		// Not the 25.5 release gate; only proves every size class is reachable.
		expect(counts.get(1)).toBeGreaterThan(0);
		expect(counts.get(2)).toBeGreaterThan(0);
		expect([...counts].some(([size, count]) => size >= 4 && count > 0)).toBe(
			true,
		);
	});

	it("正常系: Traceは比較用のIDだけを持ち、旅程の名称や場所を含まない", () => {
		const result = compiled(
			compileBooklet(testModel(), SEED, fullTestCatalog(), {
				random: scriptedRandom({ fallback: 0.3, steps: 3 }),
			}),
		);

		const serialized = JSON.stringify(result.trace);
		expect(serialized).not.toContain("地点");
		expect(serialized).not.toContain("目的地");
		expect(
			result.trace.assets.every(
				(asset) =>
					REVIEWED_TEST_ARTWORK.some((art) => art.id === asset.assetId) ||
					asset.assetId === null,
			),
		).toBe(true);
	});
});
