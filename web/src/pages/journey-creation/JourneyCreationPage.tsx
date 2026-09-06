import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { ApiError } from "../../api/client";
import {
	getJourneyImages,
	type JourneyImageApiResponse,
	type JourneyImageListApiResponse,
	type JourneyImageSlot,
	type JourneyImageStatus,
	requestJourneyImages,
	retryJourneyImage,
	selectCoverImage,
} from "../../api/journeyImages";
import { createJourneyRequest } from "../../api/journeyRequests";
import { generateJourney } from "../../api/journeys";
import {
	initialJourneyCreationFormValues,
	type JourneyCreationFormErrors,
	type JourneyCreationFormField,
	type JourneyCreationFormValues,
	JourneyCreationValidationError,
	toJourneyRequestPayload,
	validateJourneyCreationForm,
} from "./form";
import "./JourneyCreationPage.css";

const coverPollingIntervalMs = 2000;

type ImagePollingOptions = {
	readonly getImages?: typeof getJourneyImages;
	readonly intervalMs?: number;
	readonly onStatusChange?: (status: JourneyImageStatus) => void;
	readonly signal?: AbortSignal;
};

type CoverPollingOptions = ImagePollingOptions;

export class CoverImageGenerationError extends Error {
	readonly image: JourneyImageApiResponse;

	constructor(image: JourneyImageApiResponse) {
		super("表紙画像の生成に失敗しました。画像を再試行できます。");
		this.name = "CoverImageGenerationError";
		this.image = image;
	}
}

function wait(milliseconds: number, signal?: AbortSignal): Promise<void> {
	if (signal?.aborted) {
		return Promise.reject(new Error("操作がキャンセルされました。"));
	}

	return new Promise((resolve, reject) => {
		let timeoutId: ReturnType<typeof globalThis.setTimeout> | undefined;
		const cleanup = () => {
			if (timeoutId !== undefined) {
				globalThis.clearTimeout(timeoutId);
			}
			signal?.removeEventListener("abort", abort);
		};
		const abort = () => {
			cleanup();
			reject(new Error("操作がキャンセルされました。"));
		};
		timeoutId = globalThis.setTimeout(() => {
			cleanup();
			resolve();
		}, milliseconds);
		if (signal?.aborted) {
			abort();
			return;
		}
		signal?.addEventListener("abort", abort, { once: true });
	});
}

function imageMatchesSlot(
	image: JourneyImageApiResponse,
	slot: JourneyImageSlot,
): boolean {
	return (
		image.slot.purpose === slot.purpose && image.slot.ordinal === slot.ordinal
	);
}

function imageStatusFor(
	images: readonly JourneyImageApiResponse[],
	slots: readonly JourneyImageSlot[],
): JourneyImageStatus {
	const selected = slots
		.map((slot) => images.find((image) => imageMatchesSlot(image, slot)))
		.filter((image): image is JourneyImageApiResponse => image !== undefined);
	if (selected.some((image) => image.status === "pending")) {
		return "pending";
	}
	if (selected.some((image) => image.status === "processing")) {
		return "processing";
	}
	if (selected.some((image) => image.status === "failed")) {
		return "failed";
	}
	return "ready";
}

function validateReadyImage(
	image: JourneyImageApiResponse,
	label: string,
): void {
	if (
		image.content_url === null ||
		image.media_type === null ||
		image.width === null ||
		image.height === null ||
		image.width <= 0 ||
		image.height <= 0
	) {
		throw new Error(`${label}のコンテンツ情報が不足しています。`);
	}
}

function inclusiveDayCount(startDate: string, endDate: string): number {
	const start = Date.parse(`${startDate.slice(0, 10)}T00:00:00Z`);
	const end = Date.parse(`${endDate.slice(0, 10)}T00:00:00Z`);
	if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
		throw new Error("旅程の期間を計算できませんでした。");
	}
	return Math.floor((end - start) / 86_400_000) + 1;
}

export function journeyImageSlotsForPeriod(
	startDate: string,
	endDate: string,
): readonly JourneyImageSlot[] {
	const illustrationCount = Math.min(3, inclusiveDayCount(startDate, endDate));
	return [
		{ ordinal: 1, purpose: "cover" },
		...Array.from({ length: illustrationCount }, (_, index) => ({
			ordinal: index + 1,
			purpose: "illustration" as const,
		})),
	];
}

