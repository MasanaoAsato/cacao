import { describe, expect, it } from "vitest";
import { compileBooklet } from "../../theme/composition/compileBooklet";
import {
	scriptedRandom,
	testCatalog,
	testModel,
} from "../../theme/composition/compositionTestKit";
import type { BookletProgram, ProgramScene } from "./model";
import { compiledProgram } from "./programTestKit";
import { programIssues, renderedCoverageIssues } from "./validateProgram";

const model = testModel();

/** continuous-story + stamp memo: cover, dividers, day scenes, memos, endcap. */
function sampleProgram(): BookletProgram {
	const result = compileBooklet(
		model,
		{ seed: { value: 1, version: "v2" } },
		testCatalog(["continuous-story", "stamp"]),
		{
			random: scriptedRandom({
				choices: { direction: 0, operation: 0.99, scope: 0 },
				steps: 1,
			}),
		},
	);
	if (result.status !== "compiled") throw new Error(result.message);
	return result.program;
}

function withScenes(
	program: BookletProgram,
	update: (scenes: ProgramScene[]) => ProgramScene[],
): BookletProgram {
	return { ...program, scenes: update([...program.scenes]) };
}

describe("programIssues", () => {
	it("正常系: 表紙・章扉・全予定・記入欄・終章の順序を受け入れる", () => {
		const program = sampleProgram();
		expect(program.scenes.map((scene) => scene.kind)).toEqual([
			"cover",
			"divider",
			"day",
			"memo",
			"divider",
			"day",
			"memo",
			"divider",
			"day",
			"endcap",
		]);
		expect(programIssues(program, model)).toEqual([]);
	});

	it("異常系: unitの欠落と日の順序の入替えを拒否する", () => {
		const program = sampleProgram();
		const missing = withScenes(program, (scenes) =>
			scenes.map((scene) =>
				scene.kind === "day" && scene.dayId === "d1"
					? { ...scene, unitIds: scene.unitIds.slice(1) }
					: scene,
			),
		);
		expect(programIssues(missing, model)).toContain(
			"day sceneが全unitを入力順に一回ずつ含んでいません。",
		);
		const swapped = withScenes(program, (scenes) => {
			const d1 = scenes.findIndex((scene) => scene.sceneId === "day:d1");
			const d2 = scenes.findIndex((scene) => scene.sceneId === "day:d2");
			const first = scenes[d1];
			const second = scenes[d2];
			if (first && second) {
				scenes[d1] = second;
				scenes[d2] = first;
			}
			return scenes;
		});
		expect(programIssues(swapped, model).length).toBeGreaterThan(0);
	});

	it("異常系: coverが先頭でない・endcapが最後でない・extrasの位置違いを拒否する", () => {
		const program = sampleProgram();
		const endcapFirst = withScenes(program, (scenes) => {
			const endcap = scenes.pop();
			return endcap ? [endcap, ...scenes] : scenes;
		});
		const issues = programIssues(endcapFirst, model);
		expect(issues).toContain("先頭sceneがcoverではありません。");
		expect(issues).toContain("endcapは最後のsceneでなければなりません。");

		const dividerMoved = withScenes(program, (scenes) => {
			const index = scenes.findIndex((scene) => scene.sceneId === "divider:d2");
			const [divider] = scenes.splice(index, 1);
			if (divider) scenes.push(divider);
			return scenes;
		});
		expect(programIssues(dividerMoved, model)).toContain(
			"divider「divider:d2」が日の先頭sceneの直前にありません。",
		);
	});

	it("境界値系: 同じ日のmemoを二つ持つprogramを拒否する", () => {
		const program = sampleProgram();
		const duplicated = withScenes(program, (scenes) => {
			const index = scenes.findIndex((scene) => scene.sceneId === "memo:d1");
			const memo = scenes[index];
			if (memo) scenes.splice(index, 0, { ...memo, sceneId: "memo:d1:copy" });
			return scenes;
		});
		expect(programIssues(duplicated, model)).toContain(
			"memoは一日につき一つまでです。",
		);
	});

	it("異常系: アルバム頁のmemoがunitを参照していれば拒否し、参照なしなら受け入れる", () => {
		const program = sampleProgram();
		const asAlbum = (
			unitRefs: (refs: readonly string[]) => readonly string[],
		) =>
			withScenes(program, (scenes) =>
				scenes.map((scene) =>
					scene.kind === "memo" && scene.sceneId === "memo:d1"
						? {
								...scene,
								participation: "memory-album",
								unitRefs: unitRefs(scene.unitRefs),
							}
						: scene,
				),
			);
		expect(
			programIssues(
				asAlbum((refs) => refs),
				model,
			),
		).toContain("memo「memo:d1」はアルバム頁なのでunitを参照しません。");
		expect(
			programIssues(
				asAlbum(() => []),
				model,
			),
		).toEqual([]);
	});

	it("境界値系: 空日は空のday sceneを一つだけ持つ", () => {
		const program = sampleProgram();
		const extraEmpty = withScenes(program, (scenes) => {
			const index = scenes.findIndex((scene) => scene.sceneId === "day:d3");
			const day = scenes[index];
			if (day?.kind === "day")
				scenes.splice(index + 1, 0, {
					...day,
					sceneId: "day:d3:again",
					showIllustration: false,
				});
			return scenes;
		});
		expect(programIssues(extraEmpty, model)).toContain(
			"空日「d3」はsceneを一つだけ持ちます。",
		);
	});
});

describe("renderedCoverageIssues", () => {
	const model = testModel();
	const program = compiledProgram(["checklist"], model);
	const owned = model.days.flatMap((day) =>
		day.units.map((unit) => ({
			kind: "owned" as const,
			sceneId: `day:${day.id}`,
			unitId: unit.id,
		})),
	);

	it("正常系: 全unitが入力順に一回ずつ本体として描かれ、memoの参照は数えない", () => {
		const refs = ["d1-u0", "d1-u1"].map((unitId) => ({
			kind: "ref" as const,
			sceneId: "memo:d1",
			unitId,
		}));
		expect(renderedCoverageIssues(program, model, [...owned, ...refs])).toEqual(
			[],
		);
	});

	it("異常系: 参照を本体として数えた二重計数、欠落、順序違いを検出する", () => {
		expect(
			renderedCoverageIssues(program, model, [
				...owned,
				{ kind: "owned", sceneId: "memo:d1", unitId: "d1-u0" },
			]).length,
		).toBeGreaterThan(0);
		expect(renderedCoverageIssues(program, model, owned.slice(1))).toContain(
			"紙面が全unitを入力順に一回ずつ描いていません。",
		);
		expect(
			renderedCoverageIssues(
				program,
				model,
				[owned[1], owned[0], ...owned.slice(2)].filter(
					(mark) => mark !== undefined,
				),
			),
		).toContain("紙面が全unitを入力順に一回ずつ描いていません。");
	});

	it("異常系: 別の日のunitを参照するmemoと、scene外の描画を検出する", () => {
		expect(
			renderedCoverageIssues(program, model, [
				...owned,
				{ kind: "ref", sceneId: "memo:d1", unitId: "d2-u0" },
				{ kind: "ref", sceneId: "unknown", unitId: "d1-u0" },
			]),
		).toHaveLength(2);
	});
});
