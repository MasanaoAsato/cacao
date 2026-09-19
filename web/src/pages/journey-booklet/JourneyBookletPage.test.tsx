/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBookletTheme } from "../../theme/bookletTheme";
import { resolveBookletDesign } from "../../theme/families/resolveBookletDesign";
import { type MotifAssetId, motifAssetsFor } from "../../theme/motifAssets";
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
			visual_style: "editorial-photograph",
			width: 800,
		},
		{
			attempt_count: 1,
			content_url: "/api/v1/journey-images/illustration-1/content",
			failure_code: null,
			height: 900,
			id: "illustration-1",
			media_type: "image/png",
			slot: { ordinal: 1, purpose: "illustration" },
			status: "ready",
			visual_style: null,
			width: 1200,
		},
	],
	journey_request_id: "request-1",
};

function resolvedDesignForSeed(value: number) {
	return resolveBookletDesign(createBookletTheme({ value, version: "v2" }));
}

function seedQuery(value: number): string {
	return `v2-${value.toString(16).padStart(8, "0")}`;
}

function seedFor(
	predicate: (design: ReturnType<typeof resolvedDesignForSeed>) => boolean,
): number {
	for (let value = 0; value <= 0xffff; value += 1) {
		if (predicate(resolvedDesignForSeed(value))) {
			return value;
		}
	}
	throw new Error("テスト条件を満たすテーマシードが見つかりません。");
}

const playfulRouteSeed2Design = resolvedDesignForSeed(2);
const playfulRouteSeed2RenderKey = playfulRouteSeed2Design.renderKey;

const originalDecode = HTMLImageElement.prototype.decode;
const originalFonts = Object.getOwnPropertyDescriptor(document, "fonts");
const originalPrint = Object.getOwnPropertyDescriptor(window, "print");
const originalCreateObjectURL = Object.getOwnPropertyDescriptor(
	URL,
	"createObjectURL",
);
const originalRevokeObjectURL = Object.getOwnPropertyDescriptor(
	URL,
	"revokeObjectURL",
);
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

function LocationProbe() {
	const location = useLocation();
	return <div data-testid="location-search">{location.search}</div>;
}

function renderPage(initialEntry = "/journeys/journey-1/booklet") {
	return render(
		<MemoryRouter initialEntries={[initialEntry]}>
			<Routes>
				<Route
					path="/journeys/:journeyId/booklet"
					element={
						<>
							<JourneyBookletPage />
							<LocationProbe />
						</>
					}
				/>
			</Routes>
		</MemoryRouter>,
	);
}

function domRect(
	left: number,
	top: number,
	width: number,
	height: number,
): DOMRect {
	return {
		bottom: top + height,
		height,
		left,
		right: left + width,
		top,
		width,
		x: left,
		y: top,
		toJSON: () => ({}),
	};
}

function coverSafeAreaFor(element: HTMLElement) {
	const theme = element.closest<HTMLElement>(".booklet-theme");
	if (theme?.classList.contains("booklet-theme--cover-north-west")) {
		return { height: 70, width: 80, x: 12, y: 12 };
	}
	if (theme?.classList.contains("booklet-theme--cover-north-east")) {
		return { height: 70, width: 80, x: 56, y: 12 };
	}
	if (theme?.classList.contains("booklet-theme--cover-south-west")) {
		return { height: 70, width: 80, x: 12, y: 128 };
	}
	if (theme?.classList.contains("booklet-theme--cover-south-east")) {
		return { height: 70, width: 80, x: 56, y: 128 };
	}
	if (theme?.classList.contains("booklet-theme--cover-split-left")) {
		return { height: 210, width: 70, x: 0, y: 0 };
	}
	if (theme?.classList.contains("booklet-theme--cover-horizon")) {
		return { height: 62, width: 148, x: 0, y: 148 };
	}
	if (theme?.classList.contains("booklet-theme--cover-safe-cover")) {
		return { height: 190, width: 128, x: 10, y: 10 };
	}
	return { height: 76, width: 104, x: 22, y: 67 };
}

