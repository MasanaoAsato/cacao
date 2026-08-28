/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PrintCssSpikePage } from "./PrintCssSpikePage";

const originalDecode = HTMLImageElement.prototype.decode;
const originalFonts = Object.getOwnPropertyDescriptor(document, "fonts");
const originalPrint = Object.getOwnPropertyDescriptor(window, "print");
const originalClientHeight = Object.getOwnPropertyDescriptor(
	HTMLElement.prototype,
	"clientHeight",
);
const originalScrollHeight = Object.getOwnPropertyDescriptor(
	HTMLElement.prototype,
	"scrollHeight",
);
const originalClientWidth = Object.getOwnPropertyDescriptor(
	HTMLElement.prototype,
	"clientWidth",
);
const originalScrollWidth = Object.getOwnPropertyDescriptor(
	HTMLElement.prototype,
	"scrollWidth",
);

let decodeMock: ReturnType<typeof vi.fn>;
let fontCheckMock: ReturnType<typeof vi.fn>;
let printMock: ReturnType<typeof vi.fn>;

type PageMetric = {
	readonly axis: "height" | "width";
	readonly isOverflowing: boolean;
	readonly pageId: string;
};

function installPageMetrics(pageMetric?: PageMetric) {
	const isMeasuredPage = (element: HTMLElement, axis: PageMetric["axis"]) =>
		element.dataset.pageId === pageMetric?.pageId && pageMetric?.axis === axis;
	const measuredScrollSize = (axis: PageMetric["axis"]) =>
		pageMetric?.isOverflowing && pageMetric.axis === axis ? 201 : 200;
	Object.defineProperties(HTMLElement.prototype, {
		clientHeight: {
			configurable: true,
			get: function getClientHeight(this: HTMLElement) {
				return isMeasuredPage(this, "height") ? 200 : 0;
			},
		},
		clientWidth: {
			configurable: true,
			get: function getClientWidth(this: HTMLElement) {
				return isMeasuredPage(this, "width") ? 200 : 0;
			},
		},
		scrollHeight: {
			configurable: true,
			get: function getScrollHeight(this: HTMLElement) {
				return isMeasuredPage(this, "height")
					? measuredScrollSize("height")
					: 0;
			},
		},
		scrollWidth: {
			configurable: true,
			get: function getScrollWidth(this: HTMLElement) {
				return isMeasuredPage(this, "width") ? measuredScrollSize("width") : 0;
			},
		},
	});
}

function installBrowserMocks() {
	decodeMock = vi.fn().mockResolvedValue(undefined);
	fontCheckMock = vi.fn().mockReturnValue(true);
	printMock = vi.fn();
	Object.defineProperty(HTMLImageElement.prototype, "decode", {
		configurable: true,
		value: decodeMock,
	});
	Object.defineProperty(document, "fonts", {
		configurable: true,
		value: { check: fontCheckMock, ready: Promise.resolve() },
	});
	Object.defineProperty(window, "print", {
		configurable: true,
		value: printMock,
	});
	installPageMetrics();
}

function restoreBrowserMocks() {
	if (originalDecode) {
		Object.defineProperty(HTMLImageElement.prototype, "decode", {
			configurable: true,
			value: originalDecode,
		});
	} else {
		delete (HTMLImageElement.prototype as { decode?: unknown }).decode;
	}
	if (originalFonts) {
		Object.defineProperty(document, "fonts", originalFonts);
	} else {
		delete (document as { fonts?: unknown }).fonts;
	}
	if (originalPrint) {
		Object.defineProperty(window, "print", originalPrint);
	}
	for (const [property, descriptor] of [
		["clientHeight", originalClientHeight],
		["clientWidth", originalClientWidth],
		["scrollHeight", originalScrollHeight],
		["scrollWidth", originalScrollWidth],
	] as const) {
		if (descriptor) {
			Object.defineProperty(HTMLElement.prototype, property, descriptor);
		} else {
			Reflect.deleteProperty(HTMLElement.prototype, property);
		}
	}
}

