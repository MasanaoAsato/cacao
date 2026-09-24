import type { CSSProperties } from "react";
import type { ProgramScene } from "../../../booklet/program/model";
import { LOCALE_PACKS } from "../../../theme/directions/localePacks";
import {
	type FontWeight,
	STYLE_BUNDLES,
	type StyleBundle,
} from "../../../theme/directions/styleBundles";
import { fontStack } from "../../../theme/families/styleProfiles";

export type FontRequirement = {
	readonly family: string;
	readonly weight: FontWeight;
};

/**
 * What one scene draws with. Paper, body text and accent always come from
 * one bundle; a transplanted heading system brings its own opaque band.
 */
export type SceneStyle = {
	readonly fonts: readonly FontRequirement[];
	readonly heading: StyleBundle;
	/** Shown as `data-booklet-style-id` on every page of the scene. */
	readonly styleId: string;
	readonly surface: StyleBundle;
	readonly vars: CSSProperties;
};

function surfaceBundle(scene: ProgramScene): StyleBundle {
	const bundle = STYLE_BUNDLES[scene.config.surface.styleBundleId];
	const packId = scene.config.surface.localePackId;
	const pack = packId ? LOCALE_PACKS.find((item) => item.id === packId) : null;
	// A registered locale replaces paper, body and accent together.
	return pack
		? {
				...bundle,
				accentColor: pack.palette.accent,
				bodyColor: pack.palette.body,
				paperColor: pack.palette.paper,
			}
		: bundle;
}

function uniqueFonts(
	bundles: readonly StyleBundle[],
): readonly FontRequirement[] {
	const fonts = new Map<string, FontRequirement>();
	for (const bundle of bundles) {
		for (const font of [
			{ family: bundle.displayFontFamily, weight: bundle.displayFontWeight },
			{ family: bundle.bodyFontFamily, weight: bundle.bodyFontWeight },
			{ family: bundle.utilityFontFamily, weight: bundle.utilityFontWeight },
		]) {
			fonts.set(`${font.weight} ${font.family}`, font);
		}
	}
	return [...fonts.values()];
}

export function resolveSceneStyle(scene: ProgramScene): SceneStyle {
	const surface = surfaceBundle(scene);
	const heading = STYLE_BUNDLES[scene.config.heading.styleBundleId];
	const ownHeading =
		scene.config.heading.styleBundleId === scene.config.surface.styleBundleId;
	// The heading band keeps its own paper only when it came from another bundle.
	const headingPaper = ownHeading ? surface.paperColor : heading.paperColor;
	const headingInk = ownHeading ? surface.bodyColor : heading.bodyColor;
	const headingAccent = ownHeading ? surface.accentColor : heading.accentColor;
	const vars = {
		"--scene-accent": surface.accentColor,
		"--scene-body-family": fontStack(surface.bodyFontFamily),
		"--scene-body-line-height": surface.bodyLineHeight,
		"--scene-body-size": `${surface.bodyFontSizePt}pt`,
		"--scene-body-weight": surface.bodyFontWeight,
		"--scene-display-family": fontStack(surface.displayFontFamily),
		"--scene-display-size": `${surface.displayFontSizePt}pt`,
		"--scene-display-weight": surface.displayFontWeight,
		"--scene-heading-accent": headingAccent,
		"--scene-heading-family": fontStack(heading.displayFontFamily),
		"--scene-heading-ink": headingInk,
		"--scene-heading-paper": headingPaper,
		"--scene-heading-size": `${heading.displayFontSizePt}pt`,
		"--scene-heading-weight": heading.displayFontWeight,
		"--scene-ink": surface.bodyColor,
		"--scene-paper": surface.paperColor,
		"--scene-utility-family": fontStack(surface.utilityFontFamily),
		"--scene-utility-line-height": surface.utilityLineHeight,
		"--scene-utility-size": `${surface.utilityFontSizePt}pt`,
		"--scene-utility-weight": surface.utilityFontWeight,
	} as CSSProperties;
	const packId = scene.config.surface.localePackId;
	return {
		fonts: uniqueFonts(ownHeading ? [surface] : [surface, heading]),
		heading,
		styleId: [
			scene.config.surface.styleBundleId,
			packId ? `locale:${packId}` : null,
			ownHeading ? null : `heading:${scene.config.heading.styleBundleId}`,
			"styleProfileId" in scene.config && scene.config.styleProfileId
				? `profile:${scene.config.styleProfileId}`
				: null,
		]
			.filter((part) => part !== null)
			.join("/"),
		surface,
		vars,
	};
}
