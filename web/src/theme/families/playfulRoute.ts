import type { MotifAssetId } from "../motifAssets";
import type { MotifColor } from "../types";
import { validateFamilyTextSafety } from "./decorPlacement";
import { styleProfilesForFamily } from "./styleProfiles";

export const PLAYFUL_ROUTE_PALETTES = {
	"berry-sun": {
		accent: "#A32949",
		ink: "#182A44",
		paper: "#FFFDF4",
		secondary: "#C4ECF2",
		soft: "#FFE475",
	},
	"harbor-play": {
		accent: "#185F86",
		ink: "#172F46",
		paper: "#F4FBFF",
		secondary: "#D4EFB0",
		soft: "#FFC4AF",
	},
} as const;

export type PlayfulRoutePaletteId = keyof typeof PLAYFUL_ROUTE_PALETTES;

export const PLAYFUL_ROUTE_COMPOSITIONS = {
	ribbon: {
		blockWidthMm: 128,
		coverImage: { heightMm: 104, widthMm: 62, xMm: 76, yMm: 78 },
		coverPeriod: { heightMm: 40, widthMm: 58, xMm: 10, yMm: 100 },
		coverTitle: { heightMm: 56, widthMm: 128, xMm: 10, yMm: 10 },
		imageShape: "rounded",
	},
	zigzag: {
		blockWidthMm: 104,
		coverImage: { heightMm: 90, widthMm: 90, xMm: 29, yMm: 80 },
		coverPeriod: { heightMm: 20, widthMm: 128, xMm: 10, yMm: 180 },
		coverTitle: { heightMm: 56, widthMm: 100, xMm: 10, yMm: 10 },
		imageShape: "circle",
	},
} as const;

export type PlayfulRouteCompositionId = keyof typeof PLAYFUL_ROUTE_COMPOSITIONS;

/**
 * The cover sun is shared by every decor variant: its size, position and muted
 * colour follow the composition (20.9), not the variant.
 */
export const PLAYFUL_ROUTE_COVER_SUN_ASSET_ID: MotifAssetId = "playful-sun";

/**
 * Reserved decor regions a variant may fill with its own artwork. The IDs are
 * the anchors 20.9 already publishes, so a variant never adds DOM or space.
 */
export type PlayfulRouteDecorSlotId =
	| "playful-cover-bag"
	| "playful-cover-burst"
	| "playful-day-squiggle";

export type PlayfulRouteDecorSlot = {
	readonly assetId: MotifAssetId;
	readonly color: Exclude<MotifColor, "own">;
	/** Offset in mm from the anchor's top-left corner. */
	readonly offsetMm: readonly [number, number];
	/** Height of the asset box in mm; the width follows the asset's aspect. */
	readonly sizeMm: number;
};

export type PlayfulRouteDecorVariantId = "sunny" | "walking";

export type PlayfulRouteDecorVariant = {
	/** Subset drawn on the cover, for a document with no day pages. */
	readonly coverAssetIds: readonly MotifAssetId[];
	readonly decorAssetIds: readonly MotifAssetId[];
	readonly id: PlayfulRouteDecorVariantId;
	readonly slots: Readonly<
		Record<PlayfulRouteDecorSlotId, PlayfulRouteDecorSlot>
	>;
};

/**
 * Builds one variant and keeps its declared asset set exactly equal to the set
 * its slots and the shared sun actually draw. An asset reused across pages is
 * registered once.
 */
function decorVariant(
	id: PlayfulRouteDecorVariantId,
	decorAssetIds: readonly MotifAssetId[],
	slots: Readonly<Record<PlayfulRouteDecorSlotId, PlayfulRouteDecorSlot>>,
): PlayfulRouteDecorVariant {
	const drawn = new Set<MotifAssetId>([
		PLAYFUL_ROUTE_COVER_SUN_ASSET_ID,
		...Object.values(slots).map((slot) => slot.assetId),
	]);
	const declared = new Set(decorAssetIds);
	if (
		declared.size !== decorAssetIds.length ||
		declared.size !== drawn.size ||
		Array.from(drawn).some((assetId) => !declared.has(assetId))
	) {
		throw new Error(
			`playful-routeの装飾パターン「${id}」の素材集合が配置と一致しません。`,
		);
	}
	const coverAssetIds = new Set<MotifAssetId>([
		PLAYFUL_ROUTE_COVER_SUN_ASSET_ID,
		slots["playful-cover-bag"].assetId,
		slots["playful-cover-burst"].assetId,
	]);
	return Object.freeze({
		coverAssetIds: Object.freeze(
			decorAssetIds.filter((assetId) => coverAssetIds.has(assetId)),
		),
		decorAssetIds: Object.freeze([...decorAssetIds]),
		id,
		slots,
	});
}

