import { describe, expect, it } from "vitest";
import type { ArtworkDefinition } from "./types";
import { validateArtworkCatalog } from "./validateCatalog";

const hero: ArtworkDefinition = {
	id: "woodcut-mountain-hero",
	revision: 1,
	sourcePath: "../../assets/artwork/woodcut/mountain-hero.svg",
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
	provenance: {
		creator: "test artist",
		method: "original vector drawing",
		licenseEvidence: "test fixture",
	},
	reviewId: "test-review",
};

const source = '<svg viewBox="0 0 300 200"><path d="M0 0"/></svg>';
const options = {
	requireReviewed: true,
	bundledUrls: { [hero.sourcePath]: "/assets/mountain.svg" },
	svgSources: { [hero.sourcePath]: source },
};

describe("validateArtworkCatalog", () => {
	it("正常系: 審査済みのSVGと同梱URLを受け入れる", () => {
		expect(validateArtworkCatalog([hero], options)).toEqual([]);
	});

	it("異常系: 重複、循環alias、参照漏れ、審査漏れを検出する", () => {
		const errors = validateArtworkCatalog([hero, { ...hero, reviewId: null }], {
			...options,
			aliases: [
				{ id: "old-a", targetId: "old-b" },
				{ id: "old-b", targetId: "old-a" },
				{ id: "missing", targetId: "unknown" },
			],
		});
		expect(errors.join("\n")).toMatch(
			/duplicate|not reviewed|alias cycle|target is missing/,
		);
	});

	it("異常系: 文字や外部参照を含むSVGと寸法違いを拒否する", () => {
		const errors = validateArtworkCatalog([hero], {
			...options,
			svgSources: {
				[hero.sourcePath]:
					'<svg viewBox="0 0 400 200"><text>bad</text><image href="https://example.com/a"/></svg>',
			},
		});
		expect(errors.join("\n")).toMatch(/forbidden SVG/);
		expect(errors.join("\n")).toMatch(/viewBox\/dimensions mismatch/);
	});

	it("異常系: 同じ原画ファイルを別IDとして水増しできない", () => {
		const duplicate = {
			...hero,
			id: "woodcut-mountain-hero-r2",
			originalityGroupId: "another-group",
		};
		expect(validateArtworkCatalog([hero, duplicate]).join("\n")).toMatch(
			/duplicate sourcePath/,
		);
	});

	it("異常系: 題材と役割に一致しないファイル名を拒否する", () => {
		const wrongPath = "../../assets/artwork/woodcut/sea-hero.svg";
		expect(
			validateArtworkCatalog([{ ...hero, sourcePath: wrongPath }]).join("\n"),
		).toMatch(/sourcePath must name a bundled artwork file/);
	});

	it("異常系: mask素材の白い不透明背景を拒否する", () => {
		const errors = validateArtworkCatalog([hero], {
			...options,
			svgSources: {
				[hero.sourcePath]:
					'<svg viewBox="0 0 300 200"><rect width="300" height="200" fill="white"/></svg>',
			},
		});
		expect(errors.join("\n")).toMatch(/opaque white paint/);
	});

	it("正常系: 内部maskの白い彫り線は許可する", () => {
		const errors = validateArtworkCatalog([hero], {
			...options,
			svgSources: {
				[hero.sourcePath]:
					'<svg viewBox="0 0 300 200"><defs><mask id="carve"><path fill="white" d="M0 0"/></mask></defs><path fill="black" mask="url(#carve)" d="M0 0"/></svg>',
			},
		});
		expect(errors).toEqual([]);
	});

	it("境界値系: WebPとviewは最大使用幅の300dpiを満たす", () => {
		const webp: ArtworkDefinition = {
			...hero,
			id: "chalk-mountain-hero",
			sourcePath: "../../assets/artwork/chalk/mountain-hero.webp",
			format: "webp",
			touchId: "chalk",
			recolor: "none",
			width: 1512,
			height: 1008,
			hasAlpha: true,
			originalityGroupId: "chalk-mountain",
		};
		expect(validateArtworkCatalog([webp])).toEqual([]);
		expect(
			validateArtworkCatalog([{ ...webp, width: 1511 }]).join("\n"),
		).toMatch(/less than 300 dpi/);
		const withView = {
			...webp,
			width: 3024,
			height: 2016,
			views: [{ id: "crop", x: 0, y: 0, width: 1511, height: 1008 }],
		};
		expect(validateArtworkCatalog([withView]).join("\n")).toMatch(
			/view crop has less than 300 dpi/,
		);
	});

	it("境界値系: 印刷最小幅は正値で最大幅以下", () => {
		expect(validateArtworkCatalog([{ ...hero, minPrintWidthMm: 128 }])).toEqual(
			[],
		);
		expect(
			validateArtworkCatalog([{ ...hero, minPrintWidthMm: 0 }]).join("\n"),
		).toMatch(/invalid print width range/);
	});
});
