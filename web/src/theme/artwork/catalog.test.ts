/// <reference types="node" />
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ARTWORK_MANIFEST } from "../../assets/artwork/manifest";
import { ARTWORK_ALIASES, ARTWORK_CATALOG, artworkById } from "./catalog";
import { validateArtworkCatalog } from "./validateCatalog";

const svgSources: Record<string, string> = import.meta.glob(
	"../../assets/artwork/*/*.svg",
	{ eager: true, import: "default", query: "?raw" },
);
const bundledUrls: Record<string, string> = import.meta.glob(
	"../../assets/artwork/*/*.{svg,webp}",
	{ eager: true, import: "default", query: "?url" },
);

function webpInfo(sourcePath: string): {
	width: number;
	height: number;
	hasAlpha: boolean;
} {
	const bytes = readFileSync(new URL(sourcePath, import.meta.url));
	if (
		bytes.toString("ascii", 0, 4) !== "RIFF" ||
		bytes.toString("ascii", 8, 12) !== "WEBP"
	) {
		throw new Error(`${sourcePath}: invalid WebP header`);
	}
	const chunk = bytes.toString("ascii", 12, 16);
	if (chunk === "VP8X") {
		return {
			width: 1 + bytes.readUIntLE(24, 3),
			height: 1 + bytes.readUIntLE(27, 3),
			hasAlpha: Boolean(bytes[20] & 0x10),
		};
	}
	if (chunk === "VP8 ") {
		return {
			width: bytes.readUInt16LE(26) & 0x3fff,
			height: bytes.readUInt16LE(28) & 0x3fff,
			hasAlpha: false,
		};
	}
	if (chunk === "VP8L" && bytes[20] === 0x2f) {
		return {
			width: 1 + ((bytes[21] ?? 0) | (((bytes[22] ?? 0) & 0x3f) << 8)),
			height:
				1 +
				(((bytes[22] ?? 0) >> 6) |
					((bytes[23] ?? 0) << 2) |
					(((bytes[24] ?? 0) & 0x0f) << 10)),
			hasAlpha: Boolean((bytes[24] ?? 0) & 0x10),
		};
	}
	throw new Error(`${sourcePath}: unsupported WebP chunk ${chunk}`);
}

describe("production artwork catalog", () => {
	it("正常系: draftを含む現行素材の原画とmanifestが一致する", () => {
		expect(
			validateArtworkCatalog(ARTWORK_MANIFEST, {
				aliases: ARTWORK_ALIASES,
				bundledUrls,
				svgSources,
			}),
		).toEqual([]);
	});
	it("正常系: draftの24題材×12タッチを構造上検証する", () => {
		const structurallyReviewed = ARTWORK_MANIFEST.map((item) => ({
			...item,
			reviewId: "structure-check-only",
		}));
		expect(
			validateArtworkCatalog(structurallyReviewed, { requireComplete: true }),
		).toEqual([]);
	});

	it("正常系: 12タッチ288原画の寸法・SVG安全条件を検証する", () => {
		expect(Object.keys(bundledUrls)).toHaveLength(288);
		expect(ARTWORK_MANIFEST).toHaveLength(288);
		expect(
			validateArtworkCatalog(ARTWORK_MANIFEST, {
				aliases: ARTWORK_ALIASES,
				bundledUrls,
				svgSources,
			}),
		).toEqual([]);
	});

	it("異常系: draft素材は審査ゲートで拒否する", () => {
		const unreviewed = ARTWORK_MANIFEST.filter(
			(item) => !item.reviewId?.trim(),
		);
		const activeIds = new Set(ARTWORK_CATALOG.map((item) => item.id));
		expect(unreviewed.every((item) => !activeIds.has(item.id))).toBe(true);
		const errors = validateArtworkCatalog(ARTWORK_MANIFEST, {
			requireReviewed: true,
		});
		expect(errors).toHaveLength(unreviewed.length);
		expect(
			errors.every((error) => error.endsWith("artwork is not reviewed")),
		).toBe(true);
	});

	it.runIf(process.env.ARTWORK_RELEASE_CHECK === "1")(
		"25.5最終条件: 288原画の審査が完了している",
		() => {
			expect(
				validateArtworkCatalog(ARTWORK_MANIFEST, {
					aliases: ARTWORK_ALIASES,
					bundledUrls,
					svgSources,
					requireReviewed: true,
					requireComplete: true,
				}),
			).toEqual([]);
		},
	);

	it("正常系: WebPの実ファイル寸法とalphaがmanifestに一致する", () => {
		for (const artwork of ARTWORK_MANIFEST.filter(
			(item) => item.format === "webp",
		)) {
			expect(webpInfo(artwork.sourcePath)).toEqual({
				width: artwork.width,
				height: artwork.height,
				hasAlpha: artwork.hasAlpha,
			});
		}
	});

	it("異常系: 未審査のIDはprogramへ凍結できない", () => {
		expect(() => artworkById("unreviewed-or-unknown")).toThrow(
			/missing or not reviewed/,
		);
	});
});