describe("PrintCssSpikePage", () => {
	beforeEach(() => {
		installBrowserMocks();
	});

	afterEach(() => {
		cleanup();
		restoreBrowserMocks();
		vi.clearAllMocks();
	});

	it("正常系: 準備完了後に PDF 印刷を呼び出せる", async () => {
		render(<PrintCssSpikePage />);

		const printButton = screen.getByRole("button", { name: "PDF を印刷" });
		await waitFor(() => expect(printButton).toBeEnabled());
		fireEvent.click(printButton);

		expect(decodeMock).toHaveBeenCalledTimes(2);
		expect(fontCheckMock).toHaveBeenCalledTimes(2);
		expect(printMock).toHaveBeenCalledTimes(1);
	});

	it("異常系: 画像 decode に失敗した場合は印刷できない", async () => {
		decodeMock.mockRejectedValueOnce(new Error("decode failed"));
		render(<PrintCssSpikePage />);

		const printButton = screen.getByRole("button", { name: "PDF を印刷" });
		await waitFor(() =>
			expect(screen.getByRole("status")).toHaveTextContent("画像"),
		);

		expect(printButton).toBeDisabled();
		expect(printMock).not.toHaveBeenCalled();
	});

	it("異常系: Web フォントを確認できない場合は印刷できない", async () => {
		fontCheckMock.mockReturnValue(false);
		render(<PrintCssSpikePage />);

		const printButton = screen.getByRole("button", { name: "PDF を印刷" });
		await waitFor(() =>
			expect(screen.getByRole("status")).toHaveTextContent("Noto Serif JP"),
		);

		expect(printButton).toBeDisabled();
		expect(printMock).not.toHaveBeenCalled();
	});

	it("異常系: A5 ページから内容があふれる場合は印刷できない", async () => {
		installPageMetrics({
			axis: "height",
			isOverflowing: true,
			pageId: "day-02",
		});
		render(<PrintCssSpikePage />);

		const printButton = screen.getByRole("button", { name: "PDF を印刷" });
		await waitFor(() =>
			expect(screen.getByRole("status")).toHaveTextContent(
				"3 ページ目の内容が A5 ページに収まりません。",
			),
		);

		expect(printButton).toBeDisabled();
		expect(printMock).not.toHaveBeenCalled();
	});

	it("異常系: A5 ページの横幅から内容があふれる場合は印刷できない", async () => {
		installPageMetrics({
			axis: "width",
			isOverflowing: true,
			pageId: "day-02",
		});
		render(<PrintCssSpikePage />);

		const printButton = screen.getByRole("button", { name: "PDF を印刷" });
		await waitFor(() =>
			expect(screen.getByRole("status")).toHaveTextContent(
				"3 ページ目の内容が A5 ページに収まりません。",
			),
		);

		expect(printButton).toBeDisabled();
		expect(printMock).not.toHaveBeenCalled();
	});

	it("境界値系: 内容が A5 ページにちょうど収まる場合は印刷できる", async () => {
		installPageMetrics({
			axis: "height",
			isOverflowing: false,
			pageId: "day-02",
		});
		render(<PrintCssSpikePage />);

		const printButton = screen.getByRole("button", { name: "PDF を印刷" });
		await waitFor(() => expect(printButton).toBeEnabled());
		fireEvent.click(printButton);

		expect(printMock).toHaveBeenCalledTimes(1);
	});

	it("境界値系: 表紙込み 2 ページと 4 ページを切り替えられる", async () => {
		const { container } = render(<PrintCssSpikePage />);
		await waitFor(() =>
			expect(screen.getByRole("button", { name: "PDF を印刷" })).toBeEnabled(),
		);
		expect(container.querySelectorAll(".print-page")).toHaveLength(4);

		fireEvent.change(screen.getByLabelText("検証するページ数"), {
			target: { value: "short" },
		});

		expect(container.querySelectorAll(".print-page")).toHaveLength(2);
	});
});