function playfulRouteRect(element: HTMLElement): DOMRect | null {
	const page = element.closest<HTMLElement>("[data-booklet-page]");
	if (!page) {
		return null;
	}
	const scale = 560 / 148;
	const rectMm = (x: number, y: number, width: number, height: number) =>
		domRect(x * scale, y * scale, width * scale, height * scale);
	if (element === page) {
		return rectMm(0, 0, 148, 210);
	}
	const composition = page.dataset.bookletComposition;
	const anchorId = element.dataset.bookletAnchor;
	if (anchorId === "playful-cover-sun") {
		return composition === "zigzag"
			? rectMm(116, 10, 20, 20)
			: rectMm(18, 150, 24, 24);
	}
	if (anchorId === "playful-cover-bag") {
		return composition === "zigzag"
			? rectMm(10, 148, 18, 24)
			: rectMm(50, 154, 18, 24);
	}
	if (anchorId === "playful-cover-burst") {
		return composition === "zigzag"
			? rectMm(10, 68, 24, 12)
			: rectMm(10, 70, 24, 12);
	}
	if (anchorId === "playful-day-squiggle") {
		return rectMm(62, 194, 24, 8);
	}
	if (element.classList.contains("playful-route-block")) {
		const heightMm = Number.parseFloat(element.style.height) || 26.5;
		const wide =
			composition === "ribbon" ||
			element.closest(".playful-route-blocks--wide-ribbon") !== null;
		const right =
			!wide && element.classList.contains("playful-route-block--right");
		const compact = element.closest(".playful-route-blocks--selected") === null;
		return rectMm(
			right ? 34 : 10,
			compact ? 34 : 52,
			wide ? 128 : 104,
			heightMm,
		);
	}
	const role = element.dataset.bookletTextRole;
	if (!role) {
		return null;
	}
	if (page.classList.contains("playful-route-page--cover")) {
		return role === "cover-period"
			? rectMm(10, 180, 100, 12)
			: rectMm(15, 15, 85, 35);
	}
	if (role === "day-label" || role === "day-date") {
		return rectMm(10, 10, 88, 30);
	}
	return rectMm(32, 56, 70, 18);
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
			load: vi.fn().mockResolvedValue([]),
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
		value: function getBoundingClientRectMock(this: HTMLElement) {
			const playfulRect = playfulRouteRect(this);
			if (playfulRect) {
				return playfulRect;
			}
			if (this.classList.contains("booklet-cover-content")) {
				return domRect(0, 0, 560, 794);
			}
			if (this.classList.contains("booklet-cover__text")) {
				const safeArea = coverSafeAreaFor(this);
				const scaleX = 560 / 148;
				const scaleY = 794 / 210;
				return domRect(
					safeArea.x * scaleX,
					safeArea.y * scaleY,
					Math.min(58, safeArea.width) * scaleX,
					Math.min(38, safeArea.height) * scaleY,
				);
			}
			if (this.hasAttribute("data-booklet-cover-copy")) {
				const safeArea = coverSafeAreaFor(this);
				const scaleX = 560 / 148;
				const scaleY = 794 / 210;
				return domRect(
					(safeArea.x + 4) * scaleX,
					(safeArea.y + 4) * scaleY,
					Math.min(50, safeArea.width - 8) * scaleX,
					Math.min(30, safeArea.height - 8) * scaleY,
				);
			}
			return domRect(0, 0, 200, 20);
		},
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
	if (originalCreateObjectURL) {
		Object.defineProperty(URL, "createObjectURL", originalCreateObjectURL);
	} else {
		Reflect.deleteProperty(URL, "createObjectURL");
	}
	if (originalRevokeObjectURL) {
		Object.defineProperty(URL, "revokeObjectURL", originalRevokeObjectURL);
	} else {
		Reflect.deleteProperty(URL, "revokeObjectURL");
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

/**
 * Fails decode for the named decor artwork only. Vite inlines the SVGs, so the
 * registered `src` is the only reliable way to recognise one asset.
 */
function installMotifDecodeFailure(assetIds: readonly MotifAssetId[]): void {
	const failing = new Set(
		motifAssetsFor(assetIds).map((asset) => asset.src as string),
	);
	vi.mocked(HTMLImageElement.prototype.decode)
		.mockReset()
		.mockImplementation(function decodeMotifAsset(this: HTMLImageElement) {
			return failing.has(this.getAttribute("src") ?? "")
				? Promise.reject(new Error("motif decode failed"))
				: Promise.resolve();
		});
}

function installFetchMock(
	imageStatus: string = "ready",
	imageRequestId = "request-1",
	illustrationStatus: string = "ready",
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
						images: [
							{ ...imagePayload.images[0], status: imageStatus },
							{ ...imagePayload.images[1], status: illustrationStatus },
						],
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
		vi.restoreAllMocks();
	});

	it("正常系: APIデータから表紙と本文を描画し印刷できる", async () => {
		const fetchMock = installFetchMock();
		renderPage();

		const printButton = screen.getByRole("button", { name: "PDFを印刷" });
		await waitFor(() => expect(printButton).toBeEnabled());

		expect(screen.getByRole("status")).toHaveTextContent(
			/^しおりの印刷準備ができました。$/,
		);
		expect(screen.getByRole("status")).not.toHaveTextContent("v2-");
		expect(screen.getByRole("link", { name: "ホームに戻る" })).toHaveAttribute(
			"href",
			"/",
		);
		expect(screen.getByRole("heading", { name: "京都" })).toBeInTheDocument();
		expect(screen.getByRole("heading", { name: "浅草" })).toBeInTheDocument();
		expect(document.querySelectorAll("[data-booklet-page]")).toHaveLength(2);
		expect(document.querySelector(".booklet-shell")).toHaveAttribute(
			"data-booklet-family",
			"playful-route",
		);
		expect(document.querySelector(".booklet-document")).toHaveAttribute(
			"data-booklet-family",
			"playful-route",
		);

		printButton.click();
		expect(window.print).toHaveBeenCalledTimes(1);
		expect(fetchMock).toHaveBeenCalledTimes(3);
		expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/v1/journeys/journey-1");
		expect(
			vi
				.mocked(document.fonts.load)
				.mock.calls.some(
					([, sampleText]) => sampleText === "東京の旅程・京都散策",
				),
		).toBe(true);
	});

	it("状態: データ読込中はレンダラーにloadingを通知する", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(() => new Promise<Response>(() => {})),
		);

		renderPage();

		await waitFor(() =>
			expect(document.querySelector(".booklet-shell")).toHaveAttribute(
				"data-booklet-print-state",
				"loading",
			),
		);
		expect(
			screen.getByRole("button", { name: "PDFをダウンロード" }),
		).toBeDisabled();
	});

	it("状態: ページ計測中はレンダラーにpreparingを通知する", async () => {
		const imageDecodePending = new Promise<void>(() => {});
		vi.mocked(HTMLImageElement.prototype.decode).mockReturnValue(
			imageDecodePending,
		);
		installFetchMock();

		renderPage();

		await waitFor(() =>
			expect(document.querySelector(".booklet-shell")).toHaveAttribute(
				"data-booklet-print-state",
				"preparing",
			),
		);
		expect(
			screen.getByRole("button", { name: "PDFをダウンロード" }),
		).toBeDisabled();
	});

	it("正常系: 準備完了したしおりをPDFとしてダウンロードできる", async () => {
		const fetchMock = installFetchMock();
		const createObjectURL = vi.fn(() => "blob:journey-booklet");
		const revokeObjectURL = vi.fn();
		Object.defineProperty(URL, "createObjectURL", {
			configurable: true,
			value: createObjectURL,
		});
		Object.defineProperty(URL, "revokeObjectURL", {
			configurable: true,
			value: revokeObjectURL,
		});
		let clickedFileName = "";
		vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
			function mockAnchorClick(this: HTMLAnchorElement) {
				clickedFileName = this.download;
			},
		);

		renderPage();

		const downloadButton = screen.getByRole("button", {
			name: "PDFをダウンロード",
		});
		await waitFor(() => expect(downloadButton).toBeEnabled());
		expect(document.querySelector(".booklet-shell")).toHaveAttribute(
			"data-booklet-print-state",
			"ready",
		);
		fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
			if (String(input).includes("/booklet.pdf")) {
				return new Response("%PDF-1.4\n", {
					headers: { "Content-Type": "application/pdf" },
					status: 200,
				});
			}
			throw new Error("unexpected request");
		});

		downloadButton.click();

		await waitFor(() => expect(createObjectURL).toHaveBeenCalledTimes(1));
		const bookletPath = fetchMock.mock.calls
			.map(([input]) => String(input))
			.find((path) => path.includes("/booklet.pdf"));
		expect(bookletPath).toMatch(
			/^\/api\/v1\/journeys\/journey-1\/booklet\.pdf\?seed=v2-[0-9a-f]{8}$/,
		);
		expect(clickedFileName).toBe("旅のしおり-京都-2026-08-28.pdf");
		expect(revokeObjectURL).toHaveBeenCalledWith("blob:journey-booklet");
	});

	it("状態: PDF作成中は両方の操作を無効にして進行中を表示する", async () => {
		const fetchMock = installFetchMock();
		renderPage();

		const downloadButton = screen.getByRole("button", {
			name: "PDFをダウンロード",
		});
		await waitFor(() => expect(downloadButton).toBeEnabled());
		fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
			if (String(input).includes("/booklet.pdf")) {
				return new Promise<Response>(() => {});
			}
			throw new Error("unexpected request");
		});

		downloadButton.click();

		await waitFor(() =>
			expect(screen.getByRole("status")).toHaveTextContent(
				"PDFを作成しています…",
			),
		);
		expect(downloadButton).toBeDisabled();
		expect(screen.getByRole("button", { name: "PDFを印刷" })).toBeDisabled();
	});

	it("異常系: 混雑時はPDFを再試行できる状態で案内する", async () => {
		const fetchMock = installFetchMock();
		renderPage();

		const downloadButton = screen.getByRole("button", {
			name: "PDFをダウンロード",
		});
		await waitFor(() => expect(downloadButton).toBeEnabled());
		fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
			if (String(input).includes("/booklet.pdf")) {
				return new Response("", { status: 503 });
			}
			throw new Error("unexpected request");
		});

		downloadButton.click();

		await waitFor(() =>
			expect(screen.getByRole("status")).toHaveTextContent(
				"混み合っています。数秒後にもう一度お試しください。",
			),
		);
		expect(downloadButton).toBeEnabled();
		expect(screen.getByRole("button", { name: "PDFを印刷" })).toBeEnabled();
	});

	it("異常系: 表紙画像が未準備ならPDFを再試行できる状態で案内する", async () => {
		const fetchMock = installFetchMock();
		renderPage();

		const downloadButton = screen.getByRole("button", {
			name: "PDFをダウンロード",
		});
		await waitFor(() => expect(downloadButton).toBeEnabled());
		fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
			if (String(input).includes("/booklet.pdf")) {
				return new Response("", { status: 409 });
			}
			throw new Error("unexpected request");
		});

		downloadButton.click();

		await waitFor(() =>
			expect(screen.getByRole("status")).toHaveTextContent(
				"表紙または挿絵がまだ準備できていません。",
			),
		);
		expect(downloadButton).toBeEnabled();
		expect(screen.getByRole("button", { name: "PDFを印刷" })).toBeEnabled();
	});

	it("異常系: PDF生成に失敗したら印刷で保存する代替手段を案内する", async () => {
		const fetchMock = installFetchMock();
		renderPage();

		const downloadButton = screen.getByRole("button", {
			name: "PDFをダウンロード",
		});
		await waitFor(() => expect(downloadButton).toBeEnabled());
		fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
			if (String(input).includes("/booklet.pdf")) {
				return new Response("", { status: 500 });
			}
			throw new Error("unexpected request");
		});

		downloadButton.click();

		await waitFor(() =>
			expect(screen.getByRole("status")).toHaveTextContent(
				"PDFを作成できませんでした。「PDFを印刷」からも保存できます。",
			),
		);
		expect(screen.getByRole("status")).not.toHaveTextContent(
			"しおりの印刷準備ができました。",
		);
		expect(downloadButton).toBeEnabled();
		expect(screen.getByRole("button", { name: "PDFを印刷" })).toBeEnabled();
	});

	it("異常系: 表紙画像が未準備なら印刷と生成要求を行わない", async () => {
		const fetchMock = installFetchMock("processing");
		renderPage();

		const printButton = screen.getByRole("button", { name: "PDFを印刷" });
		await waitFor(() =>
			expect(screen.getByRole("status")).toHaveTextContent("準備できていない"),
		);

		expect(printButton).toBeDisabled();
		expect(document.querySelector(".booklet-shell")).toHaveAttribute(
			"data-booklet-print-state",
			"error",
		);
		expect(document.querySelector(".booklet-shell")).toHaveAttribute(
			"data-booklet-print-error",
			"表紙画像が準備できていないため、印刷できません。",
		);
		expect(window.print).not.toHaveBeenCalled();
		expect(fetchMock).toHaveBeenCalledTimes(3);
		expect(
			fetchMock.mock.calls.every((call) => call[1]?.method === "GET"),
		).toBe(true);
	});

	it("異常系: 挿絵が未準備なら印刷を無効にする", async () => {
		installFetchMock("ready", "request-1", "processing");
		renderPage();

		const printButton = screen.getByRole("button", { name: "PDFを印刷" });
		await waitFor(() =>
			expect(screen.getByRole("status")).toHaveTextContent(
				"挿絵がまだ準備できていない",
			),
		);

		expect(printButton).toBeDisabled();
		expect(document.querySelector(".booklet-shell")).toHaveAttribute(
			"data-booklet-print-state",
			"error",
		);
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
		renderPage("/journeys/journey-1/booklet?seed=v2-00000002");

		const printButton = screen.getByRole("button", { name: "PDFを印刷" });
		await waitFor(() =>
			expect(screen.getByRole("status")).toHaveTextContent(
				"読み込みに失敗しました",
			),
		);

		expect(printButton).toBeDisabled();
		expect(
			document.querySelector<HTMLElement>(".booklet-measurement")?.dataset
				.bookletThemeKey,
		).toBe(playfulRouteSeed2RenderKey);
		expect(window.print).not.toHaveBeenCalled();
	});

	it("異常系: 選んだパターンの装飾素材のdecodeに失敗したら印刷しない", async () => {
		const selectedAssetId = playfulRouteSeed2Design.decorAssetIds[0];
		if (!selectedAssetId) {
			throw new Error("選択済みデザインに装飾素材がありません。");
		}
		installMotifDecodeFailure([selectedAssetId]);
		installFetchMock();
		renderPage("/journeys/journey-1/booklet?seed=v2-00000002");

		const printButton = screen.getByRole("button", { name: "PDFを印刷" });
		await waitFor(() =>
			expect(screen.getByRole("status")).toHaveTextContent(
				`装飾素材「${selectedAssetId}」の読み込みに失敗しました`,
			),
		);
		expect(printButton).toBeDisabled();
		expect(window.print).not.toHaveBeenCalled();
	});

	it("境界値: 選んでいない装飾素材のdecode失敗に影響されない", async () => {
		const unselectedAssetIds = [
			"playful-bag",
			"playful-burst",
			"playful-curved-arrow",
			"playful-footprints",
			"playful-squiggle",
			"playful-sun",
		].filter(
			(assetId): assetId is MotifAssetId =>
				!playfulRouteSeed2Design.decorAssetIds.includes(
					assetId as MotifAssetId,
				),
		);
		if (unselectedAssetIds.length === 0) {
			throw new Error("選んでいない装飾素材がありません。");
		}
		installMotifDecodeFailure(unselectedAssetIds);
		installFetchMock();
		renderPage("/journeys/journey-1/booklet?seed=v2-00000002");

		await waitFor(() =>
			expect(screen.getByRole("button", { name: "PDFを印刷" })).toBeEnabled(),
		);
		expect(document.querySelector(".booklet-document")).toHaveAttribute(
			"data-booklet-decor-variant",
			playfulRouteSeed2Design.decorVariantId,
		);
		expect(document.querySelector(".booklet-shell")).toHaveAttribute(
			"data-booklet-comparison-key",
			playfulRouteSeed2Design.comparisonKey,
		);
	});

	it("境界値: シード切替後に旧パターンの素材読込が完了しても新しいreadyを維持する", async () => {
		const initialSeed = seedFor(
			(design) =>
				design.familyId === "playful-route" && design.decorAssetIds.length > 0,
		);
		const initialDesign = resolvedDesignForSeed(initialSeed);
		const initialAssetId = initialDesign.decorAssetIds[0];
		if (!initialAssetId) {
			throw new Error("初期デザインに装飾素材がありません。");
		}
		const nextSeed = seedFor(
			(design) =>
				design.familyId === "playful-route" &&
				design.comparisonKey !== initialDesign.comparisonKey &&
				!design.decorAssetIds.includes(initialAssetId),
		);
		const nextDesign = resolvedDesignForSeed(nextSeed);
		const initialAssetSrc = motifAssetsFor([initialAssetId])[0]?.src;
		if (!initialAssetSrc) {
			throw new Error("初期デザインの装飾素材が登録されていません。");
		}
		let resolveInitialAsset: (() => void) | undefined;
		const initialAssetDecode = new Promise<void>((resolve) => {
			resolveInitialAsset = resolve;
		});
		let initialAssetStarted = false;
		vi.mocked(HTMLImageElement.prototype.decode).mockImplementation(
			function decode(this: HTMLImageElement) {
				if (this.getAttribute("src") === initialAssetSrc) {
					initialAssetStarted = true;
					return initialAssetDecode;
				}
				return Promise.resolve();
			},
		);
		vi.spyOn(crypto, "getRandomValues").mockImplementation((values) => {
			if (values instanceof Uint32Array) {
				values[0] = nextSeed;
			}
			return values;
		});
		installFetchMock();
		renderPage(`/journeys/journey-1/booklet?seed=${seedQuery(initialSeed)}`);

		await waitFor(() => expect(initialAssetStarted).toBe(true));
		screen.getByRole("button", { name: "別のデザインを試す" }).click();
		await waitFor(() =>
			expect(screen.getByTestId("location-search")).toHaveTextContent(
				`seed=${seedQuery(nextSeed)}`,
			),
		);
		await waitFor(() =>
			expect(screen.getByRole("button", { name: "PDFを印刷" })).toBeEnabled(),
		);
		expect(document.querySelector(".booklet-document")).toHaveAttribute(
			"data-booklet-decor-variant",
			nextDesign.decorVariantId,
		);

		if (!resolveInitialAsset) {
			throw new Error("初期デザインの装飾素材のdecodeが開始されていません。");
		}
		resolveInitialAsset();
		await Promise.resolve();

		await waitFor(() =>
			expect(document.querySelector(".booklet-shell")).toHaveAttribute(
				"data-booklet-print-state",
				"ready",
			),
		);
		expect(document.querySelector(".booklet-document")).toHaveAttribute(
			"data-booklet-decor-variant",
			nextDesign.decorVariantId,
		);
	});

	it("異常系: 出力側の日別画像のdecodeに失敗したら印刷しない", async () => {
		vi.mocked(HTMLImageElement.prototype.decode)
			.mockReset()
			.mockImplementation(function decodeOutputImage(this: HTMLImageElement) {
				return this.closest(
					".booklet-document .playful-route-day-header__image",
				)
					? Promise.reject(new Error("day image decode failed"))
					: Promise.resolve();
			});
		installFetchMock();
		renderPage("/journeys/journey-1/booklet?seed=v2-00000002");

		const printButton = screen.getByRole("button", { name: "PDFを印刷" });
		await waitFor(() =>
			expect(screen.getByRole("status")).toHaveTextContent(
				"画像「京都の旅のイメージ」の読み込みに失敗しました",
			),
		);
		expect(printButton).toBeDisabled();
		expect(window.print).not.toHaveBeenCalled();
	});

	it("境界値: 単体が先頭本文だけを超える場合はcompact-headerの退避理由を記録する", async () => {
		Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
			configurable: true,
			get() {
				const element = this as HTMLElement;
				if (element.hasAttribute("data-playful-route-first-body")) {
					return 530;
				}
				if (element.hasAttribute("data-playful-route-continuation-body")) {
					return 598;
				}
				if (element.dataset.playfulRouteBlock?.startsWith("selected-")) {
					return 534;
				}
				return 100;
			},
		});
		installFetchMock();
		renderPage("/journeys/journey-1/booklet?seed=v2-00000002");

		await waitFor(() =>
			expect(screen.getByRole("button", { name: "PDFを印刷" })).toBeEnabled(),
		);
		const shell = document.querySelector(".booklet-shell");
		expect(shell).toHaveAttribute(
			"data-booklet-resolved-composition",
			"compact-header",
		);
		expect(shell?.getAttribute("data-booklet-fallback-log")).toContain(
			"selected:unit-overflow",
		);
	});

	it("異常系: 選択フォントを確認できなければ候補を進めず印刷しない", async () => {
		vi.mocked(document.fonts.check).mockReturnValue(false);
		installFetchMock();
		renderPage("/journeys/journey-1/booklet?seed=v2-00000002");

		const printButton = screen.getByRole("button", { name: "PDFを印刷" });
		await waitFor(() =>
			expect(screen.getByRole("status")).toHaveTextContent(
				"読み込みを確認できませんでした",
			),
		);
		expect(printButton).toBeDisabled();
		expect(
			document.querySelector<HTMLElement>(".booklet-measurement")?.dataset
				.bookletThemeKey,
		).toBe(playfulRouteSeed2RenderKey);
		expect(window.print).not.toHaveBeenCalled();
	});

	it("異常系: 計測DOMの寸法が不正なら候補を進めず印刷しない", async () => {
		Object.defineProperties(HTMLElement.prototype, {
			clientHeight: { configurable: true, get: () => 0 },
			clientWidth: { configurable: true, get: () => 0 },
			offsetHeight: { configurable: true, get: () => 0 },
			scrollHeight: { configurable: true, get: () => 0 },
			scrollWidth: { configurable: true, get: () => 0 },
		});
		Object.defineProperty(HTMLElement.prototype, "getBoundingClientRect", {
			configurable: true,
			value: () =>
				({
					bottom: 0,
					height: 0,
					left: 0,
					right: 0,
					top: 0,
					width: 0,
				}) as DOMRect,
		});
		installFetchMock();
		renderPage("/journeys/journey-1/booklet?seed=v2-00000002");

		const printButton = screen.getByRole("button", { name: "PDFを印刷" });
		await waitFor(() =>
			expect(screen.getByRole("status")).toHaveTextContent(
				"計測用紙面の幅を計測できません",
			),
		);
		expect(printButton).toBeDisabled();
		expect(
			document.querySelector<HTMLElement>(".booklet-measurement")?.dataset
				.bookletThemeKey,
		).toBe(playfulRouteSeed2RenderKey);
		expect(window.print).not.toHaveBeenCalled();
	});

	it("異常系: 装飾anchorが紙面外なら印刷しない", async () => {
		Object.defineProperty(HTMLElement.prototype, "getBoundingClientRect", {
			configurable: true,
			value: function outsidePage(this: HTMLElement) {
				if (this.dataset.bookletAnchor === "playful-cover-sun") {
					return domRect(600, 0, 80, 80);
				}
				const playfulRect = playfulRouteRect(this);
				if (playfulRect) return playfulRect;
				return domRect(0, 0, 200, 20);
			},
		});
		installFetchMock();
		renderPage("/journeys/journey-1/booklet?seed=v2-00000002");

		const printButton = screen.getByRole("button", { name: "PDFを印刷" });
		await waitFor(() =>
			expect(screen.getByRole("status")).toHaveTextContent(
				"装飾「playful-sun」を基準「playful-cover-sun」に配置できませんでした",
			),
		);
		expect(printButton).toBeDisabled();
		expect(window.print).not.toHaveBeenCalled();
	});

	it("異常系: 文字を隠す表示設定があれば候補を進めず印刷しない", async () => {
		const style = document.createElement("style");
		style.textContent =
			"[data-booklet-text-role] { overflow: hidden !important; }";
		document.head.append(style);
		try {
			installFetchMock();
			renderPage("/journeys/journey-1/booklet?seed=v2-00000002");

			const printButton = screen.getByRole("button", { name: "PDFを印刷" });
			await waitFor(() =>
				expect(screen.getByRole("status")).toHaveTextContent(
					"文字を隠す表示設定を検出しました",
				),
			);
			expect(printButton).toBeDisabled();
			expect(
				document.querySelector<HTMLElement>(".booklet-measurement")?.dataset
					.bookletThemeKey,
			).toBe(playfulRouteSeed2RenderKey);
			expect(window.print).not.toHaveBeenCalled();
		} finally {
			style.remove();
		}
	});

	it("異常系: 実ページ数が計画と一致しなければ候補を進めず印刷しない", async () => {
		const originalQuerySelectorAll = Object.getOwnPropertyDescriptor(
			Element.prototype,
			"querySelectorAll",
		);
		if (!originalQuerySelectorAll) {
			throw new Error("querySelectorAllの記述子がありません。");
		}
		Object.defineProperty(Element.prototype, "querySelectorAll", {
			configurable: true,
			value: function <E extends Element = Element>(
				this: HTMLElement,
				selectors: string,
			): NodeListOf<E> {
				if (
					selectors === "[data-booklet-page]" &&
					this.classList.contains("booklet-document")
				) {
					return document
						.createDocumentFragment()
						.querySelectorAll<E>(selectors);
				}
				return originalQuerySelectorAll.value.call(
					this,
					selectors,
				) as NodeListOf<E>;
			},
		});
		try {
			installFetchMock();
			renderPage("/journeys/journey-1/booklet?seed=v2-00000002");

			const printButton = screen.getByRole("button", { name: "PDFを印刷" });
			await waitFor(() =>
				expect(screen.getByRole("status")).toHaveTextContent(
					"playful-routeのページ数がページ計画と一致しません",
				),
			);
			expect(printButton).toBeDisabled();
			expect(
				document.querySelector<HTMLElement>(".booklet-measurement")?.dataset
					.bookletThemeKey,
			).toBe(playfulRouteSeed2RenderKey);
			expect(window.print).not.toHaveBeenCalled();
		} finally {
			Object.defineProperty(
				Element.prototype,
				"querySelectorAll",
				originalQuerySelectorAll,
			);
		}
	});

	it("異常系: 22ptでも表紙都市名が収まらなければ印刷しない", async () => {
		installFetchMock();
		Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
			configurable: true,
			get: () => 300,
		});
		renderPage();

		const printButton = screen.getByRole("button", { name: "PDFを印刷" });
		await waitFor(() =>
			expect(screen.getByRole("status")).toHaveTextContent(
				"表紙の都市名が22ptでも予約領域に収まりません",
			),
		);
		expect(printButton).toBeDisabled();
		printButton.click();
		expect(window.print).not.toHaveBeenCalled();
	});

	it("異常系: 不正なseedクエリは既定テーマへ戻しURLから除去する", async () => {
		installFetchMock();
		renderPage("/journeys/journey-1/booklet?seed=v1-00000000");

		await waitFor(() =>
			expect(screen.getByTestId("location-search").textContent).toBe(""),
		);
		await waitFor(() =>
			expect(screen.getByRole("button", { name: "PDFを印刷" })).toBeEnabled(),
		);
	});

	it("正常系: 再抽選は異なるレシピのseedをURL履歴へ追加する", async () => {
		const randomValues = vi
			.spyOn(crypto, "getRandomValues")
			.mockImplementation((values) => {
				if (values instanceof Uint32Array) {
					values[0] = 7;
				}
				return values;
			});
		installFetchMock();
		renderPage();

		await waitFor(() =>
			expect(screen.getByRole("button", { name: "PDFを印刷" })).toBeEnabled(),
		);
		screen.getByRole("button", { name: "別のデザインを試す" }).click();
		await waitFor(() =>
			expect(screen.getByTestId("location-search")).toHaveTextContent(
				"seed=v2-00000007",
			),
		);
		expect(randomValues).toHaveBeenCalled();
	});
});
