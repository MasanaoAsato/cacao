import { describe, expect, it } from "vitest";
import { eligibleArtworkForSlot, selectArtworkForSlot } from "./selectArtwork";
import type { ArtworkAsset, ArtworkSlot } from "./types";

const mask: ArtworkAsset = {
	id: "woodcut-mountain-hero",
	revision: 1,
	sourcePath: "../../assets/artwork/woodcut/mountain-hero.svg",
	src: "/mountain.svg",
	format: "svg",
	width: 300,
	height: 200,
	aspect: 1.5,
	touchId: "woodcut",
	subjectId: "mountain",
	role: "hero",
	recolor: "mask",
	safeInset: { top: 0, right: 0, bottom: 0, left: 0 },
	minPrintWidthMm: 40,
	maxPrintWidthMm: 128,
	originalityGroupId: "woodcut-mountain",
	provenance: { creator: "test", method: "test", licenseEvidence: "test" },
	reviewId: "review-1",
};
const colored: ArtworkAsset = {
	...mask,
	id: "cut-paper-mountain-hero",
	sourcePath: "../../assets/artwork/cut-paper/mountain-hero.svg",
	src: "/cut-paper-mountain.svg",
	touchId: "cut-paper",
	recolor: "none",
	originalityGroupId: "cut-paper-mountain",
};
const slot: ArtworkSlot = {
	id: "cover-hero",
	role: "hero",
	aspect: 1.5,
	widthMm: 90,
	heightMm: 60,
	backgroundColor: "#fff9e8",
	allowMask: true,
	minClearanceMm: 5,
	required: true,
};

describe("artwork slot binding", () => {
	it("正常系: 余白を引いた領域にcontainし、複数タッチから選ぶ", () => {
		const candidates = eligibleArtworkForSlot([mask, colored], slot);
		expect(candidates).toHaveLength(2);
		expect(candidates[0]?.printWidthMm).toBe(75);
		expect(selectArtworkForSlot([mask, colored], slot, 0.75)?.artwork.id).toBe(
			colored.id,
		);
	});

	it("異常系: maskを許さないslotとタッチ候補集合を適用する", () => {
		expect(
			eligibleArtworkForSlot([mask, colored], { ...slot, allowMask: false }),
		).toHaveLength(1);
		expect(
			eligibleArtworkForSlot([mask, colored], {
				...slot,
				touchIds: ["woodcut"],
			}),
		).toHaveLength(1);
	});

	it("境界値系: 最小印刷幅、必須・任意slot、無効な寸法", () => {
		expect(
			eligibleArtworkForSlot([mask], {
				...slot,
				widthMm: 50,
				heightMm: 50 / 1.5,
				aspect: 1.5,
				minClearanceMm: 5,
			}),
		).toHaveLength(0);
		expect(
			eligibleArtworkForSlot([mask], {
				...slot,
				widthMm: 40,
				heightMm: 40 / 1.5,
				minClearanceMm: 0,
			}),
		).toHaveLength(1);
		expect(
			selectArtworkForSlot([], { ...slot, required: false }, 0),
		).toBeNull();
		expect(() => selectArtworkForSlot([], slot, 0)).toThrow(
			"No eligible artwork for required slot: cover-hero",
		);
		expect(() =>
			eligibleArtworkForSlot([mask], { ...slot, aspect: 1 }),
		).toThrow("Invalid artwork slot");
	});
});
