import {
	type ApiRequestOptions,
	ApiResponseError,
	readInteger,
	readNonEmptyString,
	readRecord,
	readRfc3339,
	readString,
	requestJson,
} from "./client";
import type { MoneyApiResponse } from "./journeys";

export type CreateJourneyRequestPayload = {
	readonly departure_city: string;
	readonly departure_country: string;
	readonly destination_city: string;
	readonly destination_country: string;
	readonly start_date: string;
	readonly end_date: string;
	readonly amount: number;
	readonly currency: string;
};

export type CreateJourneyRequestApiResponse = {
	readonly request_id: string;
};

type JourneyRequestPlaceFields =
	| {
			readonly departure_city: string;
			readonly departure_country: string;
			readonly destination_city: string;
			readonly destination_country: string;
	  }
	| {
			readonly departure_city?: never;
			readonly departure_country?: never;
			readonly destination_city?: never;
			readonly destination_country?: never;
	  };

export type JourneyRequestApiResponse = JourneyRequestPlaceFields & {
	readonly id: string;
	readonly departure: string;
	readonly destination: string;
	readonly period: {
		readonly start_date: string;
		readonly end_date: string;
	};
	readonly budget: MoneyApiResponse;
};

const placeFieldNames = [
	"departure_city",
	"departure_country",
	"destination_city",
	"destination_country",
] as const;

function decodePlaceFields(
	record: Record<string, unknown>,
): JourneyRequestPlaceFields {
	const presentFieldCount = placeFieldNames.filter((fieldName) =>
		Object.hasOwn(record, fieldName),
	).length;
	if (presentFieldCount === 0) {
		return {};
	}
	if (presentFieldCount !== placeFieldNames.length) {
		throw new ApiResponseError(
			"journey requestの地名構成要素はすべて必要です。",
		);
	}

	return {
		departure_city: readNonEmptyString(
			record,
			"departure_city",
			"journey request",
		),
		departure_country: readString(
			record,
			"departure_country",
			"journey request",
		),
		destination_city: readNonEmptyString(
			record,
			"destination_city",
			"journey request",
		),
		destination_country: readString(
			record,
			"destination_country",
			"journey request",
		),
	};
}

function decodeMoney(value: unknown, context: string): MoneyApiResponse {
	const record = readRecord(value, context);
	return {
		amount: readInteger(record, "amount", context),
		currency: readNonEmptyString(record, "currency", context),
	};
}

export function decodeCreateJourneyRequest(
	value: unknown,
): CreateJourneyRequestApiResponse {
	const record = readRecord(value, "create journey request");
	return {
		request_id: readNonEmptyString(
			record,
			"request_id",
			"create journey request",
		),
	};
}

export function decodeJourneyRequest(
	value: unknown,
): JourneyRequestApiResponse {
	const record = readRecord(value, "journey request");
	const period = readRecord(record.period, "journey request.period");
	return {
		...decodePlaceFields(record),
		budget: decodeMoney(record.budget, "journey request.budget"),
		departure: readNonEmptyString(record, "departure", "journey request"),
		destination: readNonEmptyString(record, "destination", "journey request"),
		id: readNonEmptyString(record, "id", "journey request"),
		period: {
			end_date: readRfc3339(period, "end_date", "journey request.period"),
			start_date: readRfc3339(period, "start_date", "journey request.period"),
		},
	};
}

export function getJourneyRequest(
	requestId: string,
	options: ApiRequestOptions = {},
): Promise<JourneyRequestApiResponse> {
	return requestJson(
		`/api/v1/journey-requests/${encodeURIComponent(requestId)}`,
		decodeJourneyRequest,
		options,
	);
}

export function createJourneyRequest(
	payload: CreateJourneyRequestPayload,
	options: ApiRequestOptions = {},
): Promise<CreateJourneyRequestApiResponse> {
	return requestJson("/api/v1/journey-requests", decodeCreateJourneyRequest, {
		...options,
		body: payload,
		method: "POST",
	});
}

export const decodeCreateJourneyRequestResponse = decodeCreateJourneyRequest;
