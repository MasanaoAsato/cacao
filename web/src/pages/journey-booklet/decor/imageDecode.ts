export type ImageToDecode = Readonly<{ id: string; src: string }>;

function decodeImage(asset: ImageToDecode): Promise<void> {
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

/** Only URLs in the rendered booklet are decoded; repeated instances share work. */
export async function decodeImageAssets(
	assets: readonly ImageToDecode[],
): Promise<void> {
	const byUrl = new Map<string, ImageToDecode>();
	for (const asset of assets) {
		byUrl.set(asset.src, asset);
	}
	await Promise.all(Array.from(byUrl.values(), decodeImage));
}
