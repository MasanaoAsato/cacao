import { describe, expect, it, vi } from "vitest";
import { ApiError, ApiResponseError, requestBlob } from "./client";

describe("requestBlob", () => {
	it("正常系: Content-Typeパラメータ付きのバイナリを受け付ける", async () => {
		const fetchImpl = vi.fn(async () =>
			Promise.resolve(
				new Response("binary", {
					headers: { "Content-Type": "application/pdf; charset=binary" },
					status: 200,
				}),
			),
		);

		const blob = await requestBlob("/booklet.pdf", {
			expectedContentType: "application/pdf",
			fetchImpl,
		});

		expect(await blob.text()).toBe("binary");
	});

	it("異常系: 通信失敗をApiErrorに変換する", async () => {
		const fetchImpl = vi.fn(async () => Promise.reject(new Error("offline")));

		await expect(
			requestBlob("/booklet.pdf", { fetchImpl }),
		).rejects.toBeInstanceOf(ApiError);
	});

	it("境界値系: 空のContent-Typeを拒否する", async () => {
		const fetchImpl = vi.fn(async () =>
			Promise.resolve(new Response("binary", { status: 200 })),
		);

		await expect(
			requestBlob("/booklet.pdf", {
				expectedContentType: "application/pdf",
				fetchImpl,
			}),
		).rejects.toBeInstanceOf(ApiResponseError);
	});
});
