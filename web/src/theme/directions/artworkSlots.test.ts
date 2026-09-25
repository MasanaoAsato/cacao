import { describe, expect, it } from "vitest";
import { bindingCandidates } from "../composition/baseline";
import { REVIEWED_TEST_ARTWORK } from "../composition/compositionTestKit";
import type { DraftBinding } from "../composition/types";
import { directionArtworkSlot } from "./artworkSlots";

describe("directionArtworkSlot", () => {
	it("正常系: 既存familyにも表紙と日別の主役素材枠を置く", () => {
		const cover = directionArtworkSlot(
			"editorial-magazine",
			"cover",
			"travel-magazine",
			"feature-photo",
		);
		const day = directionArtworkSlot(
			"editorial-magazine",
			"day",
			"travel-magazine",
			"feature-photo",
		);
		expect(cover?.slot).toMatchObject({
			baselineRole: "hero",
			slotId: "direction-cover-art",
		});
		expect(day?.slot).toMatchObject({
			baselineRole: "medium",
			slotId: "direction-day-art",
		});
	});

	it("異常系: module自身が主役絵枠を持つ場合は重ねて配置しない", () => {
		expect(
			directionArtworkSlot("woodcut-folio", "cover", "season", "folio"),
		).toBeNull();
		expect(
			directionArtworkSlot("quest-board", "day", "stamp", "panels"),
		).toBeNull();
	});

	it("境界値系: SNS投稿のキャプションを避けた18mm枠でも素材が印刷可能", () => {
		const placement = directionArtworkSlot(
			"paper-collage",
			"day",
			"social",
			"photo-left",
		);
		expect(placement?.region.heightMm).toBe(18);
		if (!placement) throw new Error("social artwork slot missing");
		const binding: DraftBinding = {
			directionId: "social",
			heightMm: placement.slot.heightMm,
			required: true,
			role: "medium",
			slotId: placement.slot.slotId,
			subjectIds: [
				"train",
				"airplane",
				"car",
				"bag",
				"tableware",
				"leaf",
				"flower",
				"shell",
			],
			touchId: "screenprint",
			viewId: null,
			widthMm: placement.slot.widthMm,
		};
		expect(
			bindingCandidates(REVIEWED_TEST_ARTWORK, binding, "#ffffff").length,
		).toBeGreaterThan(0);
	});
});
