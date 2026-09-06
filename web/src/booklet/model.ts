import type { JourneyRequestApiResponse } from "../api/journeyRequests";
import type {
	EndpointApiResponse,
	JourneyApiResponse,
	MoneyApiResponse,
	SpotApiResponse,
} from "../api/journeys";
import type { CoverVisualStyle } from "../theme/types";

export type BookletMoney = MoneyApiResponse;

export type BookletEndpoint = EndpointApiResponse;

export type BookletSpot = Pick<
	SpotApiResponse,
	"description" | "estimated_cost" | "name" | "start_at"
> & {
	readonly id: string;
};

export type BookletLeg = {
	readonly estimated_cost: BookletMoney;
	readonly from: BookletEndpoint;
	readonly id: string;
	readonly mode: string;
	readonly duration_minutes: number;
	readonly to: BookletEndpoint;
};

export type ArrivalUnit = {
	readonly id: string;
	readonly leg: BookletLeg;
	readonly spot: BookletSpot;
};

export type BookletDay = {
	readonly date: string;
	readonly dayNumber: number;
	readonly id: string;
	readonly units: readonly ArrivalUnit[];
};

export type CoverImage = {
	readonly contentUrl: string;
	readonly height: number;
	readonly mediaType: string;
	readonly visualStyle: CoverVisualStyle | null;
	readonly width: number;
};

export type BookletCover = {
	readonly budget: BookletMoney;
	readonly destination: string;
	readonly departure: string;
	readonly image: CoverImage;
	readonly period: JourneyRequestApiResponse["period"];
};

export type BookletModel = {
	readonly cover: BookletCover;
	readonly days: readonly BookletDay[];
	readonly journeyId: JourneyApiResponse["id"];
};

export type CoverPagePlan = {
	readonly kind: "cover";
	readonly pageId: string;
};

export type DayPagePlan = {
	readonly continuation: boolean;
	readonly dayIndex: number;
	readonly kind: "day";
	readonly pageId: string;
	readonly unitIndexes: readonly number[];
};

export type BookletPagePlan = CoverPagePlan | DayPagePlan;
