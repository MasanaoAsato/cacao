import type { BookletPlace } from "../../booklet/model";

export type LocalePackId = "kyoto" | "tokyo" | "paris";
export type LocalePack = {
	readonly cityAliases: readonly string[];
	readonly countryAliases: readonly string[];
	readonly id: LocalePackId;
	readonly motifSubjects: readonly string[];
	readonly palette: {
		readonly accent: string;
		readonly body: string;
		readonly paper: string;
	};
};

export const LOCALE_PACKS: readonly LocalePack[] = [
	{
		cityAliases: ["Kyoto", "京都", "京都市"],
		countryAliases: ["Japan", "日本"],
		id: "kyoto",
		motifSubjects: ["格子", "瓦屋根"],
		palette: { accent: "#A33E32", body: "#20352D", paper: "#F6F2E8" },
	},
	{
		cityAliases: ["Tokyo", "東京", "東京都"],
		countryAliases: ["Japan", "日本"],
		id: "tokyo",
		motifSubjects: ["都市の窓", "鉄道"],
		palette: { accent: "#335F87", body: "#203247", paper: "#FFFFFF" },
	},
	{
		cityAliases: ["Paris", "パリ"],
		countryAliases: ["France", "フランス"],
		id: "paris",
		motifSubjects: ["屋根", "アーチ"],
		palette: { accent: "#89552E", body: "#382F29", paper: "#F4ECDD" },
	},
] as const;

function normalize(value: string): string {
	return value.normalize("NFKC").trim().toLowerCase();
}

export function localePackFor(place: BookletPlace | null): LocalePack | null {
	if (!place) return null;
	const city = normalize(place.city);
	const country = normalize(place.country);
	return (
		LOCALE_PACKS.find(
			(pack) =>
				pack.cityAliases.some((alias) => normalize(alias) === city) &&
				pack.countryAliases.some((alias) => normalize(alias) === country),
		) ?? null
	);
}
