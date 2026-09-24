/**
 * Test-only builders for composition tests. Production code never imports
 * this file; it marks draft artwork as reviewed so selection can be observed.
 */
import { ARTWORK_MANIFEST } from "../../assets/artwork/manifest";
import type {
	ArrivalUnit,
	BookletDay,
	BookletModel,
	BookletPlace,
} from "../../booklet/model";
import { deriveFacts } from "../../booklet/program/deriveFacts";
import type { ArtworkAsset } from "../artwork/types";
import { localePackFor } from "../directions/localePacks";
import {
	ACTIVE_DIRECTION_DEFINITIONS,
	directionDefinitionById,
} from "../directions/registry";
import type { DirectionDefinition, DirectionId } from "../directions/types";
import type { AxisRandom, CompileContext, CompositionCatalog } from "./types";

export const REVIEWED_TEST_ARTWORK: readonly ArtworkAsset[] =
	ARTWORK_MANIFEST.map((definition) => ({
		...definition,
		reviewId: `test-review:${definition.id}`,
		src: `/test-artwork/${definition.id}`,
	}));

export function testUnit(
	dayId: string,
	index: number,
	time: string,
): ArrivalUnit {
	const id = `${dayId}-u${index}`;
	return {
		id,
		leg: {
			duration_minutes: 20,
			estimated_cost: { amount: 300, currency: "JPY" },
			from: { label: "前の地点" },
			id: `${id}-leg`,
			mode: "train",
			to: { label: "地点", spot_id: `${id}-spot` },
		},
		spot: {
			description: "説明",
			estimated_cost: { amount: 1000, currency: "JPY" },
			id: `${id}-spot`,
			name: "地点",
			start_at: `2026-04-01T${time}:00+09:00`,
		},
	};
}

export function testDay(
	id: string,
	dayNumber: number,
	times: readonly string[],
	illustrated = true,
): BookletDay {
	return {
		date: "2026-04-01T00:00:00+09:00",
		dayNumber,
		id,
		illustration: illustrated
			? {
					contentUrl: `/illustration/${id}`,
					height: 600,
					mediaType: "image/png",
					visualStyle: null,
					width: 800,
				}
			: null,
		units: times.map((time, index) => testUnit(id, index, time)),
	};
}

/**
 * Day 1 has morning/afternoon/evening sections, day 2 one section and no
 * illustration, day 3 is empty.
 */
export function testModel(
	options: {
		readonly days?: readonly BookletDay[];
		readonly destinationPlace?: BookletPlace | null;
	} = {},
): BookletModel {
	return {
		cover: {
			budget: { amount: 50000, currency: "JPY" },
			departure: "出発地",
			departurePlace: null,
			destination: "目的地",
			destinationPlace: options.destinationPlace ?? null,
			image: {
				contentUrl: "/cover",
				height: 900,
				mediaType: "image/png",
				visualStyle: null,
				width: 1200,
			},
			period: {
				end_date: "2026-04-03T00:00:00+09:00",
				start_date: "2026-04-01T00:00:00+09:00",
			},
		},
		days: options.days ?? [
			testDay("d1", 1, ["09:00", "10:30", "13:00", "18:00"]),
			testDay("d2", 2, ["10:00"], false),
			testDay("d3", 3, []),
		],
		journeyId: "journey-test",
	};
}

export function testCatalog(
	directionIds: readonly DirectionId[],
	artwork: readonly ArtworkAsset[] = REVIEWED_TEST_ARTWORK,
): CompositionCatalog {
	return {
		artwork,
		directions: directionIds.map(directionDefinitionById),
		revision: "test-revision",
	};
}

export function fullTestCatalog(
	directions: readonly DirectionDefinition[] = ACTIVE_DIRECTION_DEFINITIONS,
): CompositionCatalog {
	return {
		artwork: REVIEWED_TEST_ARTWORK,
		directions,
		revision: "test-revision",
	};
}

/**
 * Deterministic random: continue for `steps` steps, then stop. Choice axes
 * read `choices`; missing axes use `fallback`.
 */
export function scriptedRandom(input: {
	readonly base?: number;
	readonly choices?: Readonly<Record<string, number>>;
	readonly fallback?: number;
	readonly steps: number;
}): AxisRandom {
	return (axis) => {
		if (axis === "direction:base") return input.base ?? 0;
		const step = /^compose:(\d+):continue$/.exec(axis);
		if (step) return Number(step[1]) < input.steps ? 0.99 : 0.1;
		const kind = /^compose:\d+:choice:(direction|operation|scope)$/.exec(
			axis,
		)?.[1];
		if (kind && input.choices?.[kind] !== undefined) return input.choices[kind];
		return input.fallback ?? 0;
	};
}

export function testContext(
	model: BookletModel,
	artwork: readonly ArtworkAsset[] = REVIEWED_TEST_ARTWORK,
): CompileContext {
	return {
		artwork,
		facts: deriveFacts(model),
		localePack: localePackFor(model.cover.destinationPlace),
		model,
	};
}
