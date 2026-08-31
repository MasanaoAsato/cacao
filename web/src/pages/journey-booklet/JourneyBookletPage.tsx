import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router";
import { ApiError } from "../../api/client";
import { getJourneyImages, selectCoverImage } from "../../api/journeyImages";
import { getJourneyRequest } from "../../api/journeyRequests";
import { getJourney } from "../../api/journeys";
import {
	BookletDataError,
	CoverImageNotReadyError,
	createBookletModel,
} from "../../booklet/fromJourney";
import type { BookletModel } from "../../booklet/model";
import { createBookletTheme, selectV1Recipe } from "../../theme/bookletTheme";
import {
	createDefaultThemeSeed,
	createRerollSeed,
	formatThemeSeed,
	parseThemeSeed,
} from "../../theme/seed";
import type { RequestedBookletTheme } from "../../theme/types";
import { BookletDocument, BookletMeasurement } from "./BookletDocument";
import { useBookletPagePlan } from "./useBookletPagePlan";

type LoadState =
	| { readonly error: string; readonly status: "error" }
	| { readonly status: "cover-not-ready" }
	| { readonly status: "loading" }
	| { readonly status: "ready" };

type ThemeRequestResult = {
	readonly error: string | null;
	readonly invalidQuery: boolean;
	readonly requestedTheme: RequestedBookletTheme | null;
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

function resolveRequestedTheme(
	journeyId: string | undefined,
	seedQuery: string | null,
): ThemeRequestResult {
	if (!journeyId) {
		return { error: null, invalidQuery: false, requestedTheme: null };
	}
	const parsed = parseThemeSeed(seedQuery);
	const seed =
		parsed.kind === "valid" ? parsed.seed : createDefaultThemeSeed(journeyId);
	try {
		return {
			error: null,
			invalidQuery: parsed.kind === "invalid",
			requestedTheme: createBookletTheme(seed),
		};
	} catch {
		return {
			error: "しおりのデザイン定義を読み込めませんでした。",
			invalidQuery: parsed.kind === "invalid",
			requestedTheme: null,
		};
	}
}

function LoadingMessage() {
	return <p>旅程と表紙画像の情報を読み込んでいます…</p>;
}

function BookletStatus({
	loadState,
	pagePlanError,
	pagePlanStatus,
	reresolveError,
	theme,
	themeError,
}: {
	readonly loadState: LoadState;
	readonly pagePlanError: string | null;
	readonly pagePlanStatus: string;
	readonly reresolveError: string | null;
	readonly theme: RequestedBookletTheme | null;
	readonly themeError: string | null;
}) {
	if (loadState.status === "loading") {
		return <LoadingMessage />;
	}
	if (loadState.status === "cover-not-ready") {
		return <p>表紙画像が準備できていないため、印刷できません。</p>;
	}
	if (loadState.status === "error") {
		return <p>{loadState.error}</p>;
	}
	if (themeError) {
		return <p>{themeError}</p>;
	}
	if (reresolveError) {
		return <p>{reresolveError}</p>;
	}
	if (pagePlanStatus === "measuring") {
		return <p>画像とフォントを準備し、ページを計測しています…</p>;
	}
	if (pagePlanStatus === "checking") {
		return <p>印刷ページの収まりを確認しています…</p>;
	}
	if (pagePlanStatus === "error") {
		return <p>{pagePlanError ?? "印刷前の準備に失敗しました。"}</p>;
	}
	if (pagePlanStatus === "ready") {
		return (
			<p>
				{theme
					? `テーマ ${theme.recipe.id} の印刷準備ができました。`
					: "印刷の準備ができました。"}
			</p>
		);
	}
	return null;
}

export function JourneyBookletPage() {
	const { journeyId } = useParams<{ journeyId: string }>();
	const [searchParams, setSearchParams] = useSearchParams();
	const seedQuery = searchParams.get("seed");
	const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
	const [model, setModel] = useState<BookletModel | null>(null);
	const [rerollError, setRerollError] = useState<string | null>(null);
	const themeRequest = useMemo(
		() => resolveRequestedTheme(journeyId, seedQuery),
		[journeyId, seedQuery],
	);
	const {
		activeTheme,
		coverVeilBounds,
		documentRef,
		error: pagePlanError,
		measurementRef,
		pagePlan,
		resolvedTheme,
		status,
	} = useBookletPagePlan(model, themeRequest.requestedTheme);
	const canPrint =
		loadState.status === "ready" &&
		status === "ready" &&
		pagePlan !== null &&
		coverVeilBounds !== null &&
		resolvedTheme !== null &&
		activeTheme?.resolvedThemeKey === resolvedTheme.resolvedThemeKey;

	useEffect(() => {
		if (!themeRequest.invalidQuery) {
			return;
		}
		const next = new URLSearchParams(searchParams);
		next.delete("seed");
		setSearchParams(next, { replace: true });
	}, [searchParams, setSearchParams, themeRequest.invalidQuery]);

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
					throw new BookletDataError(
						"旅程と表紙画像一覧の識別子が一致しません。",
					);
				}
				const coverImage = selectCoverImage(imageList.images);
				const bookletModel = createBookletModel({
					coverImage,
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
		if (canPrint) {
			window.print();
		}
	};

	const handleReroll = () => {
		const requestedTheme = themeRequest.requestedTheme;
		if (!requestedTheme) {
			return;
		}
		setRerollError(null);
		try {
			const nextSeed = createRerollSeed(
				requestedTheme.seed,
				(candidate) =>
					selectV1Recipe(candidate).id !== requestedTheme.recipe.id,
			);
			if (!nextSeed) {
				setRerollError(
					"別のデザインを選べませんでした。現在のテーマを維持します。",
				);
				return;
			}
			const next = new URLSearchParams(searchParams);
			next.set("seed", formatThemeSeed(nextSeed));
			setSearchParams(next);
		} catch {
			setRerollError(
				"別のデザインを選べませんでした。現在のテーマを維持します。",
			);
		}
	};

	return (
		<div className="booklet-shell">
			<section className="booklet-controls" aria-label="旅のしおり操作">
				<div>
					<p className="booklet-controls__eyebrow">BOOKLET / A5</p>
					<h1>旅のしおり</h1>
				</div>
				<div className="booklet-controls__actions">
					<button
						type="button"
						disabled={themeRequest.requestedTheme === null}
						onClick={handleReroll}
					>
						別のデザインを試す
					</button>
					<button type="button" disabled={!canPrint} onClick={handlePrint}>
						PDFを印刷
					</button>
				</div>
				<div
					className="booklet-controls__status"
					role="status"
					aria-live="polite"
				>
					<BookletStatus
						loadState={loadState}
						pagePlanError={pagePlanError}
						pagePlanStatus={status}
						reresolveError={rerollError}
						theme={themeRequest.requestedTheme}
						themeError={themeRequest.error}
					/>
				</div>
			</section>

			{model && activeTheme ? (
				<BookletMeasurement
					model={model}
					rootRef={measurementRef}
					theme={activeTheme}
				/>
			) : null}
			{model && pagePlan && activeTheme && coverVeilBounds ? (
				<BookletDocument
					coverVeilBounds={coverVeilBounds}
					model={model}
					pagePlan={pagePlan}
					rootRef={documentRef}
					theme={activeTheme}
				/>
			) : null}
		</div>
	);
}
