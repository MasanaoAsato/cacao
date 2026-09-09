import { createRoot } from "react-dom/client";
import { MotifShapes } from "../../src/pages/journey-booklet/decor/MotifShapes";
import { MOTIF_ASSETS } from "../../src/theme/motifAssets";

const root = document.querySelector("[data-decor-assets-root]");
if (!root) {
	throw new Error("装飾素材の検証領域がありません。");
}

function colorFor(asset: (typeof MOTIF_ASSETS)[number]): string | null {
	if (asset.recolor === "none") {
		return null;
	}
	return asset.styleId === "atlas-ink" ? "#19324d" : "#cf5b36";
}

function DecorAssetsFixture() {
	return (
		<svg
			aria-label="装飾素材のA5見本"
			data-decor-assets
			height="210mm"
			viewBox="0 0 148 210"
			width="148mm"
		>
			<rect fill="#fffdf8" height="210" width="148" />
			{MOTIF_ASSETS.flatMap((asset) =>
				[0, 1].map((repeat) => ({ asset, repeat })),
			).map(({ asset, repeat }, index) => {
				const column = index % 4;
				const row = Math.floor(index / 4);
				return (
					<g
						data-decor-asset={asset.id}
						key={`${asset.id}-${repeat}`}
						transform={`translate(${8 + column * 34} ${10 + row * 33}) scale(10)`}
					>
						<MotifShapes
							color={colorFor(asset)}
							definition={asset}
							maskId={`decor-assets-${asset.id}-${repeat}`}
						/>
					</g>
				);
			})}
		</svg>
	);
}

createRoot(root).render(<DecorAssetsFixture />);
