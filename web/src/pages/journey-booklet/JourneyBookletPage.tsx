import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { ApiError } from "../../api/client";
import { downloadJourneyBookletPdf } from "../../api/journeyBooklet";
import {
	getJourneyImages,
	selectCoverImage,
	selectIllustrations,
} from "../../api/journeyImages";
import { getJourneyRequest } from "../../api/journeyRequests";
import { getJourney } from "../../api/journeys";
import {
	BookletDataError,
	CoverImageNotReadyError,
	createBookletModel,
	IllustrationNotReadyError,
} from "../../booklet/fromJourney";
import type { BookletModel } from "../../booklet/model";
import {
	programComparisonKey,
	programRenderKey,
} from "../../booklet/program/programKeys";
import { artworkById } from "../../theme/artwork/catalog";
import { compileBooklet } from "../../theme/composition/compileBooklet";
import {
	createDefaultThemeSeed,
	formatThemeSeed,
	parseThemeSeed,
} from "../../theme/seed";
import type { ThemeSeed } from "../../theme/types";
import { selectRerollSeed } from "./reroll";
import { type BookletWork, WorkRenderer } from "./WorkRenderer";
import {
	type BookletPagePlanStatus,
	type BookletWorkState,
	isPrintableWork,
	pendingWorkState,
} from "./workState";

type LoadState =
	| { readonly error: string; readonly status: "error" }
	| { readonly status: "cover-not-ready" }
	| { readonly status: "illustration-not-ready" }
	| { readonly status: "loading" }
	| { readonly status: "ready" };

type SeedRequest = {
	readonly invalidQuery: boolean;
	readonly seed: ThemeSeed | null;
};

type BookletPrintState = {
	readonly error?: string;
	readonly state: "error" | "loading" | "preparing" | "ready";
};

function errorMessage(error: unknown, fallback: string): string {
	if (error instanceof CoverImageNotReadyError) {
		return error.message;
	}
	if (error instanceof ApiError || error instanceof BookletDataError) {
		return error.message;
	}
	return fallback;
}

function downloadErrorMessage(error: unknown): string {
	if (error instanceof ApiError) {
		switch (error.status) {
			case 503:
				return "混み合っています。数秒後にもう一度お試しください。";
			case 409:
				return "表紙または挿絵がまだ準備できていません。";
		}
	}
	return "PDFを作成できませんでした。「PDFを印刷」からも保存できます。";
}

function downloadFileName(model: BookletModel): string {
	const destination = Array.from(model.cover.destination)
		.map((character) => {
			const code = character.charCodeAt(0);
			return character === "/" ||
				character === "\\" ||
				code <= 0x1f ||
				code === 0x7f
				? "_"
				: character;
		})
		.join("");
	const startDate = model.cover.period.start_date.slice(0, 10);
	return `旅のしおり-${destination}-${startDate}.pdf`;
}

function resolveBookletPrintState(
	canPrint: boolean,
	loadState: LoadState,
	workState: BookletWorkState,
): BookletPrintState {
	if (canPrint) {
		return { state: "ready" };
	}
	if (loadState.status === "loading") {
		return { state: "loading" };
	}
	if (loadState.status === "cover-not-ready") {
		return {
			error: "表紙画像が準備できていないため、印刷できません。",
			state: "error",
		};
	}
	if (loadState.status === "illustration-not-ready") {
		return {
			error: "挿絵がまだ準備できていないため、印刷できません。",
			state: "error",
		};
	}
	if (loadState.status === "error") {
		return { error: loadState.error, state: "error" };
	}
	if (workState.status === "error") {
		return {
			error: workState.error ?? "印刷前の準備に失敗しました。",
			state: "error",
		};
	}
	return { state: "preparing" };
}

/** A missing or invalid seed falls back to the journey's default seed. */
function resolveSeed(
	journeyId: string | undefined,
	seedQuery: string | null,
): SeedRequest {
	if (!journeyId) {
		return { invalidQuery: false, seed: null };
	}
	const parsed = parseThemeSeed(seedQuery);
	return {
		invalidQuery: parsed.kind === "invalid",
		seed:
			parsed.kind === "valid" ? parsed.seed : createDefaultThemeSeed(journeyId),
	};
}

/**
 * Counts changes of the model or of the work's render key. A state reported
 * for an older generation can never enable printing.
 */
function useWorkGeneration(
	model: BookletModel | null,
	renderKey: string | null,
): number {
	const [tracked, setTracked] = useState({ generation: 1, model, renderKey });
	if (tracked.model !== model || tracked.renderKey !== renderKey) {
		const next = { generation: tracked.generation + 1, model, renderKey };
		setTracked(next);
		return next.generation;
	}
	return tracked.generation;
}

