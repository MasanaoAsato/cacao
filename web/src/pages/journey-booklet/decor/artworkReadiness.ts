import { artworkById } from "../../../theme/artwork/catalog";
import { decodeImageAssets } from "./imageDecode";

/** Waits for the frozen artwork IDs used by the booklet, including SVG masks. */
export async function waitForArtworkAssets(
	ids: readonly string[],
): Promise<void> {
	await decodeImageAssets(ids.map(artworkById));
}
