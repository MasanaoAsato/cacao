import { useEffect, useState } from "react";
import { useParams } from "react-router";
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
import { BookletDocument, BookletMeasurement } from "./BookletDocument";
import { useBookletPagePlan } from "./useBookletPagePlan";

type LoadState =
	| { readonly error: string; readonly status: "error" }
	| { readonly status: "cover-not-ready" }
	| { readonly status: "loading" }
	| { readonly status: "ready" };

function errorMessage(error: unknown, fallback: string): string {
	if (error instanceof CoverImageNotReadyError) {
		return error.message;
	}
	if (error instanceof ApiError || error instanceof BookletDataError) {
		return error.message;
	}
	return fallback;
}

function LoadingMessage() {
	return <p>旅程と表紙画像の情報を読み込んでいます…</p>;
}

function BookletStatus({
	loadState,
	pagePlanStatus,
	pagePlanError,
}: {
	readonly loadState: LoadState;
	readonly pagePlanError: string | null;
	readonly pagePlanStatus: string;
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
		return <p>印刷の準備ができました。</p>;
	}
	return null;
}

export function JourneyBookletPage() {
	const { journeyId } = useParams<{ journeyId: string }>();
	const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
	const [model, setModel] = useState<BookletModel | null>(null);
	const {
		documentRef,
		error: pagePlanError,
		measurementRef,
		pagePlan,
		status,
	} = useBookletPagePlan(model);
	const canPrint =
		loadState.status === "ready" && status === "ready" && pagePlan !== null;

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
			} catch (error) {
				if (!cancelled && !controller.signal.aborted) {
					setModel(null);
					setLoadState({
						error: errorMessage(error, "旅程データを読み込めませんでした。"),
						status:
							error instanceof CoverImageNotReadyError
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

	return (
		<div className="booklet-shell">
			<section className="booklet-controls" aria-label="旅のしおり操作">
				<div>
					<p className="booklet-controls__eyebrow">BOOKLET / A5</p>
					<h1>旅のしおり</h1>
				</div>
				<button type="button" disabled={!canPrint} onClick={handlePrint}>
					PDFを印刷
				</button>
				<div
					className="booklet-controls__status"
					role="status"
					aria-live="polite"
				>
					<BookletStatus
						loadState={loadState}
						pagePlanError={pagePlanError}
						pagePlanStatus={status}
					/>
				</div>
			</section>

			{model ? (
				<BookletMeasurement model={model} rootRef={measurementRef} />
			) : null}
			{model && pagePlan ? (
				<BookletDocument
					model={model}
					pagePlan={pagePlan}
					rootRef={documentRef}
				/>
			) : null}
		</div>
	);
}
