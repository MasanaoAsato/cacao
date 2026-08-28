import {
	type ApiRequestOptions,
	readInteger,
	readNonEmptyString,
	readRecord,
	readRfc3339,
	requestJson,
} from "./client";
import type { MoneyApiResponse } from "./journeys";

export type JourneyRequestApiResponse = {
	readonly id: string;
	readonly departure: string;
	readonly destination: string;
	readonly period: {
		readonly start_date: string;
		readonly end_date: string;
	};
	readonly budget: MoneyApiResponse;
};

function decodeMoney(value: unknown, context: string): MoneyApiResponse {
	const record = readRecord(value, context);
	return {
		amount: readInteger(record, "amount", context),
		currency: readNonEmptyString(record, "currency", context),
	};
}

export function decodeJourneyRequest(
	value: unknown,
): JourneyRequestApiResponse {
	const record = readRecord(value, "journey request");
	const period = readRecord(record.period, "journey request.period");
	return {
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
