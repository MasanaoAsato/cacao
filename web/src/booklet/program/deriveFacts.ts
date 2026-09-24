import type {
	ArrivalUnit,
	BookletDay,
	BookletModel,
	BookletMoney,
} from "../model";

export type SeasonalMotif = "autumn" | "spring" | "summer" | "winter";
export type TimeOfDay = "afternoon" | "evening" | "morning" | "night";
export type EntryCategory = "transport" | "unknown" | "visit";

export type EntryCategoryPresentation = {
	readonly color: string;
	readonly label: string;
};

export const ENTRY_CATEGORY_PRESENTATIONS: Readonly<
	Record<EntryCategory, EntryCategoryPresentation>
> = {
	transport: { color: "#2563EB", label: "交通" },
	unknown: { color: "#6B7280", label: "未分類" },
	visit: { color: "#15803D", label: "訪問" },
};

export type TimeSection = {
	readonly timeOfDay: TimeOfDay;
	readonly units: readonly ArrivalUnit[];
};

export type DayFacts = {
	/** Same-currency sums of the day's stay and transport costs. */
	readonly costTotals: readonly CurrencyTotal[];
	readonly date: string;
	readonly dayNumber: number;
	readonly movementMinutes: number;
	readonly season: SeasonalMotif;
	readonly timeSections: readonly TimeSection[];
};

export type CurrencyTotal = {
	readonly amount: number;
	readonly currency: string;
};

export type BookletFacts = {
	readonly costTotals: readonly CurrencyTotal[];
	readonly days: readonly DayFacts[];
	readonly movementMinutes: number;
};

export function seasonalMotifFor(date: string): SeasonalMotif {
	const match =
		/^(\d{4})-(\d{2})-(\d{2})(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/.exec(
			date,
		);
	if (!match) throw new Error(`日付「${date}」を季節に変換できません。`);
	const [year, month, day] = match.slice(1).map(Number);
	const parsed = new Date(Date.UTC(year, month - 1, day));
	if (
		parsed.getUTCFullYear() !== year ||
		parsed.getUTCMonth() !== month - 1 ||
		parsed.getUTCDate() !== day
	) {
		throw new Error(`日付「${date}」が不正です。`);
	}
	if (month >= 3 && month <= 5) return "spring";
	if (month >= 6 && month <= 8) return "summer";
	if (month >= 9 && month <= 11) return "autumn";
	return "winter";
}

export function timeOfDayFor(startAt: string): TimeOfDay {
	const match =
		/^\d{4}-\d{2}-\d{2}T(\d{2}):(\d{2}):\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.exec(
			startAt,
		);
	if (!match) throw new Error(`日時「${startAt}」を時間帯に変換できません。`);
	const hour = Number(match[1]);
	const minute = Number(match[2]);
	if (hour > 23 || minute > 59)
		throw new Error(`日時「${startAt}」の時刻が不正です。`);
	if (hour <= 5) return "night";
	if (hour <= 11) return "morning";
	if (hour <= 16) return "afternoon";
	return "evening";
}

export function timeSectionsFor(day: BookletDay): readonly TimeSection[] {
	const sections: TimeSection[] = [];
	for (const unit of day.units) {
		const timeOfDay = timeOfDayFor(unit.spot.start_at);
		const previous = sections.at(-1);
		if (previous?.timeOfDay === timeOfDay) {
			sections[sections.length - 1] = {
				timeOfDay,
				units: [...previous.units, unit],
			};
			continue;
		}
		sections.push({ timeOfDay, units: [unit] });
	}
	return sections;
}

/** Amounts are summed per currency; different currencies are never added. */
function sumCosts(units: readonly ArrivalUnit[]): readonly CurrencyTotal[] {
	const amounts = new Map<string, number>();
	const add = (money: BookletMoney) => {
		amounts.set(
			money.currency,
			(amounts.get(money.currency) ?? 0) + money.amount,
		);
	};
	for (const unit of units) {
		add(unit.leg.estimated_cost);
		add(unit.spot.estimated_cost);
	}
	return [...amounts].map(([currency, amount]) => ({ amount, currency }));
}

function movementMinutesOf(units: readonly ArrivalUnit[]): number {
	return units.reduce((total, unit) => total + unit.leg.duration_minutes, 0);
}

export function deriveFacts(model: BookletModel): BookletFacts {
	const units = model.days.flatMap((day) => day.units);
	return {
		costTotals: sumCosts(units),
		days: model.days.map((day) => ({
			costTotals: sumCosts(day.units),
			date: day.date,
			dayNumber: day.dayNumber,
			movementMinutes: movementMinutesOf(day.units),
			season: seasonalMotifFor(day.date),
			timeSections: timeSectionsFor(day),
		})),
		movementMinutes: movementMinutesOf(units),
	};
}