function LoadingMessage() {
	return <p>旅程と画像の情報を読み込んでいます…</p>;
}

function BookletStatus({
	downloadError,
	isDownloading,
	loadState,
	rerollError,
	workError,
	workStatus,
}: {
	readonly downloadError: string | null;
	readonly isDownloading: boolean;
	readonly loadState: LoadState;
	readonly rerollError: string | null;
	readonly workError: string | null;
	readonly workStatus: BookletPagePlanStatus;
}) {
	if (isDownloading) {
		return <p>PDFを作成しています…</p>;
	}
	if (downloadError) {
		return <p>{downloadError}</p>;
	}
	if (loadState.status === "loading") {
		return <LoadingMessage />;
	}
	if (loadState.status === "cover-not-ready") {
		return <p>表紙画像が準備できていないため、印刷できません。</p>;
	}
	if (loadState.status === "illustration-not-ready") {
		return <p>挿絵がまだ準備できていないため、印刷できません。</p>;
	}
	if (loadState.status === "error") {
		return <p>{loadState.error}</p>;
	}
	if (rerollError) {
		return <p>{rerollError}</p>;
	}
	if (workStatus === "measuring") {
		return <p>画像とフォントを準備し、ページを計測しています…</p>;
	}
	if (workStatus === "checking") {
		return <p>印刷ページの収まりを確認しています…</p>;
	}
	if (workStatus === "error") {
		return <p>{workError ?? "印刷前の準備に失敗しました。"}</p>;
	}
	if (workStatus === "ready") {
		return <p>しおりの印刷準備ができました。</p>;
	}
	return null;
}

/** Shell attributes for observation; never an input of the PDF API. */
type WorkAttributes = Readonly<Record<`data-${string}`, string | undefined>>;

/** The work to draw for one model and seed, with its render key and attributes. */
type ResolvedWork = {
	readonly attributes: WorkAttributes;
	/** null when nothing printable can be prepared (e.g. a compile failure). */
	readonly renderKey: string | null;
	readonly work: BookletWork;
};

/**
 * The compiler reads only the model, the seed and this build's catalog, and
 * the program is drawn by ProgramBooklet (25.4). A program carries no
 * invented family ID.
 */
function resolveProgramWork(
	model: BookletModel,
	seed: ThemeSeed,
): ResolvedWork {
	const result = compileBooklet(model, { seed });
	const program = result.status === "compiled" ? result.program : null;
	return {
		attributes: {
			"data-booklet-catalog-revision": program?.catalogRevision,
			"data-booklet-comparison-key": program
				? programComparisonKey(program)
				: undefined,
			"data-booklet-direction-id": program?.baseDirectionId,
		},
		renderKey: program ? programRenderKey(program) : null,
		work: { artworkById, result },
	};
}

/**
 * Loading, seed handling, status, printing, PDF download and reroll around
 * the compiled program of one model and seed.
 */
