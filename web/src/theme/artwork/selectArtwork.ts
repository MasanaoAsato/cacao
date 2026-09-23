import type {
	ArtworkAsset,
	ArtworkRole,
	ArtworkSlot,
	ArtworkTouchId,
	ArtworkView,
} from "./types";

export type ArtworkSelection = Readonly<{
	artwork: ArtworkAsset;
	view: ArtworkView | null;
	aspect: number;
	printWidthMm: number;
}>;

export type ArtworkSelectionCriteria = Readonly<{
	role: ArtworkRole;
	touchId?: ArtworkTouchId;
	subjectId?: string;
	viewId?: string;
	placementWidthMm: number;
	placementHeightMm: number;
}>;

/** A source keeps its own ratio; only an authored view may be cropped. */
export function eligibleArtwork(
	catalog: readonly ArtworkAsset[],
	criteria: ArtworkSelectionCriteria,
): ArtworkSelection[] {
	if (
		!Number.isFinite(criteria.placementWidthMm) ||
		!Number.isFinite(criteria.placementHeightMm) ||
		criteria.placementWidthMm <= 0 ||
		criteria.placementHeightMm <= 0
	) {
		return [];
	}
	return catalog.flatMap((artwork) => {
		if (
			!artwork.reviewId?.trim() ||
			artwork.role !== criteria.role ||
			(criteria.touchId && artwork.touchId !== criteria.touchId) ||
			(criteria.subjectId && artwork.subjectId !== criteria.subjectId)
		) {
			return [];
		}
		const view = criteria.viewId
			? artwork.views?.find((candidate) => candidate.id === criteria.viewId)
			: null;
		if (criteria.viewId && !view) {
			return [];
		}
		if (artwork.role === "season-pattern" && !view) {
			return [];
		}
		const aspect = view ? view.width / view.height : artwork.aspect;
		const printWidthMm = Math.min(
			criteria.placementWidthMm,
			criteria.placementHeightMm * aspect,
		);
		if (
			printWidthMm < artwork.minPrintWidthMm ||
			printWidthMm > artwork.maxPrintWidthMm
		) {
			return [];
		}
		return [{ artwork, view: view ?? null, aspect, printWidthMm }];
	});
}

/** The caller supplies its seeded random value; no selection history is kept. */
export function selectArtwork(
	catalog: readonly ArtworkAsset[],
	criteria: ArtworkSelectionCriteria,
	randomUnit: number,
): ArtworkSelection | null {
	if (!Number.isFinite(randomUnit) || randomUnit < 0 || randomUnit >= 1) {
		throw new RangeError("randomUnit must be in [0, 1)");
	}
	const candidates = eligibleArtwork(catalog, criteria);
	return candidates[Math.floor(randomUnit * candidates.length)] ?? null;
}

function slotCriteria(slot: ArtworkSlot): ArtworkSelectionCriteria {
	if (
		!slot.id.trim() ||
		!slot.backgroundColor.trim() ||
		!Number.isFinite(slot.aspect) ||
		!Number.isFinite(slot.widthMm) ||
		!Number.isFinite(slot.heightMm) ||
		!Number.isFinite(slot.minClearanceMm) ||
		slot.widthMm <= 0 ||
		slot.heightMm <= 0 ||
		slot.minClearanceMm < 0 ||
		2 * slot.minClearanceMm >= Math.min(slot.widthMm, slot.heightMm) ||
		Math.abs(slot.aspect - slot.widthMm / slot.heightMm) > 0.001
	) {
		throw new Error(`Invalid artwork slot: ${slot.id}`);
	}
	return {
		role: slot.role,
		subjectId: slot.subjectId,
		viewId: slot.viewId,
		placementWidthMm: slot.widthMm - 2 * slot.minClearanceMm,
		placementHeightMm: slot.heightMm - 2 * slot.minClearanceMm,
	};
}

/** The slot reserves its clearance before contain and can exclude CSS masks. */
export function eligibleArtworkForSlot(
	catalog: readonly ArtworkAsset[],
	slot: ArtworkSlot,
): ArtworkSelection[] {
	const criteria = slotCriteria(slot);
	return eligibleArtwork(
		catalog.filter(
			(artwork) =>
				(slot.allowMask || artwork.recolor !== "mask") &&
				(!slot.touchIds || slot.touchIds.includes(artwork.touchId)),
		),
		criteria,
	);
}

/** Missing mandatory artwork is a design error; optional artwork has no binding. */
export function selectArtworkForSlot(
	catalog: readonly ArtworkAsset[],
	slot: ArtworkSlot,
	randomUnit: number,
): ArtworkSelection | null {
	if (!Number.isFinite(randomUnit) || randomUnit < 0 || randomUnit >= 1) {
		throw new RangeError("randomUnit must be in [0, 1)");
	}
	const candidates = eligibleArtworkForSlot(catalog, slot);
	const selected =
		candidates[Math.floor(randomUnit * candidates.length)] ?? null;
	if (!selected && slot.required) {
		throw new Error(`No eligible artwork for required slot: ${slot.id}`);
	}
	return selected;
}