export async function waitForJourneyImages(
	requestId: string,
	initialResponse: JourneyImageListApiResponse,
	slots: readonly JourneyImageSlot[],
	options: ImagePollingOptions = {},
): Promise<JourneyImageListApiResponse> {
	if (slots.length === 0) {
		throw new Error("画像スロットが指定されていません。");
	}
	const getImages = options.getImages ?? getJourneyImages;
	const intervalMs = options.intervalMs ?? coverPollingIntervalMs;
	let response = initialResponse;

	while (true) {
		if (response.journey_request_id !== requestId) {
			throw new Error("画像一覧の識別子が旅程リクエストと一致しません。");
		}

		const requestedImages = slots.map((slot) =>
			response.images.find((image) => imageMatchesSlot(image, slot)),
		);
		const missingSlotIndex = requestedImages.indexOf(undefined);
		if (missingSlotIndex >= 0) {
			const missingSlot = slots[missingSlotIndex];
			throw new Error(
				`${missingSlot?.purpose === "illustration" ? "挿絵画像" : "表紙画像"}スロットが見つかりません。`,
			);
		}
		const cover = selectCoverImage(response.images);
		if (cover?.status === "ready") {
			validateReadyImage(cover, "表紙画像");
		}

		const allSettled = requestedImages.every(
			(image) =>
				image !== undefined &&
				(image.status === "ready" || image.status === "failed"),
		);
		if (allSettled) {
			for (const image of requestedImages) {
				if (image?.status === "ready") {
					validateReadyImage(
						image,
						image.slot.purpose === "illustration" ? "挿絵画像" : "表紙画像",
					);
				}
			}
			if (cover?.status === "failed") {
				throw new CoverImageGenerationError(cover);
			}
			options.onStatusChange?.(imageStatusFor(response.images, slots));
			return response;
		}

		options.onStatusChange?.(imageStatusFor(response.images, slots));
		await wait(intervalMs, options.signal);
		response = await getImages(requestId, { signal: options.signal });
	}
}

export async function waitForCoverImage(
	requestId: string,
	initialResponse: JourneyImageListApiResponse,
	options: CoverPollingOptions = {},
): Promise<JourneyImageApiResponse> {
	const response = await waitForJourneyImages(
		requestId,
		initialResponse,
		[{ ordinal: 1, purpose: "cover" }],
		options,
	);
	const cover = selectCoverImage(response.images);
	if (!cover) {
		throw new Error("表紙画像スロットが見つかりません。");
	}
	return cover;
}

type FlowState =
	| { readonly status: "idle" }
	| { readonly status: "submitting" }
	| {
			readonly imageSlots: readonly JourneyImageSlot[];
			readonly requestId: string;
			readonly status: "starting";
	  }
	| {
			readonly imageSlots: readonly JourneyImageSlot[];
			readonly imageStatus: JourneyImageStatus;
			readonly journeyId: string;
			readonly requestId: string;
			readonly status: "polling";
	  }
	| {
			readonly imageSlots: readonly JourneyImageSlot[];
			readonly imageId: string;
			readonly journeyId: string;
			readonly requestId: string;
			readonly status: "retrying";
	  }
	| {
			readonly imageSlots: readonly JourneyImageSlot[];
			readonly journeyId: string;
			readonly requestId: string;
			readonly status: "refreshing";
	  }
	| {
			readonly action?: "refresh-images" | "retry-image";
			readonly image?: JourneyImageApiResponse;
			readonly imageSlots?: readonly JourneyImageSlot[];
			readonly journeyId?: string;
			readonly message: string;
			readonly requestId?: string;
			readonly status: "error";
	  };

