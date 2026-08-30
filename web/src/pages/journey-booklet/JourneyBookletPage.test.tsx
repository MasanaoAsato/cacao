/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
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
		expect(
			vi
				.mocked(document.fonts.load)
				.mock.calls.some(
					([, sampleText]) => sampleText === "東京の旅程・京都散策",
				),
		).toBe(true);
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
		renderPage("/journeys/journey-1/booklet?seed=v1-00000013");

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
		).toBe("v1-00000013:selected");
		expect(window.print).not.toHaveBeenCalled();
	});

	it("異常系: 選択フォントを確認できなければ候補を進めず印刷しない", async () => {
		vi.mocked(document.fonts.check).mockReturnValue(false);
		installFetchMock();
		renderPage("/journeys/journey-1/booklet?seed=v1-00000013");

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
		).toBe("v1-00000013:selected");
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
		renderPage("/journeys/journey-1/booklet?seed=v1-00000013");

		const printButton = screen.getByRole("button", { name: "PDFを印刷" });
		await waitFor(() =>
			expect(screen.getByRole("status")).toHaveTextContent(
				"ページ本文高さを計測できませんでした",
			),
		);
		expect(printButton).toBeDisabled();
		expect(
			document.querySelector<HTMLElement>(".booklet-measurement")?.dataset
				.bookletThemeKey,
		).toBe("v1-00000013:selected");
		expect(window.print).not.toHaveBeenCalled();
	});

	it("異常系: 文字を隠す表示設定があれば候補を進めず印刷しない", async () => {
		const style = document.createElement("style");
		style.textContent =
			"[data-booklet-text-role] { overflow: hidden !important; }";
		document.head.append(style);
		try {
			installFetchMock();
			renderPage("/journeys/journey-1/booklet?seed=v1-00000013");

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
			).toBe("v1-00000013:selected");
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
			renderPage("/journeys/journey-1/booklet?seed=v1-00000013");

			const printButton = screen.getByRole("button", { name: "PDFを印刷" });
			await waitFor(() =>
				expect(screen.getByRole("status")).toHaveTextContent(
					"印刷ページ数がページ計画と一致しません",
				),
			);
			expect(printButton).toBeDisabled();
			expect(
				document.querySelector<HTMLElement>(".booklet-measurement")?.dataset
					.bookletThemeKey,
			).toBe("v1-00000013:selected");
			expect(window.print).not.toHaveBeenCalled();
		} finally {
			Object.defineProperty(
				Element.prototype,
				"querySelectorAll",
				originalQuerySelectorAll,
			);
		}
	});

	it("異常系: すべての安全候補で表紙が収まらなければ印刷しない", async () => {
		installFetchMock();
		Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
			configurable: true,
			get: () => 300,
		});
		renderPage();

		const printButton = screen.getByRole("button", { name: "PDFを印刷" });
		await waitFor(() =>
			expect(screen.getByRole("status")).toHaveTextContent("表紙の縦幅"),
		);
		expect(printButton).toBeDisabled();
		printButton.click();
		expect(window.print).not.toHaveBeenCalled();
	});

	it("正常系: 表紙の収まり失敗は安全候補を順に試す", async () => {
		installFetchMock();
		let releaseFirstDecode!: () => void;
		const firstDecode = new Promise<void>((resolve) => {
			releaseFirstDecode = resolve;
		});
		vi.mocked(HTMLImageElement.prototype.decode).mockImplementationOnce(
			() => firstDecode,
		);
		Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
			configurable: true,
			get() {
				const element = this as HTMLElement;
				if (!element.matches("[data-booklet-cover-text]")) {
					return 100;
				}
				const key = element.closest<HTMLElement>(".booklet-measurement")
					?.dataset.bookletThemeKey;
				return key?.endsWith(":safe-geometry") ? 100 : 300;
			},
		});
		const themeKeys: string[] = [];
		const observer = new MutationObserver((records) => {
			const previousKeys: string[] = [];
			for (const record of records) {
				const target = record.target;
				if (
					target instanceof HTMLElement &&
					target.classList.contains("booklet-measurement")
				) {
					if (record.oldValue) {
						previousKeys.push(record.oldValue);
					}
				}
			}
			for (const key of previousKeys) {
				if (key.startsWith("v1-") && themeKeys.at(-1) !== key) {
					themeKeys.push(key);
				}
			}
			const target = document.querySelector<HTMLElement>(
				".booklet-measurement",
			);
			const key = target?.dataset.bookletThemeKey;
			if (key && themeKeys.at(-1) !== key) {
				themeKeys.push(key);
			}
		});
		observer.observe(document.body, {
			attributes: true,
			subtree: true,
			attributeFilter: ["data-booklet-theme-key"],
			attributeOldValue: true,
		});
		renderPage("/journeys/journey-1/booklet?seed=v1-00000013");

		const printButton = screen.getByRole("button", { name: "PDFを印刷" });
		await waitFor(() => expect(printButton).toBeDisabled());
		expect(
			document.querySelector<HTMLElement>(".booklet-measurement")?.dataset
				.bookletThemeKey,
		).toBe("v1-00000013:selected");
		releaseFirstDecode();
		await waitFor(() => expect(printButton).toBeEnabled());
		observer.disconnect();
		expect(themeKeys).toEqual([
			"v1-00000013:selected",
			"v1-00000013:balanced-density",
			"v1-00000013:compact-density",
			"v1-00000013:safe-geometry",
		]);
		expect(
			new Set(
				Array.from(
					document.querySelectorAll<HTMLElement>("[data-booklet-page]"),
				).map((page) => page.dataset.bookletThemeKey),
			),
		).toEqual(new Set(["v1-00000013:safe-geometry"]));
	});

	it("異常系: 不正なseedクエリは既定テーマへ戻しURLから除去する", async () => {
		installFetchMock();
		renderPage("/journeys/journey-1/booklet?seed=v2-00000000");

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
				"seed=v1-00000007",
			),
		);
		expect(randomValues).toHaveBeenCalled();
	});
});
