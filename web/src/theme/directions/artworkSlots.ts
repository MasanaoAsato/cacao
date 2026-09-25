import type { ArtworkSlotSpec } from "../../booklet/program/moduleCapabilities";
import { type ModuleRect, rect } from "../../booklet/program/modules/geometry";
import type { DirectionId, DirectionModuleId } from "./types";

export type DirectionArtworkSlot = {
	readonly region: ModuleRect;
	readonly slot: ArtworkSlotSpec;
};

/**
 * The five extracted families and the modules without a native hero reserve a
 * separate art plate in their image area. It never enters a text rectangle.
 * The same geometry is used by the compiler, measurement DOM and output DOM.
 */
const COVER_PLATES: Readonly<Partial<Record<DirectionModuleId, ModuleRect>>> = {
	"atlas-grid": rect(44, 104, 48, 48),
	"editorial-magazine": rect(84, 78, 50, 50),
	ledger: rect(84, 92, 50, 50),
	"paper-collage": rect(70, 91, 48, 48),
	"photo-essay": rect(84, 92, 50, 50),
	"playful-route": rect(82, 108, 42, 42),
	"quest-board": rect(84, 92, 50, 50),
	"schematic-map": rect(84, 92, 50, 50),
	"travel-newspaper": rect(42, 67, 42, 42),
	"vertical-poster": rect(55, 99, 46, 46),
};

const DAY_PLATES: Readonly<Partial<Record<DirectionModuleId, ModuleRect>>> = {
	"atlas-grid": rect(112, 12, 24, 24),
	"editorial-magazine": rect(14, 36, 34, 34),
	"paper-collage": rect(13, 13, 20, 20),
	"photo-essay": rect(98, 87, 38, 38),
	"playful-route": rect(108, 14, 27, 27),
	"schematic-map": rect(101, 52, 32, 32),
	"travel-newspaper": rect(108, 16, 24, 24),
	"vertical-poster": rect(64, 47, 38, 38),
};

/** No plate is added when a module already owns a principal art rectangle. */
export function directionArtworkSlot(
	moduleId: DirectionModuleId,
	kind: "cover" | "day",
	directionId: DirectionId,
	compositionId: string,
): DirectionArtworkSlot | null {
	let region = kind === "cover" ? COVER_PLATES[moduleId] : DAY_PLATES[moduleId];
	if (!region) return null;
	if (
		kind === "cover" &&
		moduleId === "atlas-grid" &&
		compositionId === "wide-image"
	)
		region = rect(82, 104, 48, 48);
	if (
		kind === "day" &&
		moduleId === "paper-collage" &&
		compositionId === "photo-right"
	)
		region = rect(99, 13, 20, 20);
	if (kind === "day" && directionId === "social") region = rect(13, 13, 18, 18);
	if (
		kind === "day" &&
		moduleId === "editorial-magazine" &&
		directionId === "retro-tourism"
	)
		region = rect(94, 36, 34, 34);
	if (
		kind === "cover" &&
		moduleId === "editorial-magazine" &&
		directionId === "retro-tourism"
	)
		region = rect(84, 66, 50, 44);
	const slotId = kind === "cover" ? "direction-cover-art" : "direction-day-art";
	return {
		region,
		slot: {
			baselineRole: kind === "cover" ? "hero" : "medium",
			heightMm: region.heightMm,
			slotId,
			widthMm: region.widthMm,
		},
	};
}
