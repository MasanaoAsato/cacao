import { isRfc3339 } from "../api/client";
import type {
	JourneyImageApiResponse,
	JourneyImageStatus,
} from "../api/journeyImages";
import type { JourneyRequestApiResponse } from "../api/journeyRequests";
import type {
	EndpointApiResponse,
	JourneyApiResponse,
	LegApiResponse,
	SpotApiResponse,
} from "../api/journeys";
import type {
	ArrivalUnit,
	BookletDay,
	BookletEndpoint,
	BookletLeg,
	BookletModel,
	BookletSpot,
	CoverImage,
} from "./model";

export class BookletDataError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "BookletDataError";
	}
}

export class CoverImageNotReadyError extends BookletDataError {
	constructor(status?: JourneyImageStatus) {
		super(
			status === "failed"
				? "表紙画像の生成に失敗しています。"
				: "表紙画像がまだ準備できていません。",
		);
		this.name = "CoverImageNotReadyError";
	}
}

function requireNonEmpty(value: string, name: string): string {
	if (value.trim().length === 0) {
		throw new BookletDataError(`${name}が空です。`);
	}

	return value;
}

function requireDateTime(value: string, name: string): string {
	if (!isRfc3339(value)) {
		throw new BookletDataError(`${name}がRFC 3339日時ではありません。`);
	}

	return value;
}

function requireMoney(
	value: { readonly amount: number; readonly currency: string },
	name: string,
) {
	if (!Number.isInteger(value.amount) || value.amount < 0) {
		throw new BookletDataError(`${name}.amountが不正です。`);
	}
	requireNonEmpty(value.currency, `${name}.currency`);
	return value;
}

function requireEndpoint(
	endpoint: EndpointApiResponse,
	name: string,
): BookletEndpoint {
	const label = requireNonEmpty(endpoint.label, `${name}.label`);
	if (endpoint.spot_id !== undefined) {
		requireNonEmpty(endpoint.spot_id, `${name}.spot_id`);
	}

	return {
		label,
		...(endpoint.spot_id === undefined ? {} : { spot_id: endpoint.spot_id }),
	};
}

function convertSpot(spot: SpotApiResponse, name: string): BookletSpot {
	return {
		description: spot.description,
		estimated_cost: requireMoney(spot.estimated_cost, `${name}.estimated_cost`),
		id: requireNonEmpty(spot.id, `${name}.id`),
		name: requireNonEmpty(spot.name, `${name}.name`),
		start_at: requireDateTime(spot.start_at, `${name}.start_at`),
	};
}

function convertLeg(leg: LegApiResponse, name: string): BookletLeg {
	if (!Number.isInteger(leg.duration_minutes) || leg.duration_minutes < 0) {
		throw new BookletDataError(`${name}.duration_minutesが不正です。`);
	}

	return {
		duration_minutes: leg.duration_minutes,
		estimated_cost: requireMoney(leg.estimated_cost, `${name}.estimated_cost`),
		from: requireEndpoint(leg.from, `${name}.from`),
		id: requireNonEmpty(leg.id, `${name}.id`),
		mode: requireNonEmpty(leg.mode, `${name}.mode`),
		to: requireEndpoint(leg.to, `${name}.to`),
	};
}

function requireUnique(ids: readonly string[], name: string): void {
	const seen = new Set<string>();
	for (const id of ids) {
		if (seen.has(id)) {
			throw new BookletDataError(`${name}に重複した識別子があります。`);
		}
		seen.add(id);
	}
}

