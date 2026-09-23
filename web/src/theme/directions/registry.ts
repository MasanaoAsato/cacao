import { ANIME_BACKGROUND_DIRECTION } from "./definitions/anime-background";
import { BOARD_GAME_DIRECTION } from "./definitions/board-game";
import { CAFE_DIRECTION } from "./definitions/cafe";
import { CARDS_DIRECTION } from "./definitions/cards";
import { CATEGORY_COLOR_DIRECTION } from "./definitions/category-color";
import { CHAPTERS_DIRECTION } from "./definitions/chapters";
import { CHECKLIST_DIRECTION } from "./definitions/checklist";
import { CONTINUOUS_STORY_DIRECTION } from "./definitions/continuous-story";
import { DATA_BOOK_DIRECTION } from "./definitions/data-book";
import { DAY_STORY_DIRECTION } from "./definitions/day-story";
import { ENCYCLOPEDIA_DIRECTION } from "./definitions/encyclopedia";
import { FILM_DIRECTION } from "./definitions/film";
import { FLIGHT_DIRECTION } from "./definitions/flight";
import { GAME_UI_DIRECTION } from "./definitions/game-ui";
import { GOURMET_DIRECTION } from "./definitions/gourmet";
import { HOTEL_BROCHURE_DIRECTION } from "./definitions/hotel-brochure";
import { INFLIGHT_DIRECTION } from "./definitions/inflight";
import { JAPAN_POSTER_DIRECTION } from "./definitions/japan-poster";
import { LITERATURE_DIRECTION } from "./definitions/literature";
import { LOCAL_COLOR_DIRECTION } from "./definitions/local-color";
import { LOCAL_MOTIF_DIRECTION } from "./definitions/local-motif";
import { LUXURY_MAGAZINE_DIRECTION } from "./definitions/luxury-magazine";
import { MAP_DIRECTION } from "./definitions/map";
import { MEMORY_ALBUM_DIRECTION } from "./definitions/memory-album";
import { MINIMAL_DIRECTION } from "./definitions/minimal";
import { MISSION_DIRECTION } from "./definitions/mission";
import { MUSEUM_DIRECTION } from "./definitions/museum";
import { NEWSPAPER_DIRECTION } from "./definitions/newspaper";
import { NORDIC_DIRECTION } from "./definitions/nordic";
import { ONSEN_DIRECTION } from "./definitions/onsen";
import { PASTEL_POP_DIRECTION } from "./definitions/pastel-pop";
import { PHOTO_BOOK_DIRECTION } from "./definitions/photo-book";
import { POLAROID_DIRECTION } from "./definitions/polaroid";
import { PRACTICAL_DIRECTION } from "./definitions/practical";
import { RAIL_DIRECTION } from "./definitions/rail";
import { RETRO_TOURISM_DIRECTION } from "./definitions/retro-tourism";
import { ROAD_TRIP_DIRECTION } from "./definitions/road-trip";
import { RPG_DIRECTION } from "./definitions/rpg";
import { SCRAPBOOK_DIRECTION } from "./definitions/scrapbook";
import { SEASON_DIRECTION } from "./definitions/season";
import { SOCIAL_DIRECTION } from "./definitions/social";
import { STAMP_DIRECTION } from "./definitions/stamp";
import { STORYBOOK_DIRECTION } from "./definitions/storybook";
import { TIMELINE_DIRECTION } from "./definitions/timeline";
import { TOURIST_INFO_DIRECTION } from "./definitions/tourist-info";
import { TRANSIT_DIRECTION } from "./definitions/transit";
import { TRAVEL_MAGAZINE_DIRECTION } from "./definitions/travel-magazine";
import { TRAVEL_NOTE_DIRECTION } from "./definitions/travel-note";
import { VINTAGE_JOURNAL_DIRECTION } from "./definitions/vintage-journal";
import { WA_MODERN_DIRECTION } from "./definitions/wa-modern";
import { WEB_APP_DIRECTION } from "./definitions/web-app";
import { YOUTH_DIRECTION } from "./definitions/youth";
import { localePackFor } from "./localePacks";
import { STYLE_BUNDLES } from "./styleBundles";
import type {
	DirectionDefinition,
	DirectionEligibilityContext,
	DirectionId,
} from "./types";

