import {
	type ApiRequestOptions,
	ApiResponseError,
	readArray,
	readInteger,
	readNonEmptyString,
	readNullableInteger,
	readNullableString,
	readRecord,
	requestJson,
} from "./client";

export type JourneyImageStatus = "pending" | "processing" | "ready" | "failed";

export type JourneyImagePurpose = "cover" | "illustration";

export type JourneyImageSlot = {
	readonly ordinal: number;
	readonly purpose: JourneyImagePurpose;
};

export type JourneyImageApiResponse = {
	readonly id: string;
	readonly slot: {
		readonly purpose: string;
		readonly ordinal: number;
	};
	readonly status: JourneyImageStatus;
	readonly attempt_count: number;
	readonly content_url: string | null;
	readonly media_type: string | null;
	readonly width: number | null;
	readonly height: number | null;
	readonly failure_code: string | null;
	readonly visual_style: string | null;
};

export type JourneyImageListApiResponse = {
	readonly journey_request_id: string;
	readonly images: readonly JourneyImageApiResponse[];
};

export type JourneyImagesRequestPayload = {
	readonly slots: readonly JourneyImageSlot[];
};

export type CoverImageRequestPayload = {
	readonly slots: readonly [{ readonly purpose: "cover"; readonly ordinal: 1 }];
};

function decodeStatus(value: unknown, context: string): JourneyImageStatus {
	if (
		value !== "pending" &&
		value !== "processing" &&
		value !== "ready" &&
		value !== "failed"
	) {
		throw new ApiResponseError(`${context}.statusが未知の値です。`);
	}

	return value;
}

export function decodeJourneyImage(
	value: unknown,
	index = 0,
): JourneyImageApiResponse {
	const context = `images[${index}]`;
	const record = readRecord(value, context);
	const slot = readRecord(record.slot, `${context}.slot`);
	return {
		attempt_count: readInteger(record, "attempt_count", context, { min: 0 }),
		content_url: readNullableString(record, "content_url", context),
		failure_code: readNullableString(record, "failure_code", context),
		height: readNullableInteger(record, "height", context),
		id: readNonEmptyString(record, "id", context),
		media_type: readNullableString(record, "media_type", context),
		slot: {
			ordinal: readInteger(slot, "ordinal", `${context}.slot`, { min: 1 }),
			purpose: readNonEmptyString(slot, "purpose", `${context}.slot`),
		},
		status: decodeStatus(record.status, context),
		visual_style: readNullableString(record, "visual_style", context),
		width: readNullableInteger(record, "width", context),
	};
}

export function decodeJourneyImageList(
	value: unknown,
): JourneyImageListApiResponse {
	const record = readRecord(value, "journey image list");
	return {
		images: readArray(record.images, "journey image list.images").map(
			(value, index) => decodeJourneyImage(value, index),
		),
		journey_request_id: readNonEmptyString(
			record,
			"journey_request_id",
			"journey image list",
		),
	};
}

export function getJourneyImages(
	requestId: string,
	options: ApiRequestOptions = {},
): Promise<JourneyImageListApiResponse> {
	return requestJson(
		`/api/v1/journey-requests/${encodeURIComponent(requestId)}/images`,
		decodeJourneyImageList,
		options,
	);
}

export function selectCoverImage(
	images: readonly JourneyImageApiResponse[],
): JourneyImageApiResponse | null {
	const covers = images.filter(
		(image) => image.slot.purpose === "cover" && image.slot.ordinal === 1,
	);
	if (covers.length > 1) {
		throw new ApiResponseError("表紙画像スロットが複数存在します。");
	}

	return covers[0] ?? null;
}

export function selectIllustrations(
	images: readonly JourneyImageApiResponse[],
): readonly JourneyImageApiResponse[] {
	const illustrations = images.filter(
		(image) => image.slot.purpose === "illustration",
	);
	const seenOrdinals = new Set<number>();
	for (const image of illustrations) {
		if (image.slot.ordinal < 1 || image.slot.ordinal > 3) {
			throw new ApiResponseError("挿絵画像スロットの序数が不正です。");
		}
		if (seenOrdinals.has(image.slot.ordinal)) {
			throw new ApiResponseError("挿絵画像スロットが重複しています。");
		}
		seenOrdinals.add(image.slot.ordinal);
	}

	return [...illustrations].sort(
		(left, right) => left.slot.ordinal - right.slot.ordinal,
	);
}

export function requestJourneyImages(
	requestId: string,
	slots: readonly JourneyImageSlot[],
	options: ApiRequestOptions = {},
): Promise<JourneyImageListApiResponse> {
	return requestJson(
		`/api/v1/journey-requests/${encodeURIComponent(requestId)}/images`,
		decodeJourneyImageList,
		{
			...options,
			body: { slots },
			method: "POST",
		},
	);
}

export function requestCoverImage(
	requestId: string,
	options: ApiRequestOptions = {},
): Promise<JourneyImageListApiResponse> {
	return requestJourneyImages(
		requestId,
		[{ ordinal: 1, purpose: "cover" }],
		options,
	);
}

export function retryJourneyImage(
	imageId: string,
	options: ApiRequestOptions = {},
): Promise<JourneyImageApiResponse> {
	return requestJson(
		`/api/v1/journey-images/${encodeURIComponent(imageId)}/retry`,
		decodeJourneyImage,
		{
			...options,
			method: "POST",
		},
	);
}
