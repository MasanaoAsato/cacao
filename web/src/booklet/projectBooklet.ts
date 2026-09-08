import { formatBookletDateTime, formatBookletTime } from "./dateFormat";
import type {
	EditorialArrivalUnit,
	EditorialBooklet,
	EditorialRoute,
	PolicyId,
} from "./editorialModel";
import { BookletDataError } from "./fromJourney";
import type { ArrivalUnit, BookletModel } from "./model";

const CAPTION_TERMINATORS = new Set(["。", "！", "？", "!", "?"]);
const MAX_CAPTION_CODE_POINTS = 80;

function requirePolicy(policyId: string): asserts policyId is PolicyId {
	if (
		policyId !== "legacy-full" &&
		policyId !== "timetable" &&
		policyId !== "captions" &&
		policyId !== "route"
	) {
		throw new BookletDataError(`未登録の掲載方針です: ${policyId}`);
	}
}

function extractCaption(description: string): string | null {
	const trimmed = description.trim();
	if (trimmed.length === 0) {
		return null;
	}

	const characters = Array.from(trimmed);
	const terminatorIndex = characters.findIndex((character) =>
		CAPTION_TERMINATORS.has(character),
	);
	const end =
		terminatorIndex === -1
			? MAX_CAPTION_CODE_POINTS
			: Math.min(terminatorIndex + 1, MAX_CAPTION_CODE_POINTS);
	return characters.slice(0, end).join("");
}

function routeFor(unit: ArrivalUnit): EditorialRoute {
	return { from: unit.leg.from.label, to: unit.leg.to.label };
}

function projectUnit(
	unit: ArrivalUnit,
	policyId: PolicyId,
): EditorialArrivalUnit {
	const legacy = policyId === "legacy-full";
	const showsTransport =
		policyId === "legacy-full" ||
		policyId === "timetable" ||
		policyId === "route";
	const showsCosts = policyId === "legacy-full" || policyId === "timetable";

	return {
		description: legacy
			? unit.spot.description.trim().length === 0
				? null
				: unit.spot.description
			: policyId === "captions"
				? extractCaption(unit.spot.description)
				: null,
		durationMinutes: showsTransport ? unit.leg.duration_minutes : null,
		id: unit.id,
		legId: unit.leg.id,
		route: legacy ? routeFor(unit) : null,
		spotId: unit.spot.id,
		spotName: unit.spot.name,
		startAt: unit.spot.start_at,
		stayCost: showsCosts ? unit.spot.estimated_cost : null,
		timeLabel: legacy
			? formatBookletDateTime(unit.spot.start_at)
			: formatBookletTime(unit.spot.start_at),
		transportCost: showsCosts ? unit.leg.estimated_cost : null,
		transportMode: showsTransport ? unit.leg.mode : null,
	};
}

export function projectBooklet(
	model: BookletModel,
	policyId: PolicyId,
): EditorialBooklet {
	requirePolicy(policyId);
	const legacy = policyId === "legacy-full";
	const title = legacy
		? model.cover.destination
		: (model.cover.destinationPlace?.city ?? model.cover.destination);

	return {
		cover: {
			budget: legacy ? model.cover.budget : null,
			image: model.cover.image,
			period: model.cover.period,
			route: legacy
				? { from: model.cover.departure, to: model.cover.destination }
				: null,
			title,
		},
		days: model.days.map((day) => ({
			date: day.date,
			dayNumber: day.dayNumber,
			id: day.id,
			illustration: day.illustration,
			units: day.units.map((unit) => projectUnit(unit, policyId)),
		})),
		journeyId: model.journeyId,
		policyId,
	};
}
