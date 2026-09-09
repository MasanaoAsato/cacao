import type { MotifDefinition } from "./types";

const atlasCompassUrl = new URL(
	"../assets/motifs/atlas-ink/atlas-compass.svg",
	import.meta.url,
).href;
const atlasPerforationUrl = new URL(
	"../assets/motifs/atlas-ink/atlas-perforation.svg",
	import.meta.url,
).href;
const atlasRouteMarkUrl = new URL(
	"../assets/motifs/atlas-ink/atlas-route-mark.svg",
	import.meta.url,
).href;
const paperLeafUrl = new URL(
	"../assets/motifs/paper-cut/paper-leaf.svg",
	import.meta.url,
).href;
const paperPostageUrl = new URL(
	"../assets/motifs/paper-cut/paper-postage.svg",
	import.meta.url,
).href;
const paperTapeUrl = new URL(
	"../assets/motifs/paper-cut/paper-tape.svg",
	import.meta.url,
).href;
const paperTornSheetUrl = new URL(
	"../assets/motifs/paper-cut/paper-torn-sheet.svg",
	import.meta.url,
).href;
const playfulBagUrl = new URL(
	"../assets/motifs/playful-doodle/playful-bag.svg",
	import.meta.url,
).href;
const playfulBurstUrl = new URL(
	"../assets/motifs/playful-doodle/playful-burst.svg",
	import.meta.url,
).href;
const playfulSquiggleUrl = new URL(
	"../assets/motifs/playful-doodle/playful-squiggle.svg",
	import.meta.url,
).href;
const playfulSunUrl = new URL(
	"../assets/motifs/playful-doodle/playful-sun.svg",
	import.meta.url,
).href;

export type MotifAssetId =
	| "atlas-compass"
	| "atlas-route-mark"
	| "atlas-perforation"
	| "paper-torn-sheet"
	| "paper-tape"
	| "paper-leaf"
	| "paper-postage"
	| "playful-bag"
	| "playful-sun"
	| "playful-squiggle"
	| "playful-burst";

export type MotifAsset = Extract<
	MotifDefinition,
	{ readonly kind: "asset" }
> & {
	readonly id: MotifAssetId;
};

function asset(
	id: MotifAsset["id"],
	styleId: MotifAsset["styleId"],
	aspect: number,
	src: string,
	recolor: MotifAsset["recolor"] = "mask",
): MotifAsset {
	return { aspect, coverage: 1, id, kind: "asset", recolor, src, styleId };
}

/**
 * Static artwork bundled by Vite. The source SVG viewBox is the authority for
 * `aspect`; `motifAssets.test.ts` keeps this registry aligned with the files.
 */
export const MOTIF_ASSETS: readonly MotifAsset[] = [
	asset("atlas-compass", "atlas-ink", 1, atlasCompassUrl),
	asset("atlas-route-mark", "atlas-ink", 2, atlasRouteMarkUrl),
	asset("atlas-perforation", "atlas-ink", 1 / 4, atlasPerforationUrl),
	asset("paper-torn-sheet", "paper-cut", 4 / 3, paperTornSheetUrl, "none"),
	asset("paper-tape", "paper-cut", 3, paperTapeUrl, "none"),
	asset("paper-leaf", "paper-cut", 1 / 2, paperLeafUrl),
	asset("paper-postage", "paper-cut", 1, paperPostageUrl),
	asset("playful-bag", "playful-doodle", 3 / 4, playfulBagUrl),
	asset("playful-sun", "playful-doodle", 1, playfulSunUrl),
	asset("playful-squiggle", "playful-doodle", 3, playfulSquiggleUrl),
	asset("playful-burst", "playful-doodle", 2, playfulBurstUrl),
];

const MOTIF_ASSET_BY_ID = new Map(
	MOTIF_ASSETS.map((asset) => [asset.id, asset] as const),
);

/** Returns only the artwork named by a family, rejecting stale asset IDs. */
export function motifAssetsFor(
	ids: readonly MotifAssetId[],
): readonly MotifAsset[] {
	return ids.map((id) => {
		const asset = MOTIF_ASSET_BY_ID.get(id);
		if (!asset) {
			throw new Error(`装飾素材「${id}」が登録されていません。`);
		}
		return asset;
	});
}
