import {
	type ApiRequestOptions,
	ApiResponseError,
	readArray,
	readInteger,
	readNonEmptyString,
	readRecord,
	readRfc3339,
	readString,
	requestJson,
} from "./client";

export type GenerateJourneyApiResponse = {
	readonly journey_id: string;
};

export type EndpointApiResponse = {
	readonly label: string;
	readonly spot_id?: string;
};

export type MoneyApiResponse = {
	readonly amount: number;
	readonly currency: string;
};

export type SpotApiResponse = {
	readonly id: string;
	readonly name: string;
	readonly description: string;
	readonly start_at: string;
	readonly estimated_cost: MoneyApiResponse;
};

export type LegApiResponse = {
	readonly id: string;
	readonly from: EndpointApiResponse;
	readonly to: EndpointApiResponse;
	readonly mode: string;
	readonly duration_minutes: number;
	readonly estimated_cost: MoneyApiResponse;
};

export type ItineraryDayApiResponse = {
	readonly id: string;
	readonly date: string;
	readonly spots: readonly SpotApiResponse[];
	readonly legs: readonly LegApiResponse[];
};

export type JourneyApiResponse = {
	readonly id: string;
	readonly request_id: string;
	readonly day_count: number;
	readonly days: readonly ItineraryDayApiResponse[];
};

function decodeMoney(value: unknown, context: string): MoneyApiResponse {
	const record = readRecord(value, context);
	return {
		amount: readInteger(record, "amount", context),
		currency: readNonEmptyString(record, "currency", context),
	};
}

function decodeEndpoint(value: unknown, context: string): EndpointApiResponse {
	const record = readRecord(value, context);
	const spotId = record.spot_id;
	if (spotId !== undefined && typeof spotId !== "string") {
		throw new ApiResponseError(
			`${context}.spot_idは文字列である必要があります。`,
		);
	}

	return {
		label: readNonEmptyString(record, "label", context),
		...(spotId === undefined ? {} : { spot_id: spotId }),
	};
}

function decodeSpot(value: unknown, context: string): SpotApiResponse {
	const record = readRecord(value, context);
	return {
		description: readString(record, "description", context),
		estimated_cost: decodeMoney(
			record.estimated_cost,
			`${context}.estimated_cost`,
		),
		id: readNonEmptyString(record, "id", context),
		name: readNonEmptyString(record, "name", context),
		start_at: readRfc3339(record, "start_at", context),
	};
}

function decodeLeg(value: unknown, context: string): LegApiResponse {
	const record = readRecord(value, context);
	return {
		duration_minutes: readInteger(record, "duration_minutes", context, {
			min: 0,
		}),
		estimated_cost: decodeMoney(
			record.estimated_cost,
			`${context}.estimated_cost`,
		),
		from: decodeEndpoint(record.from, `${context}.from`),
		id: readNonEmptyString(record, "id", context),
		mode: readNonEmptyString(record, "mode", context),
		to: decodeEndpoint(record.to, `${context}.to`),
	};
}

function decodeDay(value: unknown, index: number): ItineraryDayApiResponse {
	const context = `days[${index}]`;
	const record = readRecord(value, context);
	return {
		date: readRfc3339(record, "date", context),
		id: readNonEmptyString(record, "id", context),
		legs: readArray(record.legs, `${context}.legs`).map((leg, legIndex) =>
			decodeLeg(leg, `${context}.legs[${legIndex}]`),
		),
		spots: readArray(record.spots, `${context}.spots`).map((spot, spotIndex) =>
			decodeSpot(spot, `${context}.spots[${spotIndex}]`),
		),
	};
}

export function decodeJourney(value: unknown): JourneyApiResponse {
	const record = readRecord(value, "journey");
	return {
		day_count: readInteger(record, "day_count", "journey", { min: 0 }),
		days: readArray(record.days, "journey.days").map(decodeDay),
		id: readNonEmptyString(record, "id", "journey"),
		request_id: readNonEmptyString(record, "request_id", "journey"),
	};
}

export function getJourney(
	journeyId: string,
	options: ApiRequestOptions = {},
): Promise<JourneyApiResponse> {
	return requestJson(
		`/api/v1/journeys/${encodeURIComponent(journeyId)}`,
		decodeJourney,
		options,
	);
}

export function decodeGenerateJourneyResponse(
	value: unknown,
): GenerateJourneyApiResponse {
	const record = readRecord(value, "generate journey");
	const journeyId = readNonEmptyString(
		record,
		"journey_id",
		"generate journey",
	);
	return { journey_id: journeyId };
}

export function generateJourney(
	requestId: string,
	options: ApiRequestOptions = {},
): Promise<GenerateJourneyApiResponse> {
	return requestJson(
		`/api/v1/journey-requests/${encodeURIComponent(requestId)}/generate`,
		decodeGenerateJourneyResponse,
		{
			...options,
			method: "POST",
		},
	);
}

export const decodeGenerateJourney = decodeGenerateJourneyResponse;
