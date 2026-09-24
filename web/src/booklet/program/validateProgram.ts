import type { BookletModel } from "../model";
import type { BookletProgram, DayScene } from "./model";
import { MODULE_CAPABILITIES } from "./moduleCapabilities";

/**
 * Checks the structural contract before measurement: one leading cover, at
 * most one trailing endcap, every unit exactly once in day scenes in input
 * order, and extras only referencing their day. Messages carry IDs only.
 */
export function programIssues(
	program: BookletProgram,
	model: BookletModel,
): readonly string[] {
	const issues: string[] = [];
	const { scenes } = program;
	if (scenes.length === 0) return ["sceneがありません。"];
	if (scenes[0]?.kind !== "cover")
		issues.push("先頭sceneがcoverではありません。");
	if (scenes.filter((scene) => scene.kind === "cover").length !== 1)
		issues.push("coverはちょうど一つでなければなりません。");
	const endcaps = scenes.filter((scene) => scene.kind === "endcap");
	if (endcaps.length > 1) issues.push("endcapは一つまでです。");
	if (endcaps.length === 1 && scenes.at(-1)?.kind !== "endcap")
		issues.push("endcapは最後のsceneでなければなりません。");

	const sceneIds = new Set<string>();
	for (const scene of scenes) {
		if (sceneIds.has(scene.sceneId))
			issues.push(`scene「${scene.sceneId}」が重複しています。`);
		sceneIds.add(scene.sceneId);
		if (
			scene.kind === "cover" &&
			MODULE_CAPABILITIES[scene.moduleId].cover === null
		)
			issues.push(`module「${scene.moduleId}」はcoverを描けません。`);
		for (const effect of scene.effects) {
			if (effect.sceneId !== scene.sceneId)
				issues.push(`scene「${scene.sceneId}」の寄与が別sceneを指しています。`);
		}
	}

	const dayIndexById = new Map(model.days.map((day, index) => [day.id, index]));
	const expectedUnits = model.days.flatMap((day) =>
		day.units.map((unit) => ({ dayId: day.id, unitId: unit.id })),
	);
	const daySceneList = scenes.filter(
		(scene): scene is DayScene => scene.kind === "day",
	);
	const actualUnits = daySceneList.flatMap((scene) =>
		scene.unitIds.map((unitId) => ({ dayId: scene.dayId, unitId })),
	);
	if (
		actualUnits.length !== expectedUnits.length ||
		actualUnits.some(
			(unit, index) =>
				unit.dayId !== expectedUnits[index]?.dayId ||
				unit.unitId !== expectedUnits[index]?.unitId,
		)
	)
		issues.push("day sceneが全unitを入力順に一回ずつ含んでいません。");

	let previousDayIndex = -1;
	for (const scene of daySceneList) {
		const dayIndex = dayIndexById.get(scene.dayId);
		if (dayIndex === undefined) {
			issues.push(`day「${scene.dayId}」は入力にありません。`);
			continue;
		}
		if (dayIndex < previousDayIndex)
			issues.push(`day「${scene.dayId}」の順序が入力と異なります。`);
		previousDayIndex = dayIndex;
	}
	for (const day of model.days) {
		const own = daySceneList.filter((scene) => scene.dayId === day.id);
		if (own.length === 0) {
			issues.push(`day「${day.id}」のsceneがありません。`);
			continue;
		}
		if (day.units.length > 0 && own.some((scene) => scene.unitIds.length === 0))
			issues.push(`day「${day.id}」に空のunit sceneがあります。`);
		if (day.units.length === 0 && own.length !== 1)
			issues.push(`空日「${day.id}」はsceneを一つだけ持ちます。`);
		if (own.filter((scene) => scene.showIllustration).length > 1)
			issues.push(`day「${day.id}」の挿絵が複数sceneにあります。`);
		if (own.some((scene, index) => index > 0 && scene.showIllustration))
			issues.push(`day「${day.id}」の挿絵が先頭scene以外にあります。`);
	}

	scenes.forEach((scene, index) => {
		if (scene.kind === "divider") {
			const next = scenes[index + 1];
			const firstOfDay = daySceneList.find((day) => day.dayId === scene.dayRef);
			if (!firstOfDay || next !== firstOfDay)
				issues.push(
					`divider「${scene.sceneId}」が日の先頭sceneの直前にありません。`,
				);
		}
		if (scene.kind === "memo") {
			const previous = scenes[index - 1];
			const lastOfDay = daySceneList.findLast(
				(day) => day.dayId === scene.dayRef,
			);
			if (!lastOfDay || previous !== lastOfDay)
				issues.push(
					`memo「${scene.sceneId}」が日の最後のsceneの直後にありません。`,
				);
			const dayUnits = new Set(
				model.days
					.find((day) => day.id === scene.dayRef)
					?.units.map((unit) => unit.id),
			);
			if (scene.unitRefs.some((unitId) => !dayUnits.has(unitId)))
				issues.push(`memo「${scene.sceneId}」が別の日のunitを参照しています。`);
			if (scene.participation === "memory-album" && scene.unitRefs.length > 0)
				issues.push(
					`memo「${scene.sceneId}」はアルバム頁なのでunitを参照しません。`,
				);
		}
	});
	for (const kind of ["divider", "memo"] as const) {
		const refs = scenes.flatMap((scene) =>
			scene.kind === kind ? [scene.dayRef] : [],
		);
		if (new Set(refs).size !== refs.length)
			issues.push(`${kind}は一日につき一つまでです。`);
	}
	return issues;
}

/** One `data-unit-id` (owned) or `data-unit-ref` (referenced) read from the document. */
export type RenderedUnitMark = {
	readonly kind: "owned" | "ref";
	readonly sceneId: string;
	readonly unitId: string;
};

/**
 * The same coverage contract on the final DOM: every input unit is drawn as
 * body exactly once, in input order, inside its own day scene. References on
 * extras are never counted as body and only point at their memo's units.
 */
export function renderedCoverageIssues(
	program: BookletProgram,
	model: BookletModel,
	marks: readonly RenderedUnitMark[],
): readonly string[] {
	const issues: string[] = [];
	const expected = model.days.flatMap((day) =>
		day.units.map((unit) => unit.id),
	);
	const owned = marks.filter((mark) => mark.kind === "owned");
	if (
		owned.length !== expected.length ||
		owned.some((mark, index) => mark.unitId !== expected[index])
	)
		issues.push("紙面が全unitを入力順に一回ずつ描いていません。");
	const scenes = new Map(program.scenes.map((scene) => [scene.sceneId, scene]));
	for (const mark of marks) {
		const scene = scenes.get(mark.sceneId);
		if (!scene) {
			issues.push(`unit「${mark.unitId}」がscene外に描かれています。`);
			continue;
		}
		if (mark.kind === "owned") {
			if (scene.kind !== "day" || !scene.unitIds.includes(mark.unitId))
				issues.push(
					`unit「${mark.unitId}」がscene「${scene.sceneId}」の本体として描かれています。`,
				);
			continue;
		}
		if (scene.kind !== "memo" || !scene.unitRefs.includes(mark.unitId))
			issues.push(
				`scene「${scene.sceneId}」が参照できないunit「${mark.unitId}」を参照しています。`,
			);
	}
	return issues;
}
