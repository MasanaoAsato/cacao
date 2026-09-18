/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { playfulRouteDecorVariantFor } from "../../../theme/families/playfulRoute";
import { motifAssetsFor } from "../../../theme/motifAssets";
import { waitForMotifAssets } from "./assetReadiness";

const atlasCompassID = "atlas-compass" as const;

class TestImage extends EventTarget {
	static created = 0;
	static outcome: "error" | "load" = "load";
	static decodeFailure = false;
	/** URLs whose decode fails. Vite inlines SVGs, so match the exact source. */
	static decodeFailureSrcs: ReadonlySet<string> = new Set();
	#src = "";

	constructor() {
		super();
		TestImage.created += 1;
	}

	set src(value: string) {
		this.#src = value;
		queueMicrotask(() => this.dispatchEvent(new Event(TestImage.outcome)));
	}

	decode(): Promise<void> {
		return TestImage.decodeFailure || TestImage.decodeFailureSrcs.has(this.#src)
			? Promise.reject(new Error("decode failed"))
			: Promise.resolve();
	}
}

describe("waitForMotifAssets", () => {
	afterEach(() => {
		TestImage.created = 0;
		TestImage.decodeFailure = false;
		TestImage.decodeFailureSrcs = new Set();
		TestImage.outcome = "load";
		vi.unstubAllGlobals();
	});

	it("正常系: SVG URLをImage.decodeで確認する", async () => {
		vi.stubGlobal("Image", TestImage);
		await expect(waitForMotifAssets([atlasCompassID])).resolves.toBeUndefined();
	});

	it("異常系: SVGの読込またはdecode失敗を素材ID付きで返す", async () => {
		vi.stubGlobal("Image", TestImage);
		TestImage.decodeFailure = true;
		await expect(waitForMotifAssets([atlasCompassID])).rejects.toThrow(
			"atlas-compass",
		);
	});

	it("境界値系: 重複した素材URLは一度だけ読込む", async () => {
		vi.stubGlobal("Image", TestImage);
		await waitForMotifAssets([atlasCompassID, atlasCompassID]);
		expect(TestImage.created).toBe(1);
	});

	it("境界値系: 素材がない入力は待機せず完了する", async () => {
		await expect(waitForMotifAssets([])).resolves.toBeUndefined();
	});

	it("境界値系: 渡していない素材のdecode失敗は待機結果に影響しない", async () => {
		vi.stubGlobal("Image", TestImage);
		TestImage.decodeFailureSrcs = new Set(
			motifAssetsFor(["playful-footprints"]).map((asset) => asset.src),
		);

		await expect(
			waitForMotifAssets(playfulRouteDecorVariantFor("sunny").decorAssetIds),
		).resolves.toBeUndefined();
		await expect(
			waitForMotifAssets(playfulRouteDecorVariantFor("walking").decorAssetIds),
		).rejects.toThrow("playful-footprints");
	});
});
