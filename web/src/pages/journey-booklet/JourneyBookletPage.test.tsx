/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { selectCoverImage, selectIllustrations } from "../../api/journeyImages";
import { createBookletModel } from "../../booklet/fromJourney";
import type { BookletProgram } from "../../booklet/program/model";
import { programComparisonKey } from "../../booklet/program/programKeys";
import { compileBooklet } from "../../theme/composition/compileBooklet";
import { createDefaultThemeSeed } from "../../theme/seed";
import { JourneyBookletPage } from "./JourneyBookletPage";

// Exercise the page against an explicit test catalog while production reviews are empty.
vi.mock("../../theme/composition/compileBooklet", async (importOriginal) => {
	const real =
		await importOriginal<
			typeof import("../../theme/composition/compileBooklet")
		>();
	const { testCatalog } = await import(
		"../../theme/composition/compositionTestKit"
	);
	const catalog = testCatalog(["minimal", "photo-book", "practical"]);
	return {
		...real,
		compileBooklet: (...args: Parameters<typeof real.compileBooklet>) =>
			real.compileBooklet(args[0], args[1], args[2] ?? catalog, args[3]),
	};
});

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

/** The same model the page builds from the mocked API. */
const model = createBookletModel({
	coverImage: selectCoverImage(
		imagePayload.images as unknown as Parameters<typeof selectCoverImage>[0],
	),
	illustrationImages: selectIllustrations(
		imagePayload.images as unknown as Parameters<typeof selectIllustrations>[0],
	),
	journey: journeyPayload as unknown as Parameters<
		typeof createBookletModel
	>[0]["journey"],
	request: requestPayload as unknown as Parameters<
		typeof createBookletModel
	>[0]["request"],
});

/**
 * Modules whose layout the jsdom mock below can stand in for: their regions
 * are mm-positioned and every unit wraps at the full 128mm body width.
 */
const MOCKED_MODULES = new Set([
	"woodcut-folio",
	"photo-essay",
	"vertical-poster",
	"ledger",
	"schematic-map",
]);

function programFor(value: number): BookletProgram | null {
	const result = compileBooklet(model, { seed: { value, version: "v2" } });
	return result.status === "compiled" ? result.program : null;
}

function drawable(program: BookletProgram | null): program is BookletProgram {
	return (
		program?.scenes.every((scene) => MOCKED_MODULES.has(scene.moduleId)) ??
		false
	);
}

function seedFor(predicate: (program: BookletProgram) => boolean): number {
	for (let value = 0; value <= 0xffff; value += 1) {
		const program = programFor(value);
		if (drawable(program) && predicate(program)) return value;
	}
	throw new Error("テスト条件を満たすseedが見つかりません。");
}

function seedQuery(value: number): string {
	return `v2-${value.toString(16).padStart(8, "0")}`;
}

const firstSeed = seedFor(() => true);
const firstProgram = programFor(firstSeed);
const otherSeed = seedFor(
	(program) =>
		firstProgram !== null &&
		programComparisonKey(program) !== programComparisonKey(firstProgram),
);
const defaultJourneyId = (() => {
	for (let index = 0; index < 5000; index += 1) {
		const journeyId = `journey-${index}`;
		if (drawable(programFor(createDefaultThemeSeed(journeyId).value)))
			return journeyId;
	}
	throw new Error("既定seedで描けるjourney IDが見つかりません。");
})();

function LocationProbe() {
	const location = useLocation();
	return <div data-testid="location-search">{location.search}</div>;
}

function renderPage(
	initialEntry = `/journeys/journey-1/booklet?seed=${seedQuery(firstSeed)}`,
) {
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

const PX_PER_MM = 560 / 148;

function domRect(left: number, top: number, width: number, height: number) {
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
	} as DOMRect;
}

function mm(value: string): number | null {
	return value.endsWith("mm") ? Number.parseFloat(value) : null;
}

/**
 * A stand-in for layout: pages are 148×210mm, mm-positioned regions sit where
 * their inline style says, units are 10mm rows at the body's full width, and
 * any other element fills its region.
 */