const fieldDefinitions: ReadonlyArray<{
	readonly autoComplete: string;
	readonly field: JourneyCreationFormField;
	readonly label: string;
	readonly required?: boolean;
	readonly type: "date" | "number" | "text";
}> = [
	{
		autoComplete: "address-level2",
		field: "departure_city",
		label: "出発都市",
		required: true,
		type: "text",
	},
	{
		autoComplete: "country-name",
		field: "departure_country",
		label: "出発国",
		required: true,
		type: "text",
	},
	{
		autoComplete: "address-level2",
		field: "destination_city",
		label: "目的地都市",
		required: true,
		type: "text",
	},
	{
		autoComplete: "country-name",
		field: "destination_country",
		label: "目的地国",
		type: "text",
	},
	{
		autoComplete: "off",
		field: "start_date",
		label: "開始日",
		required: true,
		type: "date",
	},
	{
		autoComplete: "off",
		field: "end_date",
		label: "終了日",
		required: true,
		type: "date",
	},
	{
		autoComplete: "off",
		field: "amount",
		label: "予算",
		required: true,
		type: "number",
	},
	{
		autoComplete: "off",
		field: "currency",
		label: "通貨",
		required: true,
		type: "text",
	},
];

function errorMessage(error: unknown): string {
	if (error instanceof CoverImageGenerationError) {
		return error.message;
	}
	if (error instanceof ApiError || error instanceof Error) {
		return error.message;
	}
	return "旅程の生成に失敗しました。時間をおいて再度お試しください。";
}

function statusMessage(flow: FlowState): string {
	switch (flow.status) {
		case "idle":
			return "条件を入力して、旅程と表紙・挿絵を作成します。";
		case "submitting":
			return "旅程リクエストを作成しています…";
		case "starting":
			return "旅程と表紙・挿絵の生成を開始しています…";
		case "polling":
			return flow.imageStatus === "pending"
				? "画像の生成待ちです…"
				: "画像を生成しています…";
		case "retrying":
			return "表紙画像の生成を再試行しています…";
		case "refreshing":
			return "表紙・挿絵の状態を確認しています…";
		case "error":
			return flow.message;
	}
}

