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
	waitForFonts,
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

function candidate(
	coverLayoutId: BookletThemeCandidate["coverLayoutId"],
	fontPairId?: BookletThemeCandidate["fontPairId"],
	displayFontId?: BookletThemeCandidate["displayFontId"],
) {
	const requested = createBookletTheme({ value: 7, version: "v2" });
	const selected = getThemeCandidates(requested)[0];
	if (!selected) {
		throw new Error("テーマ候補がありません。");
	}
	return {
		...selected,
		coverLayoutId,
		...(fontPairId ? { fontPairId } : {}),
		...(displayFontId ? { displayFontId } : {}),
	};
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

describe("書体読み込み待ち", () => {
	it("正常系: 全書体対の全ファミリーを400・700で読み込む", async () => {
		const loads: string[] = [];
		const fontSet = {
			check: () => true,
			load: async (descriptor: string) => {
				loads.push(descriptor);
			},
			ready: Promise.resolve(),
		} as unknown as FontFaceSet;
		const originalFonts = Object.getOwnPropertyDescriptor(document, "fonts");
		Object.defineProperty(document, "fonts", {
			configurable: true,
			value: fontSet,
		});

		try {
			for (const fontPairId of [
				"classic",
				"literary",
				"wayfinding",
				"modern",
				"round-trip",
			] as const) {
				await waitForFonts(candidate("north-west", fontPairId));
			}
		} finally {
			if (originalFonts) {
				Object.defineProperty(document, "fonts", originalFonts);
			} else {
				delete (document as { fonts?: FontFaceSet }).fonts;
			}
		}

		expect(loads).toEqual([
			'400 10pt "Noto Serif JP"',
			'700 10pt "Noto Serif JP"',
			'400 10pt "Shippori Mincho"',
			'700 10pt "Shippori Mincho"',
			'400 10pt "Noto Sans JP"',
			'700 10pt "Noto Sans JP"',
			'400 10pt "Zen Kaku Gothic New"',
			'700 10pt "Zen Kaku Gothic New"',
			'400 10pt "Noto Sans JP"',
			'700 10pt "Noto Sans JP"',
			'400 10pt "Noto Sans JP"',
			'700 10pt "Noto Sans JP"',
			'400 10pt "M PLUS Rounded 1c"',
			'700 10pt "M PLUS Rounded 1c"',
			'400 10pt "Noto Sans JP"',
			'700 10pt "Noto Sans JP"',
		]);
	});

	it("異常系: 読み込み確認に失敗した書体を通知する", async () => {
		const fontSet = {
			check: () => false,
			load: async () => [],
			ready: Promise.resolve(),
		} as unknown as FontFaceSet;
		const originalFonts = Object.getOwnPropertyDescriptor(document, "fonts");
		Object.defineProperty(document, "fonts", {
			configurable: true,
			value: fontSet,
		});

		try {
			await expect(
				waitForFonts(candidate("north-west", "classic")),
			).rejects.toThrow("Noto Serif JP 400 の読み込みを確認できませんでした。");
		} finally {
			if (originalFonts) {
				Object.defineProperty(document, "fonts", originalFonts);
			} else {
				delete (document as { fonts?: FontFaceSet }).fonts;
			}
		}
	});

	it("正常系: 表示書体を定義されたウェイトで読み込む", async () => {
		const loads: string[] = [];
		const fontSet = {
			check: () => true,
			load: async (descriptor: string) => {
				loads.push(descriptor);
			},
			ready: Promise.resolve(),
		} as unknown as FontFaceSet;
		const originalFonts = Object.getOwnPropertyDescriptor(document, "fonts");
		Object.defineProperty(document, "fonts", {
			configurable: true,
			value: fontSet,
		});

		try {
			await waitForFonts(candidate("north-west", "classic", "dela-gothic-one"));
		} finally {
			if (originalFonts) {
				Object.defineProperty(document, "fonts", originalFonts);
			} else {
				delete (document as { fonts?: FontFaceSet }).fonts;
			}
		}

		expect(loads.at(-1)).toBe('400 10pt "Dela Gothic One", sans-serif');
	});

	it("正常系: 4表示書体をそれぞれの定義ウェイトで読み込む", async () => {
		const loads: string[] = [];
		const fontSet = {
			check: () => true,
			load: async (descriptor: string) => {
				loads.push(descriptor);
			},
			ready: Promise.resolve(),
		} as unknown as FontFaceSet;
		const originalFonts = Object.getOwnPropertyDescriptor(document, "fonts");
		Object.defineProperty(document, "fonts", {
			configurable: true,
			value: fontSet,
		});

		try {
			for (const displayFontId of [
				"dela-gothic-one",
				"zen-kurenaido",
				"kaisei-decol",
				"rocknroll-one",
			] as const) {
				await waitForFonts(candidate("north-west", "classic", displayFontId));
			}
		} finally {
			if (originalFonts) {
				Object.defineProperty(document, "fonts", originalFonts);
			} else {
				delete (document as { fonts?: FontFaceSet }).fonts;
			}
		}

		expect(loads).toEqual(
			expect.arrayContaining([
				'400 10pt "Dela Gothic One", sans-serif',
				'400 10pt "Zen Kurenaido", sans-serif',
				'700 10pt "Kaisei Decol", serif',
				'400 10pt "RocknRoll One", sans-serif',
			]),
		);
	});

	it("異常系: 表示書体の読み込み確認失敗を通知する", async () => {
		const fontSet = {
			check: (descriptor: string) => !descriptor.includes("Dela Gothic One"),
			load: async () => [],
			ready: Promise.resolve(),
		} as unknown as FontFaceSet;
		const originalFonts = Object.getOwnPropertyDescriptor(document, "fonts");
		Object.defineProperty(document, "fonts", {
			configurable: true,
			value: fontSet,
		});

		try {
			await expect(
				waitForFonts(candidate("north-west", "classic", "dela-gothic-one")),
			).rejects.toThrow("Dela Gothic One");
		} finally {
			if (originalFonts) {
				Object.defineProperty(document, "fonts", originalFonts);
			} else {
				delete (document as { fonts?: FontFaceSet }).fonts;
			}
		}
	});
});
