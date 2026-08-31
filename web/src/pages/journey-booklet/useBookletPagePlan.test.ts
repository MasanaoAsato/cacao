/** @vitest-environment jsdom */

import { describe, expect, it } from "vitest";
import {
	createBookletTheme,
	getThemeCandidates,
} from "../../theme/bookletTheme";
import type { BookletThemeCandidate } from "../../theme/types";
import {
	BookletLayoutError,
	measureCoverVeilBounds,
} from "./useBookletPagePlan";

function rect(
	left: number,
	top: number,
	width: number,
	height: number,
): DOMRect {
	return {
		bottom: top + height,
		height,
		left,
		right: left + width,
		top,
		width,
		x: left,
		y: top,
		toJSON: () => ({}),
	};
}

function candidate(coverLayoutId: BookletThemeCandidate["coverLayoutId"]) {
	const requested = createBookletTheme({ value: 7, version: "v1" });
	const selected = getThemeCandidates(requested)[0];
	if (!selected) {
		throw new Error("テーマ候補がありません。");
	}
	return { ...selected, coverLayoutId };
}

function measurementRoot(copyRect: DOMRect): HTMLDivElement {
	const root = document.createElement("div");
	const cover = document.createElement("div");
	cover.className = "booklet-cover-content";
	cover.getBoundingClientRect = () => rect(0, 0, 1480, 2100);
	const copy = document.createElement("div");
	copy.dataset.bookletCoverCopy = "true";
	copy.getBoundingClientRect = () => copyRect;
	Object.defineProperties(copy, {
		clientHeight: { configurable: true, value: copyRect.height },
		clientWidth: { configurable: true, value: copyRect.width },
		scrollHeight: { configurable: true, value: copyRect.height },
		scrollWidth: { configurable: true, value: copyRect.width },
	});
	cover.append(copy);
	root.append(cover);
	return root;
}

describe("表紙ベール位置の計測", () => {
	it("正常系: 文字の実寸を148×210の座標へ換算する", () => {
		expect(
			measureCoverVeilBounds(
				measurementRoot(rect(100, 200, 400, 300)),
				candidate("split-left"),
			),
		).toEqual({ height: 30, width: 40, x: 10, y: 20 });
	});

	it("異常系: 安全領域外の文字を拒否する", () => {
		expect(() =>
			measureCoverVeilBounds(
				measurementRoot(rect(0, 0, 400, 300)),
				candidate("center"),
			),
		).toThrow(BookletLayoutError);
	});

	it("境界値系: safe-coverの128×190mm境界内を受け付ける", () => {
		expect(
			measureCoverVeilBounds(
				measurementRoot(rect(100, 100, 1280, 1900)),
				candidate("safe-cover"),
			),
		).toEqual({ height: 190, width: 128, x: 10, y: 10 });
	});
});
