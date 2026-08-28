/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { JourneyBookletPage } from "./JourneyBookletPage";

const journeyPayload = {
	days: [
		{
			date: "2026-08-28T00:00:00+09:00",
			id: "day-1",
			legs: [
				{
					duration_minutes: 35,
					estimated_cost: { amount: 420, currency: "JPY" },
					from: { label: "東京駅" },
					id: "leg-1",
					mode: "train",
					to: { label: "浅草", spot_id: "spot-1" },
				},
			],
			spots: [
				{
					description: "川沿いを歩く。",
					estimated_cost: { amount: 1000, currency: "JPY" },
					id: "spot-1",
					name: "浅草",
					start_at: "2026-08-28T10:00:00+09:00",
				},
			],
		},
	],
	day_count: 1,
	id: "journey-1",
	request_id: "request-1",
};

const requestPayload = {
	budget: { amount: 80000, currency: "JPY" },
	departure: "東京",
	destination: "京都",
	id: "request-1",
	period: {
		end_date: "2026-08-30T00:00:00+09:00",
		start_date: "2026-08-28T00:00:00+09:00",
	},
};

const imagePayload = {
	images: [
		{
			attempt_count: 1,
			content_url: "/api/v1/journey-images/image-1/content",
			failure_code: null,
			height: 1200,
			id: "image-1",
			media_type: "image/png",
			slot: { ordinal: 1, purpose: "cover" },
			status: "ready",
			width: 800,
		},
	],
	journey_request_id: "request-1",
};

const originalDecode = HTMLImageElement.prototype.decode;
const originalFonts = Object.getOwnPropertyDescriptor(document, "fonts");
const originalPrint = Object.getOwnPropertyDescriptor(window, "print");
const originalClientHeight = Object.getOwnPropertyDescriptor(
	HTMLElement.prototype,
	"clientHeight",
);
const originalClientWidth = Object.getOwnPropertyDescriptor(
	HTMLElement.prototype,
	"clientWidth",
);
const originalScrollHeight = Object.getOwnPropertyDescriptor(
	HTMLElement.prototype,
	"scrollHeight",
);
const originalScrollWidth = Object.getOwnPropertyDescriptor(
	HTMLElement.prototype,
	"scrollWidth",
);
const originalOffsetHeight = Object.getOwnPropertyDescriptor(
	HTMLElement.prototype,
	"offsetHeight",
);
const originalGetBoundingClientRect =
	HTMLElement.prototype.getBoundingClientRect;

function renderPage() {
	return render(
		<MemoryRouter initialEntries={["/journeys/journey-1/booklet"]}>
			<Routes>
				<Route
					path="/journeys/:journeyId/booklet"
					element={<JourneyBookletPage />}
				/>
			</Routes>
		</MemoryRouter>,
	);
}

function installBrowserMocks() {
	Object.defineProperty(HTMLImageElement.prototype, "decode", {
		configurable: true,
		value: vi.fn().mockResolvedValue(undefined),
	});
	Object.defineProperty(document, "fonts", {
		configurable: true,
		value: {
			check: vi.fn().mockReturnValue(true),
			ready: Promise.resolve(),
		},
	});
	Object.defineProperty(window, "print", {
		configurable: true,
		value: vi.fn(),
	});
	Object.defineProperties(HTMLElement.prototype, {
		clientHeight: {
			configurable: true,
			get: () => 200,
		},
		clientWidth: {
			configurable: true,
			get: () => 200,
		},
		offsetHeight: {
			configurable: true,
			get: () => 20,
		},
		scrollHeight: {
			configurable: true,
			get: () => 100,
		},
		scrollWidth: {
			configurable: true,
			get: () => 200,
		},
	});
	Object.defineProperty(HTMLElement.prototype, "getBoundingClientRect", {
		configurable: true,
		value: () => ({ height: 20, width: 200 }) as DOMRect,
	});
}