function convertDay(
	day: JourneyApiResponse["days"][number],
	dayIndex: number,
): BookletDay {
	const dayName = `days[${dayIndex}]`;
	const date = requireDateTime(day.date, `${dayName}.date`);
	if (day.spots.length !== day.legs.length) {
		throw new BookletDataError(`${dayName}のSpotとLegの件数が一致しません。`);
	}

	const dayId = requireNonEmpty(day.id, `${dayName}.id`);
	const spots = day.spots.map((spot, spotIndex) =>
		convertSpot(spot, `${dayName}.spots[${spotIndex}]`),
	);
	const legs = day.legs.map((leg, legIndex) =>
		convertLeg(leg, `${dayName}.legs[${legIndex}]`),
	);
	requireUnique(
		spots.map((spot) => spot.id),
		`${dayName}.spots`,
	);
	requireUnique(
		legs.map((leg) => leg.id),
		`${dayName}.legs`,
	);

	const units: ArrivalUnit[] = spots.map((spot, spotIndex) => {
		const leg = legs[spotIndex];
		if (!leg || leg.to.spot_id !== spot.id) {
			throw new BookletDataError(
				`${dayName}.legs[${spotIndex}].toとspots[${spotIndex}]の対応が不正です。`,
			);
		}

		return {
			id: `${leg.id}:${spot.id}`,
			leg,
			spot,
		};
	});

	return { date, dayNumber: dayIndex + 1, id: dayId, units };
}

function convertCoverImage(image: JourneyImageApiResponse): CoverImage {
	if (image.status !== "ready") {
		throw new CoverImageNotReadyError(image.status);
	}
	if (
		image.content_url === null ||
		image.media_type === null ||
		image.width === null ||
		image.height === null
	) {
		throw new BookletDataError("readyの表紙画像に必要な情報がありません。");
	}
	if (!/^image\/[a-z0-9.+-]+$/i.test(image.media_type)) {
		throw new BookletDataError("表紙画像のメディア型が画像ではありません。");
	}
	if (!isExpectedContentUrl(image)) {
		throw new BookletDataError("表紙画像のURLが不正です。");
	}
	if (
		!Number.isInteger(image.width) ||
		image.width <= 0 ||
		!Number.isInteger(image.height) ||
		image.height <= 0
	) {
		throw new BookletDataError("表紙画像の寸法が不正です。");
	}

	return {
		contentUrl: image.content_url,
		height: image.height,
		mediaType: image.media_type,
		width: image.width,
	};
}

function isExpectedContentUrl(image: JourneyImageApiResponse): boolean {
	return (
		image.content_url ===
		`/api/v1/journey-images/${encodeURIComponent(image.id)}/content`
	);
}

export function createBookletModel(input: {
	readonly coverImage: JourneyImageApiResponse | null;
	readonly journey: JourneyApiResponse;
	readonly request: JourneyRequestApiResponse;
}): BookletModel {
	const { coverImage, journey, request } = input;
	const journeyId = requireNonEmpty(journey.id, "journey.id");
	const journeyRequestId = requireNonEmpty(
		journey.request_id,
		"journey.request_id",
	);
	const requestId = requireNonEmpty(request.id, "journey request.id");
	if (journeyRequestId !== requestId) {
		throw new BookletDataError("旅程と旅程リクエストの識別子が一致しません。");
	}
	if (!Number.isInteger(journey.day_count) || journey.day_count < 0) {
		throw new BookletDataError("journey.day_countが不正です。");
	}
	if (journey.day_count !== journey.days.length) {
		throw new BookletDataError("journey.day_countとdaysの件数が一致しません。");
	}

	const period = {
		end_date: requireDateTime(
			request.period.end_date,
			"journey request.period.end_date",
		),
		start_date: requireDateTime(
			request.period.start_date,
			"journey request.period.start_date",
		),
	};
	if (Date.parse(period.start_date) > Date.parse(period.end_date)) {
		throw new BookletDataError("旅程リクエストの期間が逆順です。");
	}

	const days = journey.days.map(convertDay);
	requireUnique(
		days.map((day) => day.id),
		"journey.days",
	);
	const image = coverImage ? convertCoverImage(coverImage) : null;
	if (image === null) {
		throw new CoverImageNotReadyError();
	}

	return {
		cover: {
			budget: requireMoney(request.budget, "journey request.budget"),
			destination: requireNonEmpty(
				request.destination,
				"journey request.destination",
			),
			departure: requireNonEmpty(
				request.departure,
				"journey request.departure",
			),
			image,
			period,
		},
		days,
		journeyId,
	};
}