function layoutRect(element: HTMLElement): DOMRect {
	const page = element.closest<HTMLElement>("[data-program-page]");
	if (!page) return domRect(0, 0, 0, 0);
	if (element === page) return domRect(0, 0, 148 * PX_PER_MM, 210 * PX_PER_MM);
	const left = mm(element.style.left);
	const top = mm(element.style.top);
	const width = mm(element.style.width);
	const height = mm(element.style.height);
	const parent = element.parentElement?.closest<HTMLElement>(
		".program-region, [data-program-page]",
	);
	if (left !== null && top !== null && width !== null && height !== null) {
		const base = parent ? layoutRect(parent) : domRect(0, 0, 0, 0);
		return domRect(
			base.left + left * PX_PER_MM,
			base.top + top * PX_PER_MM,
			width * PX_PER_MM,
			height * PX_PER_MM,
		);
	}
	const region = parent ? layoutRect(parent) : domRect(0, 0, 0, 0);
	if (
		element.classList.contains("program-unit") ||
		element.classList.contains("program-memo-entry")
	)
		return domRect(region.left, region.top, region.width, 10 * PX_PER_MM);
	return region;
}

const originals = {
	decode: Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "decode"),
	fonts: Object.getOwnPropertyDescriptor(document, "fonts"),
	print: Object.getOwnPropertyDescriptor(window, "print"),
	rect: Object.getOwnPropertyDescriptor(
		HTMLElement.prototype,
		"getBoundingClientRect",
	),
	sizes: (
		[
			"clientHeight",
			"clientWidth",
			"offsetHeight",
			"scrollHeight",
			"scrollWidth",
		] as const
	).map(
		(name) =>
			[
				name,
				Object.getOwnPropertyDescriptor(HTMLElement.prototype, name),
			] as const,
	),
};

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
	Object.defineProperty(HTMLElement.prototype, "getBoundingClientRect", {
		configurable: true,
		value(this: HTMLElement) {
			return layoutRect(this);
		},
	});
	const sized = (read: (rect: DOMRect) => number) => ({
		configurable: true,
		get(this: HTMLElement) {
			return read(layoutRect(this));
		},
	});
	Object.defineProperties(HTMLElement.prototype, {
		clientHeight: sized((rect) => rect.height),
		clientWidth: sized((rect) => rect.width),
		offsetHeight: sized((rect) => rect.height),
		scrollHeight: sized((rect) => rect.height),
		scrollWidth: sized((rect) => rect.width),
	});
}

function restore(
	target: object,
	name: string,
	descriptor: PropertyDescriptor | undefined,
) {
	if (descriptor) Object.defineProperty(target, name, descriptor);
	else Reflect.deleteProperty(target, name);
}

function restoreBrowserMocks() {
	restore(HTMLImageElement.prototype, "decode", originals.decode);
	restore(document, "fonts", originals.fonts);
	restore(window, "print", originals.print);
	restore(HTMLElement.prototype, "getBoundingClientRect", originals.rect);
	for (const [name, descriptor] of originals.sizes)
		restore(HTMLElement.prototype, name, descriptor);
}

function installFetchMock(
	imageStatus = "ready",
	imageRequestId = "request-1",
	illustrationStatus = "ready",
) {
	const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
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
	});
	vi.stubGlobal("fetch", fetchMock);
	return fetchMock;
}

const shell = () => document.querySelector(".booklet-shell");
const printButton = () => screen.getByRole("button", { name: "PDFを印刷" });
const downloadButton = () =>
	screen.getByRole("button", { name: "PDFをダウンロード" });

