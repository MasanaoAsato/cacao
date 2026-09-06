/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	getJourneyImages,
	requestJourneyImages,
	retryJourneyImage,
} from "../../api/journeyImages";
import { createJourneyRequest } from "../../api/journeyRequests";
import { generateJourney } from "../../api/journeys";
import {
	CoverImageGenerationError,
	JourneyCreationPage,
	journeyImageSlotsForPeriod,
	waitForCoverImage,
	waitForJourneyImages,
} from "./JourneyCreationPage";

vi.mock("../../api/journeyRequests", () => ({
	createJourneyRequest: vi.fn(),
}));

vi.mock("../../api/journeys", () => ({
	generateJourney: vi.fn(),
}));

vi.mock("../../api/journeyImages", () => ({
	getJourneyImages: vi.fn(),
	requestJourneyImages: vi.fn(),
	retryJourneyImage: vi.fn(),
	selectCoverImage: (
		images: readonly { slot: { purpose: string; ordinal: number } }[],
	) =>
		images.find(
			(image) => image.slot.purpose === "cover" && image.slot.ordinal === 1,
		) ?? null,
}));

const readyImage = {
	attempt_count: 1,
	content_url: "/api/v1/journey-images/image-1/content",
	failure_code: null,
	height: 1200,
	id: "image-1",
	media_type: "image/png",
	slot: { ordinal: 1, purpose: "cover" },
	status: "ready" as const,
	visual_style: "editorial-photograph",
	width: 800,
};

const failedImage = { ...readyImage, status: "failed" as const };

const readyIllustrations = [1, 2, 3].map((ordinal) => ({
	...readyImage,
	content_url: `/api/v1/journey-images/illustration-${ordinal}/content`,
	height: 900,
	id: `illustration-${ordinal}`,
	slot: { ordinal, purpose: "illustration" as const },
	visual_style: null,
	width: 1200,
}));

function imageResponse(
	images: readonly (
		| typeof readyImage
		| (typeof readyIllustrations)[number]
	)[] = [readyImage, ...readyIllustrations],
	journeyRequestId = "request-1",
) {
	return { images, journey_request_id: journeyRequestId };
}

function renderPage() {
	return render(
		<MemoryRouter initialEntries={["/"]}>
			<Routes>
				<Route path="/" element={<JourneyCreationPage />} />
				<Route
					path="/journeys/:journeyId/booklet"
					element={<p>booklet ready</p>}
				/>
			</Routes>
		</MemoryRouter>,
	);
}

function fillValidForm() {
	fireEvent.change(screen.getByRole("textbox", { name: /出発都市/ }), {
		target: { value: "千葉" },
	});
	fireEvent.change(screen.getByRole("textbox", { name: /目的地都市/ }), {
		target: { value: "宇都宮" },
	});
	fireEvent.change(
		document.getElementById("journey-start_date") as HTMLInputElement,
		{
			target: { value: "2026-10-23" },
		},
	);
	fireEvent.change(
		document.getElementById("journey-end_date") as HTMLInputElement,
		{
			target: { value: "2026-10-25" },
		},
	);
	fireEvent.change(screen.getByRole("spinbutton", { name: /予算/ }), {
		target: { value: "90000" },
	});
}

function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (reason?: unknown) => void;
	const promise = new Promise<T>((resolvePromise, rejectPromise) => {
		resolve = resolvePromise;
		reject = rejectPromise;
	});
	return { promise, reject, resolve };
}

