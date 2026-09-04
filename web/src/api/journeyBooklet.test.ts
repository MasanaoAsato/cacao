import { describe, expect, it, vi } from "vitest";
import { ApiError, ApiResponseError } from "./client";
import { downloadJourneyBookletPdf } from "./journeyBooklet";

describe("journey booklet API", () => {
	it("正常系: シード付きでPDFを取得する", async () => {
		const fetchImpl = vi.fn(async () =>
			Promise.resolve(
				new Response("%PDF-1.4\n", {
					headers: { "Content-Type": "application/pdf" },
					status: 200,
				}),
			),
		);

		const result = await downloadJourneyBookletPdf("journey/1", {
			fetchImpl,
			seed: "v1-abcdef12",
		});

		expect(await result.text()).toBe("%PDF-1.4\n");
		expect(fetchImpl).toHaveBeenCalledWith(
			"/api/v1/journeys/journey%2F1/booklet.pdf?seed=v1-abcdef12",
			expect.objectContaining({ method: "GET" }),
		);
	});

	it("異常系: PDF以外のContent-Typeを拒否する", async () => {
		const fetchImpl = vi.fn(async () =>
			Promise.resolve(
				new Response("{}", {
					headers: { "Content-Type": "application/json" },
					status: 200,
				}),
			),
		);

		await expect(
			downloadJourneyBookletPdf("journey-1", { fetchImpl }),
		).rejects.toBeInstanceOf(ApiResponseError);
	});

	it("境界値系: 503のHTTPエラーにステータスを保持する", async () => {
		const fetchImpl = vi.fn(async () =>
			Promise.resolve(new Response("", { status: 503 })),
		);

		try {
			await downloadJourneyBookletPdf("journey-1", { fetchImpl });
			throw new Error("downloadJourneyBookletPdf() unexpectedly succeeded");
		} catch (error) {
			expect(error).toBeInstanceOf(ApiError);
			expect((error as ApiError).status).toBe(503);
		}
	});
});