export function JourneyBookletPage() {
	const { journeyId } = useParams<{ journeyId: string }>();
	const [searchParams, setSearchParams] = useSearchParams();
	const seedQuery = searchParams.get("seed");
	const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
	const [model, setModel] = useState<BookletModel | null>(null);
	const [downloadError, setDownloadError] = useState<string | null>(null);
	const [isDownloading, setIsDownloading] = useState(false);
	const [rerollError, setRerollError] = useState<string | null>(null);
	const seedRequest = useMemo(
		() => resolveSeed(journeyId, seedQuery),
		[journeyId, seedQuery],
	);
	const { seed } = seedRequest;
	const resolved = useMemo(
		() => (model && seed ? resolveProgramWork(model, seed) : null),
		[model, seed],
	);
	const renderKey = resolved?.renderKey ?? null;
	const generation = useWorkGeneration(model, renderKey);
	const [reportedState, setReportedState] = useState<BookletWorkState>(() =>
		pendingWorkState("idle", 0),
	);
	const workState =
		reportedState.generation === generation
			? reportedState
			: pendingWorkState(model ? "measuring" : "idle", generation);
	const onWorkStateChange = useCallback((state: BookletWorkState) => {
		setReportedState(state);
	}, []);
	const work = resolved?.work ?? null;
	const shellAttributes = resolved?.attributes ?? {};
	const canPrint =
		loadState.status === "ready" &&
		isPrintableWork(workState, { generation, model, renderKey });
	const bookletPrintState = resolveBookletPrintState(
		canPrint,
		loadState,
		workState,
	);

	useEffect(() => {
		if (!seedRequest.invalidQuery) {
			return;
		}
		const next = new URLSearchParams(searchParams);
		next.delete("seed");
		setSearchParams(next, { replace: true });
	}, [searchParams, setSearchParams, seedRequest.invalidQuery]);

	useEffect(() => {
		const controller = new AbortController();
		let cancelled = false;
		setLoadState({ status: "loading" });
		setModel(null);

		if (!journeyId) {
			setLoadState({ error: "旅程IDが指定されていません。", status: "error" });
			return () => controller.abort();
		}

		const load = async () => {
			try {
				const journey = await getJourney(journeyId, {
					signal: controller.signal,
				});
				if (cancelled) {
					return;
				}
				const [request, imageList] = await Promise.all([
					getJourneyRequest(journey.request_id, { signal: controller.signal }),
					getJourneyImages(journey.request_id, { signal: controller.signal }),
				]);
				if (imageList.journey_request_id !== journey.request_id) {
					throw new BookletDataError("旅程と画像一覧の識別子が一致しません。");
				}
				const coverImage = selectCoverImage(imageList.images);
				const illustrationImages = selectIllustrations(imageList.images);
				const bookletModel = createBookletModel({
					coverImage,
					illustrationImages,
					journey,
					request,
				});
				if (!cancelled) {
					setModel(bookletModel);
					setLoadState({ status: "ready" });
				}
			} catch (loadError) {
				if (!cancelled && !controller.signal.aborted) {
					setModel(null);
					setLoadState({
						error: errorMessage(
							loadError,
							"旅程データを読み込めませんでした。",
						),
						status:
							loadError instanceof CoverImageNotReadyError
								? "cover-not-ready"
								: loadError instanceof IllustrationNotReadyError
									? "illustration-not-ready"
									: "error",
					});
				}
			}
		};

		void load();
		return () => {
			cancelled = true;
			controller.abort();
		};
	}, [journeyId]);

	const handlePrint = () => {
		if (canPrint && !isDownloading) {
			window.print();
		}
	};

	const handleDownload = async () => {
		if (!canPrint || !journeyId || !model || !seed) {
			return;
		}

		setDownloadError(null);
		setIsDownloading(true);
		try {
			const pdf = await downloadJourneyBookletPdf(journeyId, {
				seed: formatThemeSeed(seed),
			});
			const objectURL = URL.createObjectURL(pdf);
			const anchor = document.createElement("a");
			anchor.download = downloadFileName(model);
			anchor.href = objectURL;
			try {
				document.body.append(anchor);
				anchor.click();
			} finally {
				anchor.remove();
				URL.revokeObjectURL(objectURL);
			}
		} catch (error) {
			setDownloadError(downloadErrorMessage(error));
		} finally {
			setIsDownloading(false);
		}
	};

	const handleReroll = () => {
		if (!seed) {
			return;
		}
		setDownloadError(null);
		setRerollError(null);
		let nextSeed: ReturnType<typeof selectRerollSeed>;
		try {
			nextSeed = selectRerollSeed();
		} catch {
			// The current seed and its ready booklet stay untouched.
			setRerollError(
				"別のデザインを選べませんでした。現在のテーマを維持します。",
			);
			return;
		}
		// Later compile/render failures belong to the new seed and show as its error.
		const next = new URLSearchParams(searchParams);
		next.set("seed", formatThemeSeed(nextSeed));
		setSearchParams(next);
	};

	return (
		<div
			className="booklet-shell"
			{...shellAttributes}
			data-booklet-print-error={bookletPrintState.error}
			data-booklet-print-state={bookletPrintState.state}
		>
			<section className="booklet-controls" aria-label="旅のしおり操作">
				<div className="booklet-controls__identity">
					<p className="booklet-controls__eyebrow">BOOKLET / A5</p>
					<h1>旅のしおり</h1>
				</div>
				<div className="booklet-controls__actions">
					<Link className="booklet-controls__home" to="/">
						ホームに戻る
					</Link>
					<button
						type="button"
						disabled={seed === null || isDownloading}
						onClick={handleReroll}
					>
						別のデザインを試す
					</button>
					<button
						className="booklet-controls__download"
						type="button"
						disabled={!canPrint || isDownloading}
						onClick={handleDownload}
					>
						PDFをダウンロード
					</button>
					<button
						type="button"
						disabled={!canPrint || isDownloading}
						onClick={handlePrint}
					>
						PDFを印刷
					</button>
				</div>
				<div
					className="booklet-controls__status"
					role="status"
					aria-live="polite"
				>
					<BookletStatus
						downloadError={downloadError}
						isDownloading={isDownloading}
						loadState={loadState}
						rerollError={rerollError}
						workError={workState.error}
						workStatus={
							loadState.status === "ready" ? workState.status : "idle"
						}
					/>
				</div>
			</section>

			{model && work ? (
				<WorkRenderer
					generation={generation}
					model={model}
					onStateChange={onWorkStateChange}
					work={work}
				/>
			) : null}
		</div>
	);
}
