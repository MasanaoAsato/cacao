import { describe, expect, it } from "vitest";
import { eligibleArtwork, selectArtwork } from "./selectArtwork";
import type { ArtworkAsset } from "./types";

const artwork: ArtworkAsset = {
	id: "woodcut-mountain-hero",
	revision: 1,
	sourcePath: "../../assets/artwork/woodcut/mountain-hero.svg",
	src: "/assets/mountain.svg",
	format: "svg",
	width: 300,
	height: 200,
	aspect: 1.5,
	touchId: "woodcut",
	subjectId: "mountain",
	role: "hero",
	recolor: "mask",
	safeInset: { top: 0, right: 0, bottom: 0, left: 0 },
	minPrintWidthMm: 10,
	maxPrintWidthMm: 128,
	originalityGroupId: "woodcut-mountain",
	provenance: { creator: "test", method: "test", licenseEvidence: "test" },
	reviewId: "test-review",
};

const placement = {
	role: "hero" as const,
	placementWidthMm: 90,
	placementHeightMm: 60,
};

describe("selectArtwork", () => {
	it("正常系: contain後の幅を計算して候補を選ぶ", () => {
		expect(selectArtwork([artwork], placement, 0)).toMatchObject({
			artwork: { id: artwork.id },
			aspect: 1.5,
			printWidthMm: 90,
		});
	});

	it("異常系: 未審査、役割違い、最小幅未満は除外する", () => {
		expect(
			eligibleArtwork([{ ...artwork, reviewId: null }], placement),
		).toEqual([]);
		expect(
			eligibleArtwork([artwork], { ...placement, role: "medium" }),
		).toEqual([]);
		expect(
			eligibleArtwork([artwork], { ...placement, placementWidthMm: 9.99 }),
		).toEqual([]);
	});

	it("境界値系: 最小・最大幅ちょうどを許し、超過は除外する", () => {
		expect(
			eligibleArtwork([artwork], { ...placement, placementWidthMm: 10 }),
		).toHaveLength(1);
		expect(
			eligibleArtwork([artwork], {
				...placement,
				placementWidthMm: 128,
				placementHeightMm: 100,
			}),
		).toHaveLength(1);
		expect(
			eligibleArtwork([artwork], {
				...placement,
				placementWidthMm: 129,
				placementHeightMm: 100,
			}),
		).toHaveLength(0);
	});

	it("正常系: 季節viewの比率でcontainし、view未指定を除外する", () => {
		const pattern: ArtworkAsset = {
			...artwork,
			id: "woodcut-season-pattern",
			role: "season-pattern",
			width: 1000,
			height: 1000,
			aspect: 1,
			minPrintWidthMm: 8,
			maxPrintWidthMm: 40,
			views: [{ id: "spring", x: 0, y: 0, width: 500, height: 250 }],
		};
		expect(
			selectArtwork(
				[pattern],
				{
					role: "season-pattern",
					viewId: "spring",
					placementWidthMm: 40,
					placementHeightMm: 20,
				},
				0,
			),
		).toMatchObject({ aspect: 2, printWidthMm: 40, view: { id: "spring" } });
		expect(
			eligibleArtwork([pattern], {
				role: "season-pattern",
				placementWidthMm: 40,
				placementHeightMm: 20,
			}),
		).toEqual([]);
	});

	it("異常系: ランダム値は有限の[0,1)に限る", () => {
		expect(() => selectArtwork([artwork], placement, 1)).toThrow(RangeError);
		expect(() => selectArtwork([artwork], placement, Number.NaN)).toThrow(
			RangeError,
		);
	});
});
