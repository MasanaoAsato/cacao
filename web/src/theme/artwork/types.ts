/** The twelve production techniques in design 25.2. */
export const ARTWORK_TOUCH_IDS = [
	"woodcut",
	"pencil",
	"engraving",
	"cut-paper",
	"brush",
	"ink-wash",
	"gouache",
	"risograph",
	"screenprint",
	"pixel",
	"technical",
	"chalk",
] as const;

export type ArtworkTouchId = (typeof ARTWORK_TOUCH_IDS)[number];

/** Direction aliases reuse one of the twelve authored artwork techniques. */
export function canonicalArtworkTouchId(id: string): ArtworkTouchId | null {
	const canonical =
		id === "charcoal" ? "chalk" : id === "geometric" ? "screenprint" : id;
	return ARTWORK_TOUCH_IDS.find((touch) => touch === canonical) ?? null;
}

export const ARTWORK_ROLES = [
	"hero",
	"medium",
	"frame",
	"heading",
	"tab",
	"label",
	"rule",
	"panel",
	"straight-arrow",
	"turn-arrow",
	"route",
	"season-pattern",
] as const;

export type ArtworkRole = (typeof ARTWORK_ROLES)[number];
export type ArtworkFormat = "svg" | "webp";
export type ArtworkRecolor = "mask" | "none";

export type ArtworkInset = Readonly<{
	top: number;
	right: number;
	bottom: number;
	left: number;
}>;

export type ArtworkView = Readonly<{
	id: string;
	x: number;
	y: number;
	width: number;
	height: number;
}>;

export type ArtworkProvenance = Readonly<{
	creator: string;
	method: string;
	licenseEvidence: string;
}>;

/** Metadata is authored beside the files. src is resolved separately by Vite. */
export type ArtworkDefinition = Readonly<{
	id: string;
	revision: number;
	sourcePath: string;
	format: ArtworkFormat;
	width: number;
	height: number;
	aspect: number;
	touchId: ArtworkTouchId;
	subjectId: string;
	role: ArtworkRole;
	recolor: ArtworkRecolor;
	safeInset: ArtworkInset;
	minPrintWidthMm: number;
	maxPrintWidthMm: number;
	originalityGroupId: string;
	provenance: ArtworkProvenance;
	reviewId: string | null;
	hasAlpha?: boolean;
	views?: readonly ArtworkView[];
}>;

export type ArtworkAsset = ArtworkDefinition & Readonly<{ src: string }>;
/** A module declares the physical space and presentation rules for one artwork. */
export type ArtworkSlot = Readonly<{
	id: string;
	role: ArtworkRole;
	aspect: number;
	widthMm: number;
	heightMm: number;
	backgroundColor: string;
	allowMask: boolean;
	minClearanceMm: number;
	required: boolean;
	touchIds?: readonly ArtworkTouchId[];
	subjectId?: string;
	viewId?: string;
}>;

/** Old names resolve to one canonical artwork and never count as new artwork. */
export type ArtworkAlias = Readonly<{ id: string; targetId: string }>;
