import { describe, expect, it } from "vitest";
import { MOTIF_ASSETS } from "./motifAssets";

describe("MOTIF_ASSETS", () => {
	it("正常系: 3画風11素材のVite URL、ID、比率を登録する", () => {
		expect(MOTIF_ASSETS).toHaveLength(11);
		expect(new Set(MOTIF_ASSETS.map((asset) => asset.styleId))).toEqual(
			new Set(["atlas-ink", "paper-cut", "playful-doodle"]),
		);
		for (const asset of MOTIF_ASSETS) {
			expect(asset.src).toMatch(/^(data:image\/svg\+xml|file:)/);
			expect(asset.coverage).toBe(1);
			expect(asset.recolor).toBe(
				asset.id === "paper-torn-sheet" || asset.id === "paper-tape"
					? "none"
					: "mask",
			);
		}
	});

	it("境界値系: 縦長素材も正の比率で登録する", () => {
		expect(
			MOTIF_ASSETS.find((asset) => asset.id === "atlas-perforation")?.aspect,
		).toBe(1 / 4);
		expect(
			MOTIF_ASSETS.find((asset) => asset.id === "paper-leaf")?.aspect,
		).toBe(1 / 2);
	});
});