export function createDirectionRegistry(
	definitions: readonly DirectionDefinition[],
): ReadonlyMap<DirectionId, DirectionDefinition> {
	const registry = new Map<DirectionId, DirectionDefinition>();
	for (const definition of definitions) {
		if (registry.has(definition.id))
			throw new Error(`方向「${definition.id}」が重複しています。`);
		const baseline = definition.baseline();
		if (!STYLE_BUNDLES[baseline.styleBundleId])
			throw new Error(`方向「${definition.id}」の束が未登録です。`);
		if (
			!baseline.coverage.cover ||
			!baseline.coverage.fullItinerary ||
			!baseline.coverage.continuationPage ||
			!baseline.coverage.emptyDay
		)
			throw new Error(
				`方向「${definition.id}」が単独冊子のcoverageを満たしていません。`,
			);
		registry.set(definition.id, definition);
	}
	return registry;
}

const DIRECTION_DEFINITIONS = [
	TRAVEL_MAGAZINE_DIRECTION,
	TRAVEL_NOTE_DIRECTION,
	SCRAPBOOK_DIRECTION,
	FILM_DIRECTION,
	RETRO_TOURISM_DIRECTION,
	VINTAGE_JOURNAL_DIRECTION,
	LUXURY_MAGAZINE_DIRECTION,
	HOTEL_BROCHURE_DIRECTION,
	INFLIGHT_DIRECTION,
	JAPAN_POSTER_DIRECTION,
	WA_MODERN_DIRECTION,
	ONSEN_DIRECTION,
	YOUTH_DIRECTION,
	ANIME_BACKGROUND_DIRECTION,
	GAME_UI_DIRECTION,
	RPG_DIRECTION,
	BOARD_GAME_DIRECTION,
	RAIL_DIRECTION,
	FLIGHT_DIRECTION,
	ROAD_TRIP_DIRECTION,
	MAP_DIRECTION,
	TRANSIT_DIRECTION,
	TIMELINE_DIRECTION,
	CARDS_DIRECTION,
	MINIMAL_DIRECTION,
	NORDIC_DIRECTION,
	PASTEL_POP_DIRECTION,
	CAFE_DIRECTION,
	GOURMET_DIRECTION,
	PHOTO_BOOK_DIRECTION,
	STORYBOOK_DIRECTION,
	LITERATURE_DIRECTION,
	NEWSPAPER_DIRECTION,
	TOURIST_INFO_DIRECTION,
	MUSEUM_DIRECTION,
	ENCYCLOPEDIA_DIRECTION,
	DATA_BOOK_DIRECTION,
	WEB_APP_DIRECTION,
	SOCIAL_DIRECTION,
	POLAROID_DIRECTION,
	SEASON_DIRECTION,
	LOCAL_COLOR_DIRECTION,
	LOCAL_MOTIF_DIRECTION,
	STAMP_DIRECTION,
	CHECKLIST_DIRECTION,
	MISSION_DIRECTION,
	DAY_STORY_DIRECTION,
	CHAPTERS_DIRECTION,
	CATEGORY_COLOR_DIRECTION,
	PRACTICAL_DIRECTION,
	MEMORY_ALBUM_DIRECTION,
	CONTINUOUS_STORY_DIRECTION,
] as const;

export const DIRECTION_REGISTRY = createDirectionRegistry(
	DIRECTION_DEFINITIONS,
);
export const ACTIVE_DIRECTION_IDS = Object.freeze([
	...DIRECTION_REGISTRY.keys(),
]);

if (ACTIVE_DIRECTION_IDS.length !== 52)
	throw new Error("方向カタログは52件でなければなりません。");

export function directionDefinitionById(id: DirectionId): DirectionDefinition {
	const definition = DIRECTION_REGISTRY.get(id);
	if (!definition) throw new Error(`方向「${id}」が登録されていません。`);
	return definition;
}

export function isDirectionEligible(
	definition: DirectionDefinition,
	context: DirectionEligibilityContext,
): boolean {
	if (definition.eligibility.kind === "always") return true;
	const pack = localePackFor(context.destinationPlace);
	return (
		pack !== null && definition.eligibility.localePackIds.includes(pack.id)
	);
}
