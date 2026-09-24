import { createModuleRegistry } from "./moduleRegistry";
import { ATLAS_GRID_MODULE } from "./modules/AtlasGridModule";
import { EDITORIAL_MAGAZINE_MODULE } from "./modules/EditorialMagazineModule";
import { LEDGER_MODULE } from "./modules/Ledger";
import { PAPER_COLLAGE_MODULE } from "./modules/PaperCollageModule";
import { PHOTO_ESSAY_MODULE } from "./modules/PhotoEssay";
import { PLAYFUL_ROUTE_MODULE } from "./modules/PlayfulRouteModule";
import { QUEST_BOARD_MODULE } from "./modules/QuestBoard";
import { SCHEMATIC_MAP_MODULE } from "./modules/SchematicMap";
import { SPECIMEN_BOARD_MODULE } from "./modules/SpecimenBoard";
import { TRAVEL_NEWSPAPER_MODULE } from "./modules/TravelNewspaperModule";
import { VERTICAL_POSTER_MODULE } from "./modules/VerticalPoster";
import { WOODCUT_FOLIO_MODULE } from "./modules/WoodcutFolio";

/** The twelve drawing modules of 25.4, checked against their capabilities. */
export const PROGRAM_MODULES = createModuleRegistry({
	"atlas-grid": ATLAS_GRID_MODULE,
	"editorial-magazine": EDITORIAL_MAGAZINE_MODULE,
	ledger: LEDGER_MODULE,
	"paper-collage": PAPER_COLLAGE_MODULE,
	"photo-essay": PHOTO_ESSAY_MODULE,
	"playful-route": PLAYFUL_ROUTE_MODULE,
	"quest-board": QUEST_BOARD_MODULE,
	"schematic-map": SCHEMATIC_MAP_MODULE,
	"specimen-board": SPECIMEN_BOARD_MODULE,
	"travel-newspaper": TRAVEL_NEWSPAPER_MODULE,
	"vertical-poster": VERTICAL_POSTER_MODULE,
	"woodcut-folio": WOODCUT_FOLIO_MODULE,
});
