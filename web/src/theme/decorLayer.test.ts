import { describe, expect, it } from "vitest";
import { createBookletTheme, getThemeCandidates } from "./bookletTheme";
import { getDecorLayer, seedTokenOf } from "./decorLayer";

function candidate(seed: number) {
	const requested = createBookletTheme({ value: seed, version: "v2" });
	const selected = getThemeCandidates(requested)[0];
	if (!selected) {
		throw new Error("テーマ候補がありません。");
	}
	return selected;
}

describe("装飾層", () => {
	it("正常系: テーマから装飾セット・内側余白・図形配置を組む", () => {
		const layer = getDecorLayer({
			...candidate(7),
			compositionId: "side-band",
			decorId: "ticket-notches",
		});
		expect(layer.decor.id).toBe("ticket-notches");
		expect(layer.contentInset).toEqual({
			bottom: 0,
			left: 0,
			right: 26,
			top: 0,
		});
		expect(layer.motifs).toHaveLength(28);
		expect(layer.panel).toBeNull();
		expect(layer.motifs.every((motif) => motif.definition.id === "notch")).toBe(
			true,
		);
	});

	it("正常系: シードの部分は解決済みテーマキーの先頭で、退避段階に依存しない", () => {
		expect(seedTokenOf("v2-0000000a:single-column")).toBe("v2-0000000a");
		expect(seedTokenOf("v2-0000000a")).toBe("v2-0000000a");
		const selected = candidate(10);
		const fallen = {
			...selected,
			resolvedThemeKey: `${selected.resolvedThemeKey}-x`,
		};
		expect(getDecorLayer(selected).motifs.map((motif) => motif.xMm)).toEqual(
			getDecorLayer({
				...fallen,
				resolvedThemeKey: "v2-0000000a:safe-geometry",
			}).motifs.map((motif) => motif.xMm),
		);
	});

	it("境界値系: 図形もパネルも持たない装飾は空の層になる", () => {
		const layer = getDecorLayer({ ...candidate(7), decorId: "none" });
		expect(layer.motifs).toEqual([]);
		expect(layer.panel).toBeNull();
		expect(layer.decor.ground).toEqual({ kind: "plain" });
	});
});
