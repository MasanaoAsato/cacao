import { describe, expect, it } from "vitest";
import { assemblePages, ProgramAssemblyError } from "./assemblePages";
import type { AnyScenePlan, BookletProgram, LocalPage } from "./model";
import { compiledProgram } from "./programTestKit";

function page(localPageId: string, unitIds: readonly string[] = []): LocalPage {
	return {
		compositionId: "c",
		kind: unitIds.length > 0 ? "first" : "cover",
		localPageId,
		unitIds,
		unitRefs: [],
	};
}

function plansFor(
	program: BookletProgram,
	override: Partial<Record<string, readonly LocalPage[]>> = {},
): Map<string, AnyScenePlan> {
	return new Map(
		program.scenes.map((scene) => [
			scene.sceneId,
			{
				moduleId: scene.moduleId,
				pages: (override[scene.sceneId] ??
					(scene.kind === "day"
						? [page("p1", scene.unitIds)]
						: [
								page(scene.kind === "cover" ? "cover" : "p1"),
							])) as AnyScenePlan["pages"],
				sceneId: scene.sceneId,
			},
		]),
	);
}

describe("assemblePages", () => {
	const program = compiledProgram(["vintage-journal"]);

	it("正常系: scene順に連結し、page IDはsceneId/localPageId、通し番号は連結後に振る", () => {
		const pages = assemblePages(
			program,
			plansFor(program, {
				"day:d1": [
					page("p1", ["d1-u0", "d1-u1"]),
					page("p2", ["d1-u2", "d1-u3"]),
				],
			}),
		);
		expect(pages.map((item) => [item.pageId, item.pageNumber])).toEqual([
			["cover/cover", 1],
			["day:d1/p1", 2],
			["day:d1/p2", 3],
			["day:d2/p1", 4],
			["day:d3/p1", 5],
		]);
	});

	it("異常系: sceneの計画欠落・別sceneの計画・0頁を拒否する", () => {
		const missing = plansFor(program);
		missing.delete("day:d2");
		expect(() => assemblePages(program, missing)).toThrow(ProgramAssemblyError);
		const swapped = plansFor(program);
		const cover = swapped.get("cover");
		if (!cover) throw new Error("cover");
		swapped.set("day:d2", { ...cover, sceneId: "cover" });
		expect(() => assemblePages(program, swapped)).toThrow(/別scene/);
		expect(() =>
			assemblePages(program, plansFor(program, { "day:d2": [] })),
		).toThrow(/ページがありません/);
	});

	it("異常系: 予定の欠落・重複・順序違い・extraによる所有を拒否する", () => {
		for (const pages of [
			[page("p1", ["d1-u0", "d1-u1", "d1-u2"])],
			[page("p1", ["d1-u0", "d1-u1", "d1-u2", "d1-u3", "d1-u3"])],
			[page("p1", ["d1-u1", "d1-u0", "d1-u2", "d1-u3"])],
		]) {
			expect(() =>
				assemblePages(program, plansFor(program, { "day:d1": pages })),
			).toThrow(/一回ずつ/);
		}
		expect(() =>
			assemblePages(
				program,
				plansFor(program, { cover: [page("x", ["d1-u0"])] }),
			),
		).toThrow(/所有できません/);
	});

	it("異常系: 同じlocalPageIdの重複を拒否する", () => {
		expect(() =>
			assemblePages(
				program,
				plansFor(program, {
					"day:d1": [
						page("p1", ["d1-u0", "d1-u1"]),
						page("p1", ["d1-u2", "d1-u3"]),
					],
				}),
			),
		).toThrow(/重複/);
	});
});
