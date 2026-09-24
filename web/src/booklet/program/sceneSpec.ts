import type { EditorialBooklet, PolicyId } from "../editorialModel";
import type { BookletModel } from "../model";
import { projectBooklet } from "../projectBooklet";
import { policyForScene } from "./bodyStructures";
import type {
	AnySceneSpec,
	BookletProgram,
	ProgramScene,
	SceneContent,
} from "./model";

/**
 * Fonts, colors and heading a scene draws with. Measurement DOM and output
 * report the same key so a unit measured in another style is rejected.
 */
export function sceneStyleKey(scene: ProgramScene): string {
	const { config } = scene;
	return JSON.stringify([
		config.surface.styleBundleId,
		config.surface.localePackId,
		config.heading.styleBundleId,
		config.heading.system,
		config.heading.orientation,
		"styleProfileId" in config ? config.styleProfileId : null,
	]);
}

function contentFor(
	scene: ProgramScene,
	booklet: EditorialBooklet,
): SceneContent {
	const base = {
		booklet,
		firstUnitOffset: 0,
		policyId: booklet.policyId,
	};
	switch (scene.kind) {
		case "cover":
		case "endcap":
			return {
				...base,
				day: null,
				dayIndex: null,
				ownedUnits: [],
				referencedUnits: [],
			};
		case "day": {
			const dayIndex = booklet.days.findIndex((day) => day.id === scene.dayId);
			const day = booklet.days[dayIndex];
			if (!day) throw new Error(`day「${scene.dayId}」が入力にありません。`);
			const owned = new Set(scene.unitIds);
			const ownedUnits = day.units.filter((unit) => owned.has(unit.id));
			const firstId = scene.unitIds[0];
			return {
				...base,
				day: { ...day, units: ownedUnits },
				dayIndex,
				firstUnitOffset:
					firstId === undefined
						? 0
						: day.units.findIndex((unit) => unit.id === firstId),
				ownedUnits,
				referencedUnits: [],
			};
		}
		case "divider":
		case "memo": {
			const dayIndex = booklet.days.findIndex((day) => day.id === scene.dayRef);
			const day = booklet.days[dayIndex];
			if (!day) throw new Error(`day「${scene.dayRef}」が入力にありません。`);
			const refs =
				scene.kind === "memo" ? new Set(scene.unitRefs) : new Set<string>();
			return {
				...base,
				day,
				dayIndex,
				ownedUnits: [],
				referencedUnits: day.units.filter((unit) => refs.has(unit.id)),
			};
		}
	}
}

/**
 * Projects the model once per policy, then narrows each scene to its own
 * unit range. Scene order is program order.
 */
export function buildSceneSpecs(
	program: BookletProgram,
	model: BookletModel,
): readonly AnySceneSpec[] {
	const projections = new Map<PolicyId, EditorialBooklet>();
	const project = (policyId: PolicyId) => {
		let booklet = projections.get(policyId);
		if (!booklet) {
			booklet = projectBooklet(model, policyId);
			projections.set(policyId, booklet);
		}
		return booklet;
	};
	return program.scenes.map(
		(scene): AnySceneSpec => ({
			content: contentFor(scene, project(policyForScene(scene))),
			scene,
			styleKey: sceneStyleKey(scene),
		}),
	);
}
