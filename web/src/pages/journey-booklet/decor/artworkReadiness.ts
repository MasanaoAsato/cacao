import { artworkById } from "../../../theme/artwork/catalog";
import type { ArtworkAsset } from "../../../theme/artwork/types";
import { decodeImageAssets } from "./imageDecode";

/**
 * Waits for the frozen artwork IDs used by the booklet, including SVG masks.
 * A program passes the resolver of the catalog it was compiled with.
 */
export async function waitForArtworkAssets(
	ids: readonly string[],
	resolve: (id: string) => ArtworkAsset = artworkById,
): Promise<void> {
	await decodeImageAssets(ids.map(resolve));
}
