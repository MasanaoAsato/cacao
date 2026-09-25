import { ARTWORK_MANIFEST } from "../../assets/artwork/manifest";
import artworkReviews from "../reviews/artwork.json";
import { selectPublishedArtwork } from "../reviews/publication";
import type { ArtworkReview } from "../reviews/types";
import { PUBLISHED_ARTWORK_URLS } from "./publishedUrls";
import type { ArtworkAlias, ArtworkAsset } from "./types";
import { assertArtworkCatalog } from "./validateCatalog";

/** Old names can point to canonical IDs without increasing the production count. */
export const ARTWORK_ALIASES: readonly ArtworkAlias[] = [];

assertArtworkCatalog(ARTWORK_MANIFEST, {
	aliases: ARTWORK_ALIASES,
});

const publishedArtwork = selectPublishedArtwork(
	ARTWORK_MANIFEST,
	artworkReviews as ArtworkReview[],
);
if (publishedArtwork.issues.length > 0)
	throw new Error(
		`Artwork publication is inconsistent: ${publishedArtwork.issues.join("; ")}`,
	);
const publishedPaths = new Set(
	publishedArtwork.selected.map((definition) => definition.sourcePath),
);
if (
	Object.keys(PUBLISHED_ARTWORK_URLS).length !== publishedPaths.size ||
	[...publishedPaths].some((path) => !PUBLISHED_ARTWORK_URLS[path])
)
	throw new Error(
		"Published artwork URL list is stale; regenerate it before building.",
	);

export const ARTWORK_CATALOG: readonly ArtworkAsset[] =
	publishedArtwork.selected.map((definition) => ({
		...definition,
		src: PUBLISHED_ARTWORK_URLS[definition.sourcePath] ?? "",
	}));

const byId = new Map(ARTWORK_CATALOG.map((artwork) => [artwork.id, artwork]));
const aliasTargets = new Map(
	ARTWORK_ALIASES.map((alias) => [alias.id, alias.targetId]),
);

/** Only active artwork IDs can enter a frozen product booklet program. */
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
		throw new Error(`Artwork is missing or not active: ${id}`);
	}
	return artwork;
}