/**
 * Candidate order of the decor variants. `sunny` keeps 20.9's initial
 * placement; `walking` swaps the bag and the burst for the footprints and the
 * curved arrow in the same reserved regions (20.11).
 */
export const PLAYFUL_ROUTE_DECOR_VARIANTS: readonly PlayfulRouteDecorVariant[] =
	Object.freeze([
		decorVariant(
			"sunny",
			["playful-bag", "playful-sun", "playful-squiggle", "playful-burst"],
			{
				"playful-cover-bag": {
					assetId: "playful-bag",
					color: "accent",
					offsetMm: [0, 0],
					sizeMm: 24,
				},
				"playful-cover-burst": {
					assetId: "playful-burst",
					color: "border",
					offsetMm: [0, 0],
					sizeMm: 12,
				},
				"playful-day-squiggle": {
					assetId: "playful-squiggle",
					color: "accent",
					offsetMm: [0, 0],
					sizeMm: 8,
				},
			},
		),
		decorVariant(
			"walking",
			["playful-sun", "playful-footprints", "playful-curved-arrow"],
			{
				"playful-cover-bag": {
					assetId: "playful-footprints",
					color: "accent",
					offsetMm: [0, 0],
					sizeMm: 24,
				},
				// The burst region is 24 × 12mm; an 8mm arrow sits in its middle.
				"playful-cover-burst": {
					assetId: "playful-curved-arrow",
					color: "border",
					offsetMm: [0, 2],
					sizeMm: 8,
				},
				"playful-day-squiggle": {
					assetId: "playful-curved-arrow",
					color: "accent",
					offsetMm: [0, 0],
					sizeMm: 8,
				},
			},
		),
	]);

/**
 * A registered profile names a decor variant and carries its asset set; the
 * program's profile path draws the variant's slots with the profile's assets,
 * so the two must be the same set in the same order.
 */
for (const profile of styleProfilesForFamily("playful-route")) {
	const variant = PLAYFUL_ROUTE_DECOR_VARIANTS.find(
		(candidate) => candidate.id === profile.decorVariantId,
	);
	if (
		!variant ||
		variant.decorAssetIds.length !== profile.decorAssetIds.length ||
		variant.decorAssetIds.some(
			(assetId, index) => profile.decorAssetIds[index] !== assetId,
		)
	) {
		throw new Error(
			`playful-routeの作風「${profile.id}」と装飾パターンの素材集合が一致しません。`,
		);
	}
}

export function playfulRoutePaletteFor(paletteId: string) {
	const palette = PLAYFUL_ROUTE_PALETTES[paletteId as PlayfulRoutePaletteId];
	if (!palette) {
		throw new Error(`playful-routeの配色「${paletteId}」がありません。`);
	}
	return palette;
}

/**
 * The decor variant a scene's profile selected. A missing or unknown ID is a
 * definition error; it is never completed to `sunny`.
 */
export function playfulRouteDecorVariantFor(
	decorVariantId: string | null,
): PlayfulRouteDecorVariant {
	const variant = PLAYFUL_ROUTE_DECOR_VARIANTS.find(
		(candidate) => candidate.id === decorVariantId,
	);
	if (!variant) {
		throw new Error(
			`playful-routeの装飾パターン「${decorVariantId ?? "(未選択)"}」がありません。`,
		);
	}
	return variant;
}

export function playfulRouteCompositionFor(compositionId: string) {
	const composition =
		PLAYFUL_ROUTE_COMPOSITIONS[compositionId as PlayfulRouteCompositionId];
	if (!composition) {
		throw new Error(`playful-routeの構図「${compositionId}」がありません。`);
	}
	return composition;
}

for (const palette of Object.values(PLAYFUL_ROUTE_PALETTES)) {
	for (const surface of [palette.paper, palette.soft]) {
		validateFamilyTextSafety("playful-route", surface, [
			{ colorHex: palette.ink, fontSizePt: 40, role: "display" },
			{ colorHex: palette.ink, fontSizePt: 15, role: "body" },
			{ colorHex: palette.ink, fontSizePt: 8.5, role: "utility" },
		]);
	}
}