export function JourneyCreationPage() {
	const navigate = useNavigate();
	const [values, setValues] = useState<JourneyCreationFormValues>(
		initialJourneyCreationFormValues,
	);
	const [errors, setErrors] = useState<JourneyCreationFormErrors>({});
	const [flow, setFlow] = useState<FlowState>({ status: "idle" });
	const controllerRef = useRef<AbortController | null>(null);
	const operationIdRef = useRef(0);
	const fieldRefs = useRef<
		Partial<Record<JourneyCreationFormField, HTMLInputElement | null>>
	>({});

	useEffect(() => {
		return () => {
			operationIdRef.current += 1;
			controllerRef.current?.abort();
		};
	}, []);

	const isBusy =
		flow.status === "submitting" ||
		flow.status === "starting" ||
		flow.status === "polling" ||
		flow.status === "retrying" ||
		flow.status === "refreshing";

	const updateValue = (field: JourneyCreationFormField, value: string) => {
		setValues((current) => ({ ...current, [field]: value }));
		setErrors((current) => {
			if (!current[field]) {
				return current;
			}
			const next = { ...current };
			delete next[field];
			return next;
		});
	};

	const startOperation = () => {
		controllerRef.current?.abort();
		const controller = new AbortController();
		const operationId = operationIdRef.current + 1;
		operationIdRef.current = operationId;
		controllerRef.current = controller;
		return { controller, operationId };
	};

	const isCurrentOperation = (
		operationId: number,
		controller: AbortController,
	): boolean =>
		operationIdRef.current === operationId && !controller.signal.aborted;

	const setFlowForOperation = (
		operationId: number,
		controller: AbortController,
		next: FlowState | ((current: FlowState) => FlowState),
	) => {
		setFlow((current) => {
			if (!isCurrentOperation(operationId, controller)) {
				return current;
			}
			return typeof next === "function" ? next(current) : next;
		});
	};

	const navigateToBooklet = (journeyId: string) => {
		navigate(`/journeys/${encodeURIComponent(journeyId)}/booklet`, {
			replace: true,
		});
	};

	const runImagePolling = async (
		requestId: string,
		journeyId: string,
		imageSlots: readonly JourneyImageSlot[],
		initialResponse: JourneyImageListApiResponse,
		controller: AbortController,
		operationId: number,
	) => {
		const imageResponse = await waitForJourneyImages(
			requestId,
			initialResponse,
			imageSlots,
			{
				onStatusChange: (imageStatus) => {
					if (!isCurrentOperation(operationId, controller)) {
						return;
					}
					setFlowForOperation(operationId, controller, (current) =>
						current.status === "polling" && current.requestId === requestId
							? { ...current, imageStatus }
							: current,
					);
				},
				signal: controller.signal,
			},
		);
		if (isCurrentOperation(operationId, controller)) {
			navigateToBooklet(journeyId);
		}
		return imageResponse;
	};

	const submitJourney = async (
		payload: ReturnType<typeof toJourneyRequestPayload>,
	) => {
		const { controller, operationId } = startOperation();
		setFlowForOperation(operationId, controller, { status: "submitting" });
		let requestId: string | undefined;
		let journeyId: string | undefined;
		let imageSlots: readonly JourneyImageSlot[] = [];

		try {
			const created = await createJourneyRequest(payload, {
				signal: controller.signal,
			});
			requestId = created.request_id;
			if (!isCurrentOperation(operationId, controller)) {
				return;
			}
			imageSlots = journeyImageSlotsForPeriod(
				payload.start_date,
				payload.end_date,
			);
			setFlowForOperation(operationId, controller, {
				imageSlots,
				requestId,
				status: "starting",
			});

			const imageResultPromise = requestJourneyImages(requestId, imageSlots, {
				signal: controller.signal,
			}).then(
				(value) => ({ status: "fulfilled" as const, value }),
				(reason) => ({ status: "rejected" as const, reason }),
			);
			const generated = await generateJourney(requestId, {
				signal: controller.signal,
			});
			if (!isCurrentOperation(operationId, controller)) {
				return;
			}
			journeyId = generated.journey_id;
			const imageResult = await imageResultPromise;
			if (imageResult.status === "rejected") {
				throw imageResult.reason;
			}
			const imageResponse = imageResult.value;

			setFlowForOperation(operationId, controller, {
				imageSlots,
				imageStatus: "pending",
				journeyId,
				requestId,
				status: "polling",
			});
			await runImagePolling(
				requestId,
				journeyId,
				imageSlots,
				imageResponse,
				controller,
				operationId,
			);
		} catch (error) {
			if (!isCurrentOperation(operationId, controller)) {
				return;
			}
			if (error instanceof CoverImageGenerationError) {
				setFlowForOperation(operationId, controller, {
					action: "retry-image",
					image: error.image,
					imageSlots,
					journeyId,
					message: error.message,
					requestId,
					status: "error",
				});
				return;
			}
			setFlowForOperation(operationId, controller, {
				action: requestId && journeyId ? "refresh-images" : undefined,
				journeyId,
				imageSlots: requestId && journeyId ? imageSlots : undefined,
				message:
					requestId === undefined
						? `${errorMessage(error)} 入力値は保持されています。再送すると新しい旅程リクエストになる可能性があります。`
						: errorMessage(error),
				requestId,
				status: "error",
			});
		}
	};

	const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const validationErrors = validateJourneyCreationForm(values);
		if (Object.keys(validationErrors).length > 0) {
			setErrors(validationErrors);
			const firstInvalidField = fieldDefinitions.find(
				({ field }) => validationErrors[field],
			)?.field;
			if (firstInvalidField) {
				fieldRefs.current[firstInvalidField]?.focus();
			}
			return;
		}

		try {
			const payload = toJourneyRequestPayload(values);
			setErrors({});
			void submitJourney(payload);
		} catch (error) {
			if (error instanceof JourneyCreationValidationError) {
				setErrors(error.fieldErrors);
				const firstInvalidField = fieldDefinitions.find(
					({ field }) => error.fieldErrors[field],
				)?.field;
				if (firstInvalidField) {
					fieldRefs.current[firstInvalidField]?.focus();
				}
				return;
			}
			setFlow({ message: errorMessage(error), status: "error" });
		}
	};

	const handleRetryImage = () => {
		if (
			flow.status !== "error" ||
			flow.action !== "retry-image" ||
			!flow.image ||
			!flow.requestId ||
			!flow.journeyId
		) {
			return;
		}

		const { image, journeyId, requestId } = flow;
		const imageSlots =
			flow.imageSlots ?? ([{ ordinal: 1, purpose: "cover" }] as const);
		const { controller, operationId } = startOperation();
		setFlowForOperation(operationId, controller, {
			imageSlots,
			imageId: image.id,
			journeyId,
			requestId,
			status: "retrying",
		});
		void (async () => {
			try {
				const retriedImage = await retryJourneyImage(image.id, {
					signal: controller.signal,
				});
				const imageResponse = await getJourneyImages(requestId, {
					signal: controller.signal,
				});
				const mergedImageResponse = {
					...imageResponse,
					images: imageResponse.images.some(
						(candidate) => candidate.id === retriedImage.id,
					)
						? imageResponse.images.map((candidate) =>
								candidate.id === retriedImage.id ? retriedImage : candidate,
							)
						: [retriedImage, ...imageResponse.images],
				};
				if (!isCurrentOperation(operationId, controller)) {
					return;
				}
				setFlowForOperation(operationId, controller, {
					imageSlots,
					imageStatus: imageStatusFor(mergedImageResponse.images, imageSlots),
					journeyId,
					requestId,
					status: "polling",
				});
				await runImagePolling(
					requestId,
					journeyId,
					imageSlots,
					mergedImageResponse,
					controller,
					operationId,
				);
			} catch (error) {
				if (!isCurrentOperation(operationId, controller)) {
					return;
				}
				setFlowForOperation(operationId, controller, {
					imageSlots,
					action:
						error instanceof CoverImageGenerationError
							? "retry-image"
							: "refresh-images",
					image:
						error instanceof CoverImageGenerationError ? error.image : image,
					journeyId,
					message: errorMessage(error),
					requestId,
					status: "error",
				});
			}
		})();
	};

	const handleRefreshImages = () => {
		if (
			flow.status !== "error" ||
			flow.action !== "refresh-images" ||
			!flow.requestId ||
			!flow.journeyId
		) {
			return;
		}

		const { journeyId, requestId } = flow;
		const imageSlots =
			flow.imageSlots ?? ([{ ordinal: 1, purpose: "cover" }] as const);
		const { controller, operationId } = startOperation();
		setFlowForOperation(operationId, controller, {
			imageSlots,
			journeyId,
			requestId,
			status: "refreshing",
		});
		void (async () => {
			try {
				const imageResponse = await requestJourneyImages(
					requestId,
					imageSlots,
					{ signal: controller.signal },
				);
				if (!isCurrentOperation(operationId, controller)) {
					return;
				}
				setFlowForOperation(operationId, controller, {
					imageStatus: imageStatusFor(imageResponse.images, imageSlots),
					imageSlots,
					journeyId,
					requestId,
					status: "polling",
				});
				await runImagePolling(
					requestId,
					journeyId,
					imageSlots,
					imageResponse,
					controller,
					operationId,
				);
			} catch (error) {
				if (!isCurrentOperation(operationId, controller)) {
					return;
				}
				if (error instanceof CoverImageGenerationError) {
					setFlowForOperation(operationId, controller, {
						action: "retry-image",
						image: error.image,
						imageSlots,
						journeyId,
						message: error.message,
						requestId,
						status: "error",
					});
					return;
				}
				setFlowForOperation(operationId, controller, {
					action: "refresh-images",
					journeyId,
					imageSlots,
					message: errorMessage(error),
					requestId,
					status: "error",
				});
			}
		})();
	};

	return (
		<main className="journey-creation-shell">
			<header className="journey-creation-hero">
				<h1>
					<span>あなたも知らない、</span>
					<br />
					<span>旅をつくる</span>
				</h1>
				<p>
					行き先と日程を預けると、あなただけの旅程と表紙・挿絵を仕立てます。
				</p>
			</header>

			<section className="journey-creation-route" aria-label="旅程のルート">
				<div className="journey-creation-route__stop">
					<span>FROM</span>
					<strong>{values.departure_city.trim() || "出発地"}</strong>
				</div>
				<div className="journey-creation-route__line" aria-hidden="true">
					<i />
				</div>
				<div className="journey-creation-route__stop journey-creation-route__stop--destination">
					<span>TO</span>
					<strong>{values.destination_city.trim() || "目的地"}</strong>
				</div>
			</section>

			<form
				className="journey-creation-form"
				noValidate
				onSubmit={handleSubmit}
			>
				<div className="journey-creation-form__section">
					<div className="journey-creation-form__section-heading">
						<p className="journey-creation-form__eyebrow">ROUTE</p>
						<h2>どこへ行きますか？</h2>
					</div>
					<div className="journey-creation-form__grid journey-creation-form__grid--route">
						{fieldDefinitions
							.slice(0, 4)
							.map(({ field, label, required, type, autoComplete }) => {
								const error = errors[field];
								return (
									<label
										className="journey-field"
										htmlFor={`journey-${field}`}
										key={field}
									>
										<span className="journey-field__label">
											{label}
											{required ? (
												<em aria-hidden="true">必須</em>
											) : (
												<small aria-hidden="true">任意</small>
											)}
										</span>
										<input
											ref={(element) => {
												fieldRefs.current[field] = element;
											}}
											id={`journey-${field}`}
											name={field}
											autoComplete={autoComplete}
											aria-describedby={
												error ? `journey-${field}-error` : undefined
											}
											aria-invalid={error ? "true" : undefined}
											required={required}
											type={type}
											value={values[field]}
											onChange={(event) =>
												updateValue(field, event.target.value)
											}
										/>
										{error ? (
											<span
												className="journey-field__error"
												id={`journey-${field}-error`}
												role="alert"
											>
												{error}
											</span>
										) : null}
									</label>
								);
							})}
					</div>
				</div>

				<div className="journey-creation-form__section">
					<div className="journey-creation-form__section-heading">
						<p className="journey-creation-form__eyebrow">
							WHEN &amp; HOW MUCH
						</p>
						<h2>旅の輪郭を決める</h2>
					</div>
					<div className="journey-creation-form__grid journey-creation-form__grid--details">
						{fieldDefinitions
							.slice(4)
							.map(({ field, label, required, type, autoComplete }) => {
								const error = errors[field];
								return (
									<label
										className="journey-field"
										htmlFor={`journey-${field}`}
										key={field}
									>
										<span className="journey-field__label">
											{label}
											{required ? (
												<em aria-hidden="true">必須</em>
											) : (
												<small aria-hidden="true">任意</small>
											)}
										</span>
										<input
											ref={(element) => {
												fieldRefs.current[field] = element;
											}}
											id={`journey-${field}`}
											name={field}
											autoComplete={autoComplete}
											aria-describedby={
												error ? `journey-${field}-error` : undefined
											}
											aria-invalid={error ? "true" : undefined}
											inputMode={field === "amount" ? "numeric" : undefined}
											maxLength={field === "currency" ? 3 : undefined}
											min={field === "amount" ? 1 : undefined}
											required={required}
											step={field === "amount" ? 1 : undefined}
											type={type}
											value={values[field]}
											onChange={(event) =>
												updateValue(field, event.target.value)
											}
										/>
										{error ? (
											<span
												className="journey-field__error"
												id={`journey-${field}-error`}
												role="alert"
											>
												{error}
											</span>
										) : null}
									</label>
								);
							})}
					</div>
				</div>

				<div className="journey-creation-form__footer">
					<p>
						送信後、旅程と表紙・挿絵画像の準備が整うまでこの画面でお待ちください。
					</p>
					<button type="submit" disabled={isBusy}>
						{isBusy ? "旅を仕立てています…" : "旅程を生成する"}
					</button>
				</div>
			</form>

			<section
				className="journey-creation-status"
				aria-live="polite"
				role="status"
			>
				<p className="journey-creation-status__eyebrow">STATUS</p>
				<p>{statusMessage(flow)}</p>
				{flow.status === "error" && flow.action === "retry-image" ? (
					<button type="button" onClick={handleRetryImage}>
						表紙画像を再試行
					</button>
				) : null}
				{flow.status === "error" && flow.action === "refresh-images" ? (
					<button type="button" onClick={handleRefreshImages}>
						画像状態を再確認
					</button>
				) : null}
			</section>
		</main>
	);
}
