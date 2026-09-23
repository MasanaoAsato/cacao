import { ARTWORK_MANIFEST } from "../../assets/artwork/manifest";
import type { ArtworkAlias, ArtworkAsset } from "./types";
import { assertArtworkCatalog } from "./validateCatalog";

/** Vite turns these imports into local URLs. It does not preload the files. */
const bundledUrls: Record<string, string> = import.meta.glob(
	"../../assets/artwork/*/*.{svg,webp}",
	{ eager: true, import: "default", query: "?url" },
);

/** Old names can point to canonical IDs without increasing the production count. */
export const ARTWORK_ALIASES: readonly ArtworkAlias[] = [];

assertArtworkCatalog(ARTWORK_MANIFEST, {
	aliases: ARTWORK_ALIASES,
	bundledUrls,
});

export const ARTWORK_CATALOG: readonly ArtworkAsset[] = ARTWORK_MANIFEST.filter(
	(definition) => Boolean(definition.reviewId?.trim()),
).map((definition) => ({
	...definition,
	src: bundledUrls[definition.sourcePath] ?? "",
}));

const byId = new Map(ARTWORK_CATALOG.map((artwork) => [artwork.id, artwork]));
const aliasTargets = new Map(
	ARTWORK_ALIASES.map((alias) => [alias.id, alias.targetId]),
);

/** A draft or unknown ID cannot enter a frozen booklet program. */
export function artworkById(id: string): ArtworkAsset {
	const seen = new Set<string>();
	let canonicalId = id;
	while (aliasTargets.has(canonicalId)) {
		if (seen.has(canonicalId)) {
			throw new Error(`Artwork alias cycle: ${id}`);
		}
		seen.add(canonicalId);
		canonicalId = aliasTargets.get(canonicalId) ?? "";
	}
	const artwork = byId.get(canonicalId);
	if (!artwork) {
		throw new Error(`Artwork is missing or not reviewed: ${id}`);
	}
	return artwork;
}
