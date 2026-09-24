import { describe, expect, it } from "vitest";
import { MOTIF_ASSETS } from "./motifAssets";

/** The source SVG is the authority for `aspect`, so read the real files. */
const SVG_SOURCES: Record<string, string> = import.meta.glob(
	"../assets/motifs/*/*.svg",
	{ eager: true, import: "default", query: "?raw" },
);

function readAssetSource(src: string): string {
	const fileName = src.split("/").pop() ?? "";
	const entry = Object.entries(SVG_SOURCES).find(([path]) =>
		path.endsWith(`/${fileName}`),
	);
	if (!entry) {
		throw new Error(`素材ファイル「${fileName}」を読み込めません。`);
	}
	return entry[1];
}

function viewBoxOf(source: string): readonly number[] {
	const match = /viewBox="([^"]+)"/.exec(source);
	if (!match?.[1]) {
		throw new Error("viewBoxがありません。");
	}
	return match[1].split(/\s+/).map(Number);
}

describe("MOTIF_ASSETS", () => {
	it("正常系: 3画風13素材のVite URL、ID、比率を登録する", () => {
		expect(MOTIF_ASSETS).toHaveLength(13);
		expect(new Set(MOTIF_ASSETS.map((asset) => asset.styleId))).toEqual(
			new Set(["atlas-ink", "paper-cut", "playful-doodle"]),
		);
		expect(new Set(MOTIF_ASSETS.map((asset) => asset.id)).size).toBe(13);
		for (const asset of MOTIF_ASSETS) {
			expect(asset.src).toMatch(/^(data:image\/svg\+xml|file:)/);
			expect(asset.recolor).toBe(
				asset.id === "paper-torn-sheet" || asset.id === "paper-tape"
					? "none"
					: "mask",
			);
		}
	});

	it("正常系: 登録したaspectが実ファイルのviewBoxと一致する", () => {
		expect(Object.keys(SVG_SOURCES)).toHaveLength(MOTIF_ASSETS.length);
		for (const asset of MOTIF_ASSETS) {
			const source = readAssetSource(asset.src);
			const [minimumX, minimumY, width, height] = viewBoxOf(source);
			expect([minimumX, minimumY]).toEqual([0, 0]);
			expect(asset.aspect).toBeCloseTo((width ?? 0) / (height ?? 1), 6);
			expect(source).not.toMatch(/<(text|tspan|script|use|foreignObject)\b/);
			expect(source).not.toMatch(/xlink:href|href="(?!#)/);
		}
	});

	it("正常系: 20.11で追加した2素材をplayful-doodleとして登録する", () => {
		expect(
			MOTIF_ASSETS.filter(
				(asset) =>
					asset.id === "playful-footprints" ||
					asset.id === "playful-curved-arrow",
			),
		).toEqual([
			expect.objectContaining({
				aspect: 3 / 4,
				id: "playful-footprints",
				recolor: "mask",
				styleId: "playful-doodle",
			}),
			expect.objectContaining({
				aspect: 3,
				id: "playful-curved-arrow",
				recolor: "mask",
				styleId: "playful-doodle",
			}),
		]);
	});

	it("境界値系: 縦長素材も正の比率で登録する", () => {
		expect(
			MOTIF_ASSETS.find((asset) => asset.id === "atlas-perforation")?.aspect,
		).toBe(1 / 4);
		expect(
			MOTIF_ASSETS.find((asset) => asset.id === "paper-leaf")?.aspect,
		).toBe(1 / 2);
		expect(
			MOTIF_ASSETS.find((asset) => asset.id === "playful-footprints")?.aspect,
		).toBe(3 / 4);
	});
});