function mockRandomSeed(value: number) {
	return vi.spyOn(crypto, "getRandomValues").mockImplementation((values) => {
		if (values instanceof Uint32Array) values[0] = value;
		return values;
	});
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

	it("正常系: compilerのprogramを描画し、全体の確認後にだけ印刷できる", async () => {
		const fetchMock = installFetchMock();
		renderPage();

		await waitFor(() => expect(printButton()).toBeEnabled());
		expect(screen.getByRole("status")).toHaveTextContent(
			/^しおりの印刷準備ができました。$/,
		);
		expect(shell()).toHaveAttribute("data-booklet-print-state", "ready");
		expect(shell()).toHaveAttribute(
			"data-booklet-direction-id",
			firstProgram?.baseDirectionId,
		);
		expect(shell()).toHaveAttribute(
			"data-booklet-catalog-revision",
			firstProgram?.catalogRevision,
		);
		expect(shell()).toHaveAttribute(
			"data-booklet-comparison-key",
			firstProgram ? programComparisonKey(firstProgram) : "",
		);
		// A program is never labelled with an invented single family.
		expect(shell()).not.toHaveAttribute("data-booklet-family");
		const pages = Array.from(
			document.querySelectorAll<HTMLElement>(
				".booklet-document [data-booklet-page]",
			),
		);
		expect(pages[0]?.dataset.pageId).toBe("cover/cover");
		expect(pages.map((page) => page.dataset.pageNumber)).toEqual(
			pages.map((_page, index) => String(index + 1)),
		);
		expect(
			Array.from(
				document.querySelectorAll(".booklet-document [data-unit-id]"),
				(element) => element.getAttribute("data-unit-id"),
			),
		).toEqual(model.days.flatMap((day) => day.units.map((unit) => unit.id)));
		expect(screen.getAllByText("浅草").length).toBeGreaterThan(0);

		printButton().click();
		expect(window.print).toHaveBeenCalledTimes(1);
		expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/v1/journeys/journey-1");
		expect(document.fonts.load).toHaveBeenCalled();
	});

	it("状態: データ読込中はloading、計測中はpreparingで印刷できない", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(() => new Promise<Response>(() => {})),
		);
		renderPage();
		await waitFor(() =>
			expect(shell()).toHaveAttribute("data-booklet-print-state", "loading"),
		);
		expect(downloadButton()).toBeDisabled();
		cleanup();

		vi.mocked(HTMLImageElement.prototype.decode).mockReturnValue(
			new Promise<void>(() => {}),
		);
		installFetchMock();
		renderPage();
		await waitFor(() =>
			expect(shell()).toHaveAttribute("data-booklet-print-state", "preparing"),
		);
		expect(downloadButton()).toBeDisabled();
		expect(printButton()).toBeDisabled();
	});

	it("正常系: 準備完了したしおりを同じseedのPDFとしてダウンロードできる", async () => {
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
		await waitFor(() => expect(downloadButton()).toBeEnabled());
		fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
			if (String(input).includes("/booklet.pdf")) {
				return new Response("%PDF-1.4\n", {
					headers: { "Content-Type": "application/pdf" },
					status: 200,
				});
			}
			throw new Error("unexpected request");
		});

		downloadButton().click();

		await waitFor(() => expect(createObjectURL).toHaveBeenCalledTimes(1));
		expect(
			fetchMock.mock.calls
				.map(([input]) => String(input))
				.find((path) => path.includes("/booklet.pdf")),
		).toBe(
			`/api/v1/journeys/journey-1/booklet.pdf?seed=${seedQuery(firstSeed)}`,
		);
		expect(clickedFileName).toBe("旅のしおり-京都-2026-08-28.pdf");
		expect(revokeObjectURL).toHaveBeenCalledWith("blob:journey-booklet");
	});

	it("異常系: PDF生成に失敗したら印刷で保存する代替手段を案内する", async () => {
		const fetchMock = installFetchMock();
		renderPage();
		await waitFor(() => expect(downloadButton()).toBeEnabled());
		fetchMock.mockImplementation(async () => new Response("", { status: 500 }));
		downloadButton().click();
		await waitFor(() =>
			expect(screen.getByRole("status")).toHaveTextContent(
				"PDFを作成できませんでした。「PDFを印刷」からも保存できます。",
			),
		);
	});

	it("異常系: 表紙画像・挿絵が未準備なら印刷しない", async () => {
		installFetchMock("pending");
		renderPage();
		await waitFor(() =>
			expect(shell()).toHaveAttribute(
				"data-booklet-print-error",
				"表紙画像が準備できていないため、印刷できません。",
			),
		);
		expect(printButton()).toBeDisabled();
		cleanup();

		installFetchMock("ready", "request-1", "pending");
		renderPage();
		await waitFor(() =>
			expect(shell()).toHaveAttribute(
				"data-booklet-print-error",
				"挿絵がまだ準備できていないため、印刷できません。",
			),
		);
		expect(printButton()).toBeDisabled();
	});

	it("異常系: 使用する画像のdecodeに失敗したら全体をerrorにし印刷しない", async () => {
		vi.mocked(HTMLImageElement.prototype.decode).mockRejectedValue(
			new Error("decode failed"),
		);
		installFetchMock();
		renderPage();
		await waitFor(() =>
			expect(shell()).toHaveAttribute("data-booklet-print-state", "error"),
		);
		expect(shell()?.getAttribute("data-booklet-print-error")).toContain(
			"読み込みに失敗しました",
		);
		expect(printButton()).toBeDisabled();
		expect(document.querySelector(".booklet-document")).toBeNull();
	});

	it("異常系: 使用書体のweightを確認できなければ印刷しない", async () => {
		vi.mocked(document.fonts.check).mockReturnValue(false);
		installFetchMock();
		renderPage();
		await waitFor(() =>
			expect(shell()).toHaveAttribute("data-booklet-print-state", "error"),
		);
		expect(shell()?.getAttribute("data-booklet-print-error")).toContain(
			"読み込みを確認できませんでした",
		);
		expect(printButton()).toBeDisabled();
	});

	it("異常系: 不正なseedクエリは既定seedへ戻しURLから除去する", async () => {
		installFetchMock();
		renderPage(`/journeys/${defaultJourneyId}/booklet?seed=v1-00000000`);
		await waitFor(() =>
			expect(screen.getByTestId("location-search").textContent).toBe(""),
		);
		await waitFor(() => expect(printButton()).toBeEnabled());
	});

	it("正常系: 再抽選は乱数1回で新しいseedをURLへ採用し、新しいprogramを描く", async () => {
		installFetchMock();
		renderPage();
		await waitFor(() => expect(printButton()).toBeEnabled());
		const randomValues = mockRandomSeed(otherSeed);

		screen.getByRole("button", { name: "別のデザインを試す" }).click();

		await waitFor(() =>
			expect(screen.getByTestId("location-search")).toHaveTextContent(
				`seed=${seedQuery(otherSeed)}`,
			),
		);
		expect(randomValues).toHaveBeenCalledTimes(1);
		await waitFor(() => expect(printButton()).toBeEnabled());
		const other = programFor(otherSeed);
		expect(shell()).toHaveAttribute(
			"data-booklet-comparison-key",
			other ? programComparisonKey(other) : "",
		);
	});

	it("境界値系: 現在と同じseedが出ても正常な抽選として印刷準備を保持する", async () => {
		installFetchMock();
		renderPage();
		await waitFor(() => expect(printButton()).toBeEnabled());
		mockRandomSeed(firstSeed);

		screen.getByRole("button", { name: "別のデザインを試す" }).click();

		await waitFor(() =>
			expect(screen.getByTestId("location-search")).toHaveTextContent(
				`seed=${seedQuery(firstSeed)}`,
			),
		);
		expect(screen.getByRole("status")).not.toHaveTextContent(
			"別のデザインを選べませんでした",
		);
		expect(printButton()).toBeEnabled();
	});

	it("異常系: cryptoが失敗したらURL・現在seed・印刷準備を保持する", async () => {
		installFetchMock();
		renderPage();
		await waitFor(() => expect(printButton()).toBeEnabled());
		vi.spyOn(crypto, "getRandomValues").mockImplementation(() => {
			throw new Error("crypto unavailable");
		});

		screen.getByRole("button", { name: "別のデザインを試す" }).click();

		await waitFor(() =>
			expect(screen.getByRole("status")).toHaveTextContent(
				"別のデザインを選べませんでした。現在のテーマを維持します。",
			),
		);
		expect(screen.getByTestId("location-search")).toHaveTextContent(
			`seed=${seedQuery(firstSeed)}`,
		);
		expect(printButton()).toBeEnabled();
		expect(shell()).toHaveAttribute("data-booklet-print-state", "ready");
	});

	it("異常系・境界値系: 再抽選後の描画失敗は新しいseedのerrorとし、古いreadyで印刷しない", async () => {
		installFetchMock();
		renderPage();
		await waitFor(() => expect(printButton()).toBeEnabled());
		vi.mocked(HTMLImageElement.prototype.decode).mockRejectedValue(
			new Error("decode failed"),
		);
		mockRandomSeed(otherSeed);

		screen.getByRole("button", { name: "別のデザインを試す" }).click();

		// The previous seed's ready state never carries over to the new seed.
		await waitFor(() => expect(printButton()).toBeDisabled());
		await waitFor(() =>
			expect(shell()).toHaveAttribute("data-booklet-print-state", "error"),
		);
		expect(screen.getByTestId("location-search")).toHaveTextContent(
			`seed=${seedQuery(otherSeed)}`,
		);
		expect(window.print).not.toHaveBeenCalled();
	});
});