describe("JourneyCreationPage", () => {
	beforeEach(() => {
		vi.mocked(createJourneyRequest).mockResolvedValue({
			request_id: "request-1",
		});
		vi.mocked(generateJourney).mockResolvedValue({ journey_id: "journey-1" });
		vi.mocked(requestJourneyImages).mockResolvedValue(imageResponse());
		vi.mocked(getJourneyImages).mockResolvedValue({
			...imageResponse(),
		});
		vi.mocked(retryJourneyImage).mockResolvedValue(readyImage);
	});

	afterEach(() => {
		cleanup();
		vi.clearAllMocks();
	});

	it("正常系: 期間の日数に応じて最大3枚の挿絵スロットを作る", () => {
		expect(
			journeyImageSlotsForPeriod(
				"2026-10-23T00:00:00Z",
				"2026-10-25T00:00:00Z",
			),
		).toEqual([
			{ ordinal: 1, purpose: "cover" },
			{ ordinal: 1, purpose: "illustration" },
			{ ordinal: 2, purpose: "illustration" },
			{ ordinal: 3, purpose: "illustration" },
		]);
	});

	it("境界値系: 1日間は挿絵を1枚だけ要求する", () => {
		expect(
			journeyImageSlotsForPeriod(
				"2026-10-23T00:00:00Z",
				"2026-10-23T00:00:00Z",
			),
		).toEqual([
			{ ordinal: 1, purpose: "cover" },
			{ ordinal: 1, purpose: "illustration" },
		]);
	});

	it("内部用の画面番号を表示しない", () => {
		renderPage();

		expect(screen.queryByText("TRAVEL JOURNAL / 03")).not.toBeInTheDocument();
	});

	it("日本語の見出しを文節で改行する", () => {
		renderPage();

		const heading = screen.getByRole("heading", { level: 1 });
		expect(heading).toHaveTextContent("あなたも知らない、");
		expect(heading).toHaveTextContent("旅をつくる");
		expect(heading.querySelector("br")).not.toBeNull();
		expect(heading.querySelectorAll(":scope > span")).toHaveLength(2);
	});

	it("正常系: 生成開始後、旅程と表紙がそろったらしおりへ遷移する", async () => {
		renderPage();
		fillValidForm();

		fireEvent.click(screen.getByRole("button", { name: "旅程を生成する" }));

		await waitFor(() =>
			expect(screen.getByText("booklet ready")).toBeInTheDocument(),
		);
		expect(createJourneyRequest).toHaveBeenCalledTimes(1);
		expect(generateJourney).toHaveBeenCalledWith(
			"request-1",
			expect.anything(),
		);
		expect(requestJourneyImages).toHaveBeenCalledWith(
			"request-1",
			expect.arrayContaining([
				{ ordinal: 1, purpose: "cover" },
				{ ordinal: 1, purpose: "illustration" },
				{ ordinal: 2, purpose: "illustration" },
				{ ordinal: 3, purpose: "illustration" },
			]),
			expect.anything(),
		);
	});

	it("正常系: 挿絵の失敗は無視してしおりへ遷移する", async () => {
		vi.mocked(requestJourneyImages).mockResolvedValue(
			imageResponse([
				readyImage,
				{ ...readyIllustrations[0], status: "failed" as const },
				readyIllustrations[1],
				readyIllustrations[2],
			]),
		);
		renderPage();
		fillValidForm();

		fireEvent.click(screen.getByRole("button", { name: "旅程を生成する" }));

		await waitFor(() =>
			expect(screen.getByText("booklet ready")).toBeInTheDocument(),
		);
		expect(
			screen.queryByRole("button", { name: "表紙画像を再試行" }),
		).not.toBeInTheDocument();
	});

	it("異常系: 未入力ではAPIを呼ばず最初のエラー項目へフォーカスする", () => {
		renderPage();

		fireEvent.click(screen.getByRole("button", { name: "旅程を生成する" }));

		expect(createJourneyRequest).not.toHaveBeenCalled();
		expect(screen.getAllByRole("alert")[0]).toHaveTextContent("出発都市");
		expect(screen.getByRole("textbox", { name: /出発都市/ })).toHaveFocus();
	});

	it("異常系: 作成失敗時は再送で新しいリクエストになる可能性を知らせる", async () => {
		vi.mocked(createJourneyRequest).mockRejectedValueOnce(
			new Error("request creation failed"),
		);
		renderPage();
		fillValidForm();

		fireEvent.click(screen.getByRole("button", { name: "旅程を生成する" }));
		await waitFor(() =>
			expect(
				screen.getByText(/新しい旅程リクエストになる可能性/),
			).toBeInTheDocument(),
		);
	});

	it("異常系: 画像失敗では自動retryせず、明示操作でretryする", async () => {
		vi.mocked(requestJourneyImages).mockResolvedValue(
			imageResponse([failedImage, ...readyIllustrations]),
		);
		renderPage();
		fillValidForm();

		fireEvent.click(screen.getByRole("button", { name: "旅程を生成する" }));
		await waitFor(() =>
			expect(
				screen.getByRole("button", { name: "表紙画像を再試行" }),
			).toBeInTheDocument(),
		);
		expect(retryJourneyImage).not.toHaveBeenCalled();

		fireEvent.click(screen.getByRole("button", { name: "表紙画像を再試行" }));
		await waitFor(() =>
			expect(screen.getByText("booklet ready")).toBeInTheDocument(),
		);
		expect(retryJourneyImage).toHaveBeenCalledWith(
			"image-1",
			expect.anything(),
		);
	});

	it("異常系: 画像要求の失敗後は生成済み旅程の画像状態を再確認できる", async () => {
		vi.mocked(requestJourneyImages)
			.mockRejectedValueOnce(new Error("temporary image failure"))
			.mockResolvedValueOnce(imageResponse());
		renderPage();
		fillValidForm();

		fireEvent.click(screen.getByRole("button", { name: "旅程を生成する" }));
		await waitFor(() =>
			expect(
				screen.getByRole("button", { name: "画像状態を再確認" }),
			).toBeInTheDocument(),
		);

		fireEvent.click(screen.getByRole("button", { name: "画像状態を再確認" }));
		await waitFor(() =>
			expect(screen.getByText("booklet ready")).toBeInTheDocument(),
		);
	});

	it("異常系: 旅程生成の失敗は画像要求の完了を待たずに表示する", async () => {
		const pendingImageRequest = deferred<{
			images: readonly (typeof readyImage)[];
			journey_request_id: string;
		}>();
		vi.mocked(requestJourneyImages).mockReturnValueOnce(
			pendingImageRequest.promise,
		);
		vi.mocked(generateJourney).mockRejectedValueOnce(
			new Error("journey generation failed"),
		);
		renderPage();
		fillValidForm();

		fireEvent.click(screen.getByRole("button", { name: "旅程を生成する" }));
		await waitFor(() =>
			expect(screen.getByText("journey generation failed")).toBeInTheDocument(),
		);
		expect(
			screen.queryByRole("button", { name: "画像状態を再確認" }),
		).not.toBeInTheDocument();
	});

	it("境界値系: 新しい送信処理が旧処理の状態更新に上書きされない", async () => {
		const firstCreate = deferred<{ request_id: string }>();
		const secondCreate = deferred<{ request_id: string }>();
		vi.mocked(createJourneyRequest)
			.mockImplementationOnce(() => firstCreate.promise)
			.mockImplementationOnce(() => secondCreate.promise);
		vi.mocked(generateJourney).mockResolvedValue({ journey_id: "journey-2" });
		vi.mocked(requestJourneyImages).mockResolvedValue(
			imageResponse([readyImage, ...readyIllustrations], "request-2"),
		);

		renderPage();
		fillValidForm();
		const form = document.querySelector("form");
		if (!form) {
			throw new Error("旅程作成フォームが見つかりません。");
		}

		fireEvent.submit(form);
		fireEvent.submit(form);
		await waitFor(() => expect(createJourneyRequest).toHaveBeenCalledTimes(2));

		firstCreate.resolve({ request_id: "request-1" });
		await waitFor(() =>
			expect(
				screen.getByText("旅程リクエストを作成しています…"),
			).toBeInTheDocument(),
		);

		secondCreate.resolve({ request_id: "request-2" });
		await waitFor(() =>
			expect(screen.getByText("booklet ready")).toBeInTheDocument(),
		);
	});

	it("境界値系: pendingからreadyまで2秒間隔で1回だけ状態確認する", async () => {
		vi.useFakeTimers();
		try {
			const getImages = vi.fn().mockResolvedValue({
				images: [readyImage],
				journey_request_id: "request-1",
			});
			const pendingResponse = {
				images: [{ ...readyImage, status: "pending" as const }],
				journey_request_id: "request-1",
			};
			const coverPromise = waitForCoverImage("request-1", pendingResponse, {
				getImages,
			});

			await vi.advanceTimersByTimeAsync(1999);
			expect(getImages).not.toHaveBeenCalled();
			await vi.advanceTimersByTimeAsync(1);
			expect(await coverPromise).toEqual(readyImage);
			expect(getImages).toHaveBeenCalledTimes(1);
		} finally {
			vi.useRealTimers();
		}
	});

	it("正常系: 全スロットが決着するまで挿絵の状態確認を続ける", async () => {
		const getImages = vi
			.fn()
			.mockResolvedValueOnce(
				imageResponse([
					{ ...readyImage, status: "ready" as const },
					{ ...readyIllustrations[0], status: "processing" as const },
				]),
			)
			.mockResolvedValueOnce(imageResponse());
		const promise = waitForJourneyImages(
			"request-1",
			imageResponse([
				{ ...readyImage, status: "ready" as const },
				{ ...readyIllustrations[0], status: "pending" as const },
			]),
			[
				{ ordinal: 1, purpose: "cover" },
				{ ordinal: 1, purpose: "illustration" },
			],
			{ getImages, intervalMs: 0 },
		);

		expect((await promise).images).toEqual(imageResponse().images);
		expect(getImages).toHaveBeenCalledTimes(2);
	});

	it("異常系: 表紙が先に失敗しても全スロットの決着まで待機する", async () => {
		const getImages = vi
			.fn()
			.mockResolvedValue(
				imageResponse([
					failedImage,
					{ ...readyIllustrations[0], status: "ready" as const },
				]),
			);

		const promise = waitForJourneyImages(
			"request-1",
			imageResponse([
				failedImage,
				{ ...readyIllustrations[0], status: "processing" as const },
			]),
			[
				{ ordinal: 1, purpose: "cover" },
				{ ordinal: 1, purpose: "illustration" },
			],
			{ getImages, intervalMs: 0 },
		);

		await expect(promise).rejects.toBeInstanceOf(CoverImageGenerationError);
		expect(getImages).toHaveBeenCalledTimes(1);
	});

	it("異常系: 要求した画像スロットが一覧にない場合は待機を続けない", async () => {
		await expect(
			waitForJourneyImages("request-1", imageResponse([]), [
				{ ordinal: 1, purpose: "cover" },
			]),
		).rejects.toThrow("表紙画像スロットが見つかりません。");
	});

	it("異常系: readyでも表紙画像のメタデータが不足していれば遷移しない", async () => {
		await expect(
			waitForCoverImage("request-1", {
				images: [{ ...readyImage, content_url: null }],
				journey_request_id: "request-1",
			}),
		).rejects.toThrow("コンテンツ情報");
	});
});
