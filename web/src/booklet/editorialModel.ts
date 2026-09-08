import type { BookletImage, BookletModel, BookletMoney } from "./model";

export const EDITORIAL_POLICY_IDS = [
	"legacy-full",
	"timetable",
	"captions",
	"route",
] as const;

export type PolicyId = (typeof EDITORIAL_POLICY_IDS)[number];

export type EditorialCover = {
	readonly budget: BookletMoney | null;
	readonly image: BookletImage;
	readonly period: BookletModel["cover"]["period"];
	readonly route: EditorialRoute | null;
	readonly title: string;
};

export type EditorialRoute = {
	readonly from: string;
	readonly to: string;
};

export type EditorialArrivalUnit = {
	readonly description: string | null;
	readonly durationMinutes: number | null;
	readonly id: string;
	readonly legId: string;
	readonly route: EditorialRoute | null;
	readonly spotId: string;
	readonly spotName: string;
	readonly startAt: string;
	readonly stayCost: BookletMoney | null;
	readonly timeLabel: string;
	readonly transportCost: BookletMoney | null;
	readonly transportMode: string | null;
};

export type EditorialDay = {
	readonly date: string;
	readonly dayNumber: number;
	readonly id: string;
	readonly illustration: BookletImage | null;
	readonly units: readonly EditorialArrivalUnit[];
};

export type EditorialBooklet = {
	readonly cover: EditorialCover;
	readonly days: readonly EditorialDay[];
	readonly journeyId: BookletModel["journeyId"];
	readonly policyId: PolicyId;
};
