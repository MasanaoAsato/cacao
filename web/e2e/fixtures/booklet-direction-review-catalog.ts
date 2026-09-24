import { ARTWORK_MANIFEST } from "../../src/assets/artwork/manifest";
import type { ArtworkAsset } from "../../src/theme/artwork/types";
import type { CompositionCatalog } from "../../src/theme/composition/types";
import { directionDefinitionById } from "../../src/theme/directions/registry";
import type { DirectionId } from "../../src/theme/directions/types";

// Only the review fixture bundles these URLs. The product catalog stays reviewed-only.
const urls: Record<string, string> = import.meta.glob(
	"../../src/assets/artwork/*/*.{svg,webp}",
	{ eager: true, import: "default", query: "?url" },
);

const artwork: readonly ArtworkAsset[] = ARTWORK_MANIFEST.map((entry) => {
	const source = entry.sourcePath.replace(
		"../../assets/artwork/",
		"../../src/assets/artwork/",
	);
	const src = urls[source];
	if (!src) throw new Error(`審査用素材の実ファイルがありません: ${entry.id}`);
	return { ...entry, reviewId: "preview-only", src };
});
const byId = new Map(artwork.map((entry) => [entry.id, entry]));

export function previewArtworkById(id: string): ArtworkAsset {
	const entry = byId.get(id);
	if (!entry) throw new Error(`審査用素材がありません: ${id}`);
	return entry;
}

/** Forces one registered baseline to inspect drafts; not a random product sample. */
export function previewCatalogFor(id: DirectionId): CompositionCatalog {
	return {
		artwork,
		directions: [directionDefinitionById(id)],
		maxDirections: 1,
		revision: `draft-preview-${id}`,
	};
}
