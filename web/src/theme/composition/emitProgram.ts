import type {
	ArtworkBinding,
	BookletProgram,
	CommonSceneConfig,
	EffectClaim,
	EffectKind,
	ModuleSceneBinding,
	ProgramScene,
} from "../../booklet/program/model";
import {
	EXTRA_PAGE_BODY,
	HEADING_MINIMUM,
	MODULE_CAPABILITIES,
	PARTICIPATION_LANE_WIDTH_MM,
	type RegionSize,
} from "../../booklet/program/moduleCapabilities";
import type { DirectionId } from "../directions/types";
import type {
	DraftBinding,
	DraftScene,
	DraftSceneConfig,
	DraftState,
} from "./types";

/** Program order: cover, then per day divider → day scenes → memo, then endcap. */
export function draftScenes(state: DraftState): readonly DraftScene[] {
	return [
		state.cover,
		...state.days.flatMap((day) => [
			...(day.divider ? [day.divider] : []),
			...day.segments,
			...(day.memo ? [day.memo] : []),
		]),
		...(state.endcap ? [state.endcap] : []),
	];
}

/** Whether a binding will show artwork: a candidate exists, or an asset is frozen. */
export type ArtworkPresence = (
	scene: DraftScene,
	binding: DraftBinding,
) => boolean;

function claim(
	directionId: DirectionId,
	sceneId: string,
	kind: EffectKind,
	regionId: string,
	size: RegionSize,
): EffectClaim {
	return {
		directionId,
		kind,
		minimumHeightMm: size.heightMm,
		minimumWidthMm: size.widthMm,
		regionId,
		sceneId,
	};
}

/**
 * Visible effects that 25.4 must find in the final DOM. A surface bundle is
 * color only and never claims anything on its own.
 */
export function effectsFor(
	scene: DraftScene,
	hasArtwork: ArtworkPresence,
): readonly EffectClaim[] {
	const { config, sceneId } = scene;
	const effects: EffectClaim[] = [];
	const art = () => {
		for (const binding of config.bindings) {
			if (hasArtwork(scene, binding))
				effects.push(
					claim(binding.directionId, sceneId, "hero-art", "hero", {
						heightMm: binding.heightMm,
						widthMm: binding.widthMm,
					}),
				);
		}
	};
	switch (scene.kind) {
		case "cover": {
			const cover = MODULE_CAPABILITIES[config.moduleId].cover;
			if (!cover) return effects;
			effects.push(
				claim(
					config.ownerDirectionId,
					sceneId,
					"body-structure",
					"cover",
					cover.image,
				),
				claim(
					config.heading.directionId,
					sceneId,
					"heading",
					"heading",
					HEADING_MINIMUM,
				),
			);
			art();
			if (config.imageTreatment)
				effects.push(
					claim(
						config.imageTreatment.directionId,
						sceneId,
						"image-treatment",
						"image",
						cover.image,
					),
				);
			return effects;
		}
		case "day": {
			const day = MODULE_CAPABILITIES[config.moduleId].day;
			effects.push(
				config.contentStructure
					? claim(
							config.contentStructure.directionId,
							sceneId,
							"body-structure",
							"body",
							day.body,
						)
					: claim(
							config.ownerDirectionId,
							sceneId,
							config.chapterStyled ? "chapter" : "body-structure",
							"body",
							day.body,
						),
				claim(
					config.heading.directionId,
					sceneId,
					"heading",
					"heading",
					HEADING_MINIMUM,
				),
			);
			if (scene.section)
				effects.push(
					claim(
						scene.section.directionId,
						sceneId,
						"chapter",
						"section",
						HEADING_MINIMUM,
					),
				);
			if (config.participationLane)
				effects.push(
					claim(
						config.participationLane.directionId,
						sceneId,
						"participation",
						"lane",
						{
							heightMm: day.body.heightMm,
							widthMm:
								PARTICIPATION_LANE_WIDTH_MM[config.participationLane.lane],
						},
					),
				);
			art();
			const image =
				config.heroSplit && day.splitHero ? day.splitHero.image : day.image;
			if (config.imageTreatment && image)
				effects.push(
					claim(
						config.imageTreatment.directionId,
						sceneId,
						"image-treatment",
						"image",
						image,
					),
				);
			return effects;
		}
		case "divider":
		case "endcap":
			return [
				claim(scene.directionId, sceneId, "chapter", "page", EXTRA_PAGE_BODY),
			];
		case "memo":
			return [
				claim(
					scene.directionId,
					sceneId,
					"participation",
					"memo",
					EXTRA_PAGE_BODY,
				),
			];
	}
}

