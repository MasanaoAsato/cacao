import type { BookletProgram, ProgramScene } from "./model";

/**
 * A fixed-order array for one scene's module and config (style, composition
 * and artwork bindings included). Object key order and function source never
 * enter the key.
 */
function sceneKeyParts(scene: ProgramScene): readonly unknown[] {
	const { config } = scene;
	const moduleSpecific: unknown[] = [];
	if ("styleProfileId" in config) moduleSpecific.push(config.styleProfileId);
	if ("dayHeader" in config) moduleSpecific.push(config.dayHeader);
	if ("ledgerHeading" in config) moduleSpecific.push(config.ledgerHeading);
	if ("heroSplit" in config) moduleSpecific.push(config.heroSplit);
	if ("minimalDecoration" in config)
		moduleSpecific.push(config.minimalDecoration);
	if ("participationLane" in config)
		moduleSpecific.push(
			config.participationLane
				? [config.participationLane.directionId, config.participationLane.lane]
				: null,
		);
	const kindSpecific: unknown[] = [];
	switch (scene.kind) {
		case "day":
			kindSpecific.push(
				scene.dayId,
				[...scene.unitIds],
				scene.showIllustration,
				scene.section
					? [scene.section.directionId, scene.section.timeOfDay]
					: null,
			);
			break;
		case "divider":
			kindSpecific.push(scene.dayRef, scene.chapterRole, scene.directionId);
			break;
		case "memo":
			kindSpecific.push(
				scene.dayRef,
				scene.participation,
				[...scene.unitRefs],
				scene.directionId,
			);
			break;
		case "endcap":
			kindSpecific.push(scene.directionId);
			break;
		case "cover":
			break;
	}
	return [
		scene.sceneId,
		scene.kind,
		scene.moduleId,
		config.compositionId,
		[
			config.surface.directionId,
			config.surface.styleBundleId,
			config.surface.touch,
			config.surface.localePackId,
		],
		[
			config.heading.directionId,
			config.heading.styleBundleId,
			config.heading.system,
			config.heading.orientation,
		],
		config.imageTreatment
			? [config.imageTreatment.directionId, config.imageTreatment.treatment]
			: null,
		config.contentStructure
			? [
					config.contentStructure.directionId,
					config.contentStructure.sourceModuleId,
					config.contentStructure.structure,
				]
			: null,
		config.numberedEntries,
		config.bindings.map((binding) => [
			binding.slotId,
			binding.assetId,
			binding.directionId,
			binding.role,
			binding.touchId,
			binding.viewId,
		]),
		moduleSpecific,
		kindSpecific,
	];
}

/** What the booklet looks like: catalog revision, base direction and every scene. */
export function programComparisonKey(program: BookletProgram): string {
	return JSON.stringify([
		program.catalogRevision,
		program.baseDirectionId,
		program.scenes.map(sceneKeyParts),
	]);
}

/** The comparison key plus the seed; the gate for a prepared render. */
export function programRenderKey(program: BookletProgram): string {
	return JSON.stringify([program.seed, programComparisonKey(program)]);
}
