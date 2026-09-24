import type {
	AnyLocalPage,
	AnyScenePlan,
	BookletProgram,
	ProgramScene,
} from "./model";

export class ProgramAssemblyError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "ProgramAssemblyError";
	}
}

/** A final page: scene order, then the scene's local order. */
export type AssembledPage = {
	/** 1-based running number drawn in the footer after concatenation. */
	readonly pageNumber: number;
	/** `${sceneId}/${localPageId}`; never derived from randomness or DOM order. */
	readonly pageId: string;
	readonly page: AnyLocalPage;
	readonly scene: ProgramScene;
	readonly sceneIndex: number;
};

export function programPageId(sceneId: string, localPageId: string): string {
	return `${sceneId}/${localPageId}`;
}

function sameIds(a: readonly string[], b: readonly string[]): boolean {
	return a.length === b.length && a.every((id, index) => id === b[index]);
}

/**
 * Concatenates the local plans in scene order. Each scene needs exactly its
 * own plan with at least one page; a day scene's pages hold its units once
 * each, in order; extras own no unit and a memo only references its own.
 */
export function assemblePages(
	program: BookletProgram,
	plans: ReadonlyMap<string, AnyScenePlan>,
): readonly AssembledPage[] {
	const pages: AssembledPage[] = [];
	if (plans.size !== program.scenes.length) {
		throw new ProgramAssemblyError(
			"sceneの計画数がprogramのscene数と一致しません。",
		);
	}
	program.scenes.forEach((scene, sceneIndex) => {
		const plan = plans.get(scene.sceneId);
		if (!plan) {
			throw new ProgramAssemblyError(
				`scene「${scene.sceneId}」の計画がありません。`,
			);
		}
		if (plan.sceneId !== scene.sceneId || plan.moduleId !== scene.moduleId) {
			throw new ProgramAssemblyError(
				`scene「${scene.sceneId}」に別sceneの計画が渡されました。`,
			);
		}
		if (plan.pages.length === 0) {
			throw new ProgramAssemblyError(
				`scene「${scene.sceneId}」にページがありません。`,
			);
		}
		const localIds = new Set<string>();
		for (const page of plan.pages) {
			if (localIds.has(page.localPageId)) {
				throw new ProgramAssemblyError(
					`scene「${scene.sceneId}」のページID「${page.localPageId}」が重複しています。`,
				);
			}
			localIds.add(page.localPageId);
		}
		const owned = plan.pages.flatMap((page) => page.unitIds);
		if (scene.kind === "day") {
			if (!sameIds(owned, scene.unitIds)) {
				throw new ProgramAssemblyError(
					`scene「${scene.sceneId}」のページが予定を順に一回ずつ含んでいません。`,
				);
			}
		} else if (owned.length > 0) {
			throw new ProgramAssemblyError(
				`scene「${scene.sceneId}」は予定を所有できません。`,
			);
		}
		const refs = plan.pages.flatMap((page) => page.unitRefs);
		const allowedRefs = new Set(scene.kind === "memo" ? scene.unitRefs : []);
		if (refs.some((id) => !allowedRefs.has(id))) {
			throw new ProgramAssemblyError(
				`scene「${scene.sceneId}」が参照できない予定を参照しています。`,
			);
		}
		if (new Set(refs).size !== refs.length) {
			throw new ProgramAssemblyError(
				`scene「${scene.sceneId}」が同じ予定を二回参照しています。`,
			);
		}
		for (const page of plan.pages) {
			pages.push(
				Object.freeze({
					page,
					pageId: programPageId(scene.sceneId, page.localPageId),
					pageNumber: pages.length + 1,
					scene,
					sceneIndex,
				}),
			);
		}
	});
	return Object.freeze(pages);
}
