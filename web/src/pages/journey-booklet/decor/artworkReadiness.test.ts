/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { waitForArtworkAssets } from "./artworkReadiness";

vi.mock("../../../theme/artwork/catalog", () => ({
	artworkById: (id: string) => {
		if (id === "draft") {
			throw new Error("Artwork is missing or not reviewed: draft");
		}
		return { id, src: `/assets/${id}.webp` };
	},
}));

class TestImage extends EventTarget {
	static sources: string[] = [];
	static failSource: string | null = null;
	#src = "";
	set src(value: string) {
		this.#src = value;
		TestImage.sources.push(value);
	}
	decode(): Promise<void> {
		return this.#src === TestImage.failSource
			? Promise.reject(new Error("404 or decode failure"))
			: Promise.resolve();
	}
}

describe("waitForArtworkAssets", () => {
	afterEach(() => {
		TestImage.sources = [];
		TestImage.failSource = null;
		vi.unstubAllGlobals();
	});

	it("正常系: 使用したIDのURLだけをdecodeする", async () => {
		vi.stubGlobal("Image", TestImage);
		await expect(waitForArtworkAssets(["used"])).resolves.toBeUndefined();
		expect(TestImage.sources).toEqual(["/assets/used.webp"]);
	});

	it("異常系: 使用画像のdecode失敗を全体エラーにする", async () => {
		vi.stubGlobal("Image", TestImage);
		TestImage.failSource = "/assets/used.webp";
		await expect(waitForArtworkAssets(["used"])).rejects.toThrow("used");
	});

	it("異常系: 未審査素材は読込み前に拒否する", async () => {
		vi.stubGlobal("Image", TestImage);
		await expect(waitForArtworkAssets(["draft"])).rejects.toThrow("draft");
		expect(TestImage.sources).toEqual([]);
	});

	it("境界値系: 同じURLを一回だけ読込み、未使用画像の失敗を無視する", async () => {
		vi.stubGlobal("Image", TestImage);
		TestImage.failSource = "/assets/unused.webp";
		await expect(
			waitForArtworkAssets(["used", "used"]),
		).resolves.toBeUndefined();
		expect(TestImage.sources).toEqual(["/assets/used.webp"]);
	});
});