function restoreBrowserMocks() {
	if (originalDecode) {
		Object.defineProperty(HTMLImageElement.prototype, "decode", {
			configurable: true,
			value: originalDecode,
		});
	} else {
		Reflect.deleteProperty(HTMLImageElement.prototype, "decode");
	}
	if (originalFonts) {
		Object.defineProperty(document, "fonts", originalFonts);
	} else {
		Reflect.deleteProperty(document, "fonts");
	}
	if (originalPrint) {
		Object.defineProperty(window, "print", originalPrint);
	}
	for (const [property, descriptor] of [
		["clientHeight", originalClientHeight],
		["clientWidth", originalClientWidth],
		["offsetHeight", originalOffsetHeight],
		["scrollHeight", originalScrollHeight],
		["scrollWidth", originalScrollWidth],
	] as const) {
		if (descriptor) {
			Object.defineProperty(HTMLElement.prototype, property, descriptor);
		} else {
			Reflect.deleteProperty(HTMLElement.prototype, property);
		}
	}
	Object.defineProperty(HTMLElement.prototype, "getBoundingClientRect", {
		configurable: true,
		value: originalGetBoundingClientRect,
	});
}

function installFetchMock(
	imageStatus: string = "ready",
	imageRequestId = "request-1",
) {
	const fetchMock = vi.fn(
		async (input: RequestInfo | URL, _init?: RequestInit) => {
			const path = String(input);
			if (path.includes("/journeys/")) {
				return new Response(JSON.stringify(journeyPayload), { status: 200 });
			}
			if (path.includes("/journey-requests/request-1/images")) {
				return new Response(
					JSON.stringify({
						...imagePayload,
						images: [{ ...imagePayload.images[0], status: imageStatus }],
						journey_request_id: imageRequestId,
					}),
					{ status: 200 },
				);
			}
			return new Response(JSON.stringify(requestPayload), { status: 200 });
		},
	);
	vi.stubGlobal("fetch", fetchMock);
	return fetchMock;
}

describe("JourneyBookletPage", () => {
	beforeEach(() => {
		installBrowserMocks();
	});

	afterEach(() => {
		cleanup();
		restoreBrowserMocks();
		vi.unstubAllGlobals();
		vi.clearAllMocks();
	});

	it("正常系: APIデータから表紙と本文を描画し印刷できる", async () => {
		const fetchMock = installFetchMock();
		renderPage();

		const printButton = screen.getByRole("button", { name: "PDFを印刷" });
		await waitFor(() => expect(printButton).toBeEnabled());

		expect(screen.getByRole("heading", { name: "京都" })).toBeInTheDocument();
		expect(screen.getByRole("heading", { name: "浅草" })).toBeInTheDocument();
		expect(document.querySelectorAll("[data-booklet-page]")).toHaveLength(2);

		printButton.click();
		expect(window.print).toHaveBeenCalledTimes(1);
		expect(fetchMock).toHaveBeenCalledTimes(3);
		expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/v1/journeys/journey-1");
	});

	it("異常系: 表紙画像が未準備なら印刷と生成要求を行わない", async () => {
		const fetchMock = installFetchMock("processing");
		renderPage();

		const printButton = screen.getByRole("button", { name: "PDFを印刷" });
		await waitFor(() =>
			expect(screen.getByRole("status")).toHaveTextContent("準備できていない"),
		);

		expect(printButton).toBeDisabled();
		expect(window.print).not.toHaveBeenCalled();
		expect(fetchMock).toHaveBeenCalledTimes(3);
		expect(
			fetchMock.mock.calls.every((call) => call[1]?.method === "GET"),
		).toBe(true);
	});

	it("異常系: 表紙画像一覧が別のリクエストなら印刷しない", async () => {
		installFetchMock("ready", "request-2");
		renderPage();

		const printButton = screen.getByRole("button", { name: "PDFを印刷" });
		await waitFor(() =>
			expect(screen.getByRole("status")).toHaveTextContent(
				"識別子が一致しません",
			),
		);

		expect(printButton).toBeDisabled();
		expect(window.print).not.toHaveBeenCalled();
	});

	it("異常系: 表紙画像のdecodeに失敗したら印刷しない", async () => {
		vi.mocked(HTMLImageElement.prototype.decode).mockRejectedValue(
			new Error("decode failed"),
		);
		installFetchMock();
		renderPage();

		const printButton = screen.getByRole("button", { name: "PDFを印刷" });
		await waitFor(() =>
			expect(screen.getByRole("status")).toHaveTextContent(
				"読み込みに失敗しました",
			),
		);

		expect(printButton).toBeDisabled();
		expect(window.print).not.toHaveBeenCalled();
	});
});
