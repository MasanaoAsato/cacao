import { type MotifAssetId, motifAssetsFor } from "../../../theme/motifAssets";
import { decodeImageAssets } from "./imageDecode";

/** Resolves only the legacy SVGs used by the rendered booklet. */
export async function waitForMotifAssets(
	assetIDs: readonly MotifAssetId[],
): Promise<void> {
	await decodeImageAssets(motifAssetsFor(assetIDs));
}
