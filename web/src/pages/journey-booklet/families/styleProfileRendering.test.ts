import { describe, expect, it } from "vitest";
import type { ResolvedBookletDesign } from "../../../booklet/family";
import { createBookletTheme } from "../../../theme/bookletTheme";
import {
	type BookletStyleProfile,
	fontStack,
	styleProfileFor,
} from "../../../theme/families/styleProfiles";
import { atlasStyle } from "./AtlasGrid";
import { paperCollageStyle } from "./PaperCollage";
import { playfulRouteStyle } from "./PlayfulRoute";

function designFor(profile: BookletStyleProfile): ResolvedBookletDesign {
	const requestedTheme = createBookletTheme({ value: 7, version: "v2" });
	const policyId =
		profile.familyId === "atlas-grid"
			? "timetable"
			: profile.familyId === "paper-collage"
				? "captions"
				: "route";
	return {
		comparisonKey: `${profile.familyId}.${profile.id}.${profile.paletteId}.${profile.compositionIds[0]}`,
		compositionId: profile.compositionIds[0] ?? "",
		decorAssetIds: profile.decorAssetIds,
		decorVariantId: profile.decorVariantId,
		familyId: profile.familyId,
		fontFamilies: [
			profile.fontFamilies.display,
			profile.fontFamilies.body,
			profile.fontFamilies.utility,
		],
		paletteId: profile.paletteId,
		policyId,
		renderKey: `${profile.familyId}:v2-00000007:${policyId}:${profile.id}`,
		requestedTheme,
		seedToken: "v2-00000007",
		styleProfile: profile,
		styleProfileId: profile.id,
	};
}

describe("family rendererの作風CSS変数", () => {
	it.each([
		["atlas-grid.atlas-wayfinder", atlasStyle],
		["atlas-grid.atlas-field-record", atlasStyle],
		["paper-collage.paper-cut", paperCollageStyle],
		["paper-collage.paper-scrapbook", paperCollageStyle],
		["playful-route.playful-pop", playfulRouteStyle],
		["playful-route.playful-travel-diary", playfulRouteStyle],
	] as const)(
		"正常系: %s の描画・計測共通styleはrole別フォントを解決する",
		(styleProfileId, styleFor) => {
			const profile = styleProfileFor(styleProfileId);
			const style = styleFor(designFor(profile)) as Record<
				string,
				string | number | undefined
			>;

			expect(style["--booklet-body-family"]).toBe(
				fontStack(profile.fontFamilies.body),
			);
			expect(style["--booklet-body-size"]).toBe(
				`${profile.fontSizesPt.body}pt`,
			);
			if (profile.familyId === "atlas-grid") {
				expect(style["--atlas-display-weight"]).toBe(
					profile.fontWeights.display,
				);
				expect(style["--atlas-photo-border"]).toBe(
					profile.photoTreatment === "record-field"
						? "0.7pt solid var(--atlas-accent)"
						: "none",
				);
			} else if (profile.familyId === "paper-collage") {
				expect(style["--paper-collage-display-weight"]).toBe(
					profile.fontWeights.display,
				);
				expect(style["--paper-collage-photo-rotation"]).toBe(
					profile.photoTreatment === "rotated-paper" ? "-1.5deg" : "0deg",
				);
			} else {
				expect(style["--playful-route-display-weight"]).toBe(
					profile.fontWeights.display,
				);
				expect(style["--playful-route-body-family"]).toBe(
					fontStack(profile.fontFamilies.body),
				);
			}
		},
	);
});