/** Effective direction IDs in adoption order: only those with a remaining effect. */
export function effectiveDirectionIds(
	state: DraftState,
	hasArtwork: ArtworkPresence,
): readonly DirectionId[] {
	const present = new Set(
		draftScenes(state).flatMap((scene) =>
			effectsFor(scene, hasArtwork).map((effect) => effect.directionId),
		),
	);
	return state.adopted.filter((id) => present.has(id));
}

function commonConfig(
	config: DraftSceneConfig,
	bindings: readonly ArtworkBinding[],
): CommonSceneConfig {
	return {
		bindings,
		compositionId: config.compositionId,
		contentStructure: config.contentStructure,
		heading: config.heading,
		imageTreatment: config.imageTreatment,
		numberedEntries: config.numberedEntries,
		surface: config.surface,
	};
}

function moduleBinding(
	config: DraftSceneConfig,
	bindings: readonly ArtworkBinding[],
): ModuleSceneBinding {
	const common = commonConfig(config, bindings);
	// Compiled scenes always draw with the direction's own bundle, never a family profile.
	const extracted = { ...common, styleProfileId: null };
	switch (config.moduleId) {
		case "atlas-grid":
		case "editorial-magazine":
		case "paper-collage":
		case "travel-newspaper":
			return { config: extracted, moduleId: config.moduleId };
		case "schematic-map":
		case "specimen-board":
		case "vertical-poster":
			return { config: common, moduleId: config.moduleId };
		case "ledger":
			return {
				config: { ...common, ledgerHeading: config.ledgerHeading },
				moduleId: "ledger",
			};
		case "photo-essay":
			return {
				config: { ...common, heroSplit: config.heroSplit },
				moduleId: "photo-essay",
			};
		case "playful-route":
			return {
				config: { ...extracted, dayHeader: config.dayHeader },
				moduleId: "playful-route",
			};
		case "quest-board":
			return {
				config: {
					...common,
					dayHeader: config.dayHeader,
					participationLane: config.participationLane,
				},
				moduleId: "quest-board",
			};
		case "woodcut-folio":
			return {
				config: { ...common, minimalDecoration: config.minimalDecoration },
				moduleId: "woodcut-folio",
			};
	}
}

function woodcutExtras(config: DraftSceneConfig) {
	return {
		config: { ...commonConfig(config, []), minimalDecoration: false },
		moduleId: "woodcut-folio" as const,
	};
}

export type ProgramMeta = {
	readonly catalogRevision: string;
	readonly seed: string;
};

type AssetResolver = (
	scene: DraftScene,
	binding: DraftBinding,
) => string | null;

function toProgramScene(
	scene: DraftScene,
	resolveAsset: AssetResolver,
	hasArtwork: ArtworkPresence,
): ProgramScene {
	const bindings = scene.config.bindings.map(
		(binding): ArtworkBinding => ({
			assetId: resolveAsset(scene, binding),
			directionId: binding.directionId,
			role: binding.role,
			slotId: binding.slotId,
			touchId: binding.touchId,
			viewId: binding.viewId,
		}),
	);
	const effects = effectsFor(scene, hasArtwork);
	switch (scene.kind) {
		case "cover":
			return {
				...moduleBinding(scene.config, bindings),
				effects,
				kind: "cover",
				sceneId: scene.sceneId,
			};
		case "day":
			return {
				...moduleBinding(scene.config, bindings),
				dayId: scene.dayId,
				effects,
				kind: "day",
				sceneId: scene.sceneId,
				section: scene.section,
				showIllustration: scene.showIllustration,
				unitIds: scene.unitIds,
			};
		case "divider":
			return {
				...woodcutExtras(scene.config),
				chapterRole: scene.chapterRole,
				dayRef: scene.dayRef,
				directionId: scene.directionId,
				effects,
				kind: "divider",
				sceneId: scene.sceneId,
			};
		case "memo":
			return {
				...woodcutExtras(scene.config),
				dayRef: scene.dayRef,
				directionId: scene.directionId,
				effects,
				kind: "memo",
				participation: scene.participation,
				sceneId: scene.sceneId,
				unitRefs: scene.unitRefs,
			};
		case "endcap":
			return {
				...woodcutExtras(scene.config),
				directionId: scene.directionId,
				effects,
				kind: "endcap",
				sceneId: scene.sceneId,
			};
	}
}

export function toProgram(
	state: DraftState,
	meta: ProgramMeta,
	resolveAsset: AssetResolver,
	hasArtwork: ArtworkPresence,
): BookletProgram {
	const scenes = draftScenes(state).map((scene) =>
		toProgramScene(scene, resolveAsset, hasArtwork),
	);
	return {
		baseDirectionId: state.baseDirectionId,
		catalogRevision: meta.catalogRevision,
		scenes,
		seed: meta.seed,
	};
}
