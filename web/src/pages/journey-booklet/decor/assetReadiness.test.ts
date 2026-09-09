/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { MOTIF_ASSETS } from "../../../theme/motifAssets";
import { waitForMotifAssets } from "./assetReadiness";

class TestImage extends EventTarget {
	static created = 0;
	static outcome: "error" | "load" = "load";
	static decodeFailure = false;

	constructor() {
		super();
		TestImage.created += 1;
	}

	set src(_value: string) {
		queueMicrotask(() => this.dispatchEvent(new Event(TestImage.outcome)));
	}

	decode(): Promise<void> {
		return TestImage.decodeFailure
			? Promise.reject(new Error("decode failed"))
			: Promise.resolve();
	}
}

describe("waitForMotifAssets", () => {
	afterEach(() => {
		TestImage.created = 0;
		TestImage.decodeFailure = false;
		TestImage.outcome = "load";
		vi.unstubAllGlobals();
	});

	it("正常系: SVG URLをImage.decodeで確認する", async () => {
		vi.stubGlobal("Image", TestImage);
		await expect(
			waitForMotifAssets([MOTIF_ASSETS[0]!.id]),
		).resolves.toBeUndefined();
	});

	it("異常系: SVGの読込またはdecode失敗を素材ID付きで返す", async () => {
		vi.stubGlobal("Image", TestImage);
		TestImage.decodeFailure = true;
		await expect(waitForMotifAssets([MOTIF_ASSETS[0]!.id])).rejects.toThrow(
			"atlas-compass",
		);
	});

	it("境界値系: 重複した素材URLは一度だけ読込む", async () => {
		vi.stubGlobal("Image", TestImage);
		await waitForMotifAssets([MOTIF_ASSETS[0]!.id, MOTIF_ASSETS[0]!.id]);
		expect(TestImage.created).toBe(1);
	});

	it("境界値系: 素材がない入力は待機せず完了する", async () => {
		await expect(waitForMotifAssets([])).resolves.toBeUndefined();
	});
});
