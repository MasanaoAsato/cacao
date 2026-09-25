import { ARTWORK_MANIFEST } from "../../src/assets/artwork/manifest";
import { isDirectionArtworkReady } from "../../src/theme/composition/activeDirections";
import {
	CATALOG_REVISION,
	MAX_BOOKLET_DIRECTIONS,
} from "../../src/theme/composition/catalogRevision";
import type { CompositionCatalog } from "../../src/theme/composition/types";
import { directionDefinitionById } from "../../src/theme/directions/registry";
import type { DirectionId } from "../../src/theme/directions/types";
import artworkReviews from "../../src/theme/reviews/artwork.json";
import { selectPlannedArtwork } from "../../src/theme/reviews/publication";
import type { ArtworkReview } from "../../src/theme/reviews/types";

export type PublicationPlan = {
	readonly directionIds: readonly DirectionId[];
	readonly artworkIds: readonly string[];
};

/**
 * The formal comparison uses the exact planned direction set and deployment
 * revision. It cannot use draft art or the one-direction diagnostic preview.
 * The URLs are only for Vite's E2E server; the compiler reads the same metadata.
 */
export function plannedPublicationCatalog(
	plan: PublicationPlan,
): CompositionCatalog {
	if (
		plan.directionIds.length === 0 ||
		new Set(plan.directionIds).size !== plan.directionIds.length
	)
		throw new Error("公開予定の方向IDを重複なく指定してください。");
	if (new Set(plan.artworkIds).size !== plan.artworkIds.length)
		throw new Error("公開予定の素材IDが重複しています。");
	const plannedArtworkIds = new Set(plan.artworkIds);
	const selectedArtwork = selectPlannedArtwork(
		ARTWORK_MANIFEST,
		(artworkReviews as ArtworkReview[]).filter((record) =>
			plannedArtworkIds.has(record.id),
		),
	);
	if (selectedArtwork.issues.length > 0)
		throw new Error(
			`公開予定の素材記録が不整合です: ${selectedArtwork.issues.join("; ")}`,
		);
	if (selectedArtwork.selected.length !== plannedArtworkIds.size)
		throw new Error("公開予定の素材IDにreviewed/active記録がありません。");
	const artwork = selectedArtwork.selected.map((asset) => ({
		...asset,
		src: asset.sourcePath.replace(
			"../../assets/artwork/",
			"/src/assets/artwork/",
		),
	}));
	const directions = plan.directionIds.map(directionDefinitionById);
	for (const direction of directions) {
		if (!isDirectionArtworkReady(direction, artwork))
			throw new Error(
				`公開予定方向「${direction.id}」のreviewed素材が不足しています。`,
			);
	}
	return {
		artwork,
		directions,
		maxDirections: MAX_BOOKLET_DIRECTIONS,
		revision: CATALOG_REVISION,
	};
}
