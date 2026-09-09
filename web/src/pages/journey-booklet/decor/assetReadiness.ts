import {
	type MotifAsset,
	type MotifAssetId,
	motifAssetsFor,
} from "../../../theme/motifAssets";

function loadAsset(asset: MotifAsset): Promise<void> {
	return new Promise((resolve, reject) => {
		const image = new Image();
		const fail = () =>
			reject(new Error(`装飾素材「${asset.id}」の読み込みに失敗しました。`));
		if (typeof image.decode === "function") {
			image.src = asset.src;
			image.decode().then(resolve, fail);
			return;
		}
		image.addEventListener("error", fail, { once: true });
		image.addEventListener("load", () => resolve(), { once: true });
		image.src = asset.src;
	});
}

/** Resolves bundled SVG URLs through the browser image decoder before printing. */
export async function waitForMotifAssets(
	assetIDs: readonly MotifAssetId[],
): Promise<void> {
	const assetsByURL = new Map<string, MotifAsset>();
	for (const asset of motifAssetsFor(assetIDs)) {
		assetsByURL.set(asset.src, asset);
	}
	await Promise.all(Array.from(assetsByURL.values(), loadAsset));
}
