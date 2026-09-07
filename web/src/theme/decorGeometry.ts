import { axisRandom } from "./seed";
import type {
	ContentInsetMm,
	DecorDefinition,
	MotifColor,
	MotifDefinition,
	MotifId,
	MotifPlacement,
	MotifSlotId,
} from "./types";

export const PAGE_WIDTH_MM = 148;
export const PAGE_HEIGHT_MM = 210;
/** The smallest body page margin any density produces (`compact`). */
export const MIN_PAGE_MARGIN_MM = 10;
/** Distance from the page edge to corner and margin motifs. */
export const MOTIF_EDGE_OFFSET_MM = 4;
/** Clearance kept between any decor and the body area. */
export const DECOR_GAP_MM = 2;
/** Padding between a sheet panel's edge and the body area. */
export const PANEL_PADDING_MM = 4;

export type PageGeometry = {
	readonly contentInset: ContentInsetMm;
	readonly pageMarginMm: number;
};

export type MotifBounds = {
	readonly heightMm: number;
	readonly widthMm: number;
	readonly xMm: number;
	readonly yMm: number;
};

export type ResolvedMotif = {
	/** Axis-aligned bounds of the rotated box; never overlaps the body area. */
	readonly boundsMm: MotifBounds;
	readonly color: MotifColor;
	readonly heightMm: number;
	readonly index: number;
	readonly motif: MotifId;
	readonly opacity: number;
	readonly rotateDeg: number;
	readonly slot: MotifSlotId;
	readonly widthMm: number;
	/** Top-left corner of the (unrotated) motif box on the 148×210 page. */
	readonly xMm: number;
	readonly yMm: number;
};

function rotatedBounds(
	xMm: number,
	yMm: number,
	widthMm: number,
	heightMm: number,
	rotateDeg: number,
): MotifBounds {
	const dimensions = rotatedDimensions(widthMm, heightMm, rotateDeg);
	return {
		heightMm: dimensions.heightMm,
		widthMm: dimensions.widthMm,
		xMm: xMm + widthMm / 2 - dimensions.widthMm / 2,
		yMm: yMm + heightMm / 2 - dimensions.heightMm / 2,
	};
}

type RotatedDimensions = Pick<MotifBounds, "heightMm" | "widthMm">;

function rotatedDimensions(
	widthMm: number,
	heightMm: number,
	rotateDeg: number,
): RotatedDimensions {
	const radians = (rotateDeg * Math.PI) / 180;
	const cos = Math.abs(Math.cos(radians));
	const sin = Math.abs(Math.sin(radians));
	return {
		heightMm: widthMm * sin + heightMm * cos,
		widthMm: widthMm * cos + heightMm * sin,
	};
}

/**
 * Largest axis-aligned bounds across a placement's inclusive rotation range.
 * The extrema are not always at the range ends (a 45° rotation is the common
 * case), so evaluate each analytic extremum that lies inside the range.
 */
export function maximumRotatedDimensions(
	widthMm: number,
	heightMm: number,
	rotateDeg: readonly [number, number],
): RotatedDimensions {
	const [minimum, maximum] = rotateDeg;
	const candidates = [minimum, maximum];
	const angle = (Math.atan2(heightMm, widthMm) * 180) / Math.PI;
	const extrema = [angle, -angle, 90 - angle, 90 + angle];
	for (const base of extrema) {
		const firstTurn = Math.ceil((minimum - base) / 180);
		const lastTurn = Math.floor((maximum - base) / 180);
		for (let turn = firstTurn; turn <= lastTurn; turn += 1) {
			candidates.push(base + turn * 180);
		}
	}
	return candidates.reduce<RotatedDimensions>(
		(largest, candidate) => {
			const dimensions = rotatedDimensions(widthMm, heightMm, candidate);
			return {
				heightMm: Math.max(largest.heightMm, dimensions.heightMm),
				widthMm: Math.max(largest.widthMm, dimensions.widthMm),
			};
		},
		{ heightMm: 0, widthMm: 0 },
	);
}

export type PanelRect = {
	readonly heightMm: number;
	readonly opacity: number;
	readonly radiusMm: number;
	readonly widthMm: number;
	readonly xMm: number;
	readonly yMm: number;
};

const ZERO_INSET: ContentInsetMm = { bottom: 0, left: 0, right: 0, top: 0 };

function requireMotif(
	motifs: ReadonlyMap<MotifId, MotifDefinition>,
	id: MotifId,
): MotifDefinition {
	const motif = motifs.get(id);
	if (!motif) {
		throw new Error(`未登録の図形「${id}」です。`);
	}
	return motif;
}

/** The inset one motif placement needs so it never touches the body area. */
function placementInset(
	placement: MotifPlacement,
	motifs: ReadonlyMap<MotifId, MotifDefinition>,
): ContentInsetMm {
	const motif = requireMotif(motifs, placement.motif);
	const dimensions = maximumRotatedDimensions(
		placement.sizeMm[1] * motif.aspect,
		placement.sizeMm[1],
		placement.rotateDeg,
	);
	const cornerInset = (extent: number) =>
		Math.max(
			0,
			extent + MOTIF_EDGE_OFFSET_MM + DECOR_GAP_MM - MIN_PAGE_MARGIN_MM,
		);
	switch (placement.slot) {
		case "corner-nw":
			return {
				...ZERO_INSET,
				left: cornerInset(dimensions.widthMm),
				top: cornerInset(dimensions.heightMm),
			};
		case "corner-ne":
			return {
				...ZERO_INSET,
				right: cornerInset(dimensions.widthMm),
				top: cornerInset(dimensions.heightMm),
			};
		case "corner-sw":
			return {
				...ZERO_INSET,
				bottom: cornerInset(dimensions.heightMm),
				left: cornerInset(dimensions.widthMm),
			};
		case "corner-se":
			return {
				...ZERO_INSET,
				bottom: cornerInset(dimensions.heightMm),
				right: cornerInset(dimensions.widthMm),
			};
		case "margin-left":
			return { ...ZERO_INSET, left: cornerInset(dimensions.widthMm) };
		case "margin-right":
			return { ...ZERO_INSET, right: cornerInset(dimensions.widthMm) };
		case "band-top":
			return {
				...ZERO_INSET,
				top:
					placement.anchor === "page-edge"
						? dimensions.heightMm
						: Math.max(0, dimensions.heightMm - MIN_PAGE_MARGIN_MM),
			};
		case "band-bottom":
			return {
				...ZERO_INSET,
				bottom:
					placement.anchor === "page-edge"
						? dimensions.heightMm
						: Math.max(0, dimensions.heightMm - MIN_PAGE_MARGIN_MM),
			};
	}
}

function maxInset(insets: readonly ContentInsetMm[]): ContentInsetMm {
	return insets.reduce(
		(result, inset) => ({
			bottom: Math.max(result.bottom, inset.bottom),
			left: Math.max(result.left, inset.left),
			right: Math.max(result.right, inset.right),
			top: Math.max(result.top, inset.top),
		}),
		ZERO_INSET,
	);
}

function uniformInset(value: number): ContentInsetMm {
	return { bottom: value, left: value, right: value, top: value };
}

/**
 * Body inset a decor set needs on each side, derived from its ground, panel
 * and motifs. Motifs never enter the body area; when a sheet panel exists
 * they may sit behind the panel instead, so they stop contributing.
 */
export function decorContentInset(
	decor: DecorDefinition,
	motifs: ReadonlyMap<MotifId, MotifDefinition>,
): ContentInsetMm {
	const insets: ContentInsetMm[] = [];
	if (decor.ground.kind === "frame") {
		insets.push(
			uniformInset(
				Math.max(
					0,
					decor.ground.edgeMm +
						decor.ground.widthMm +
						DECOR_GAP_MM -
						MIN_PAGE_MARGIN_MM,
				),
			),
		);
	}
	if (decor.panel.kind === "sheet") {
		insets.push(
			uniformInset(
				Math.max(
					0,
					decor.panel.insetMm + PANEL_PADDING_MM - MIN_PAGE_MARGIN_MM,
				),
			),
		);
	}
	for (const placement of decor.motifs) {
		if (decor.panel.kind === "sheet" && placement.anchor === "content-edge") {
			continue;
		}
		insets.push(placementInset(placement, motifs));
	}
	return maxInset(insets);
}

function lerp(range: readonly [number, number], t: number): number {
	return range[0] + (range[1] - range[0]) * t;
}

/**
 * Places every motif of a decor set on the page for the given seed. Sizes and
 * rotations are picked from their ranges by `axisRandom`, so the same seed
 * always yields the same placement.
 */
export function resolveMotifPlacements(
	decor: DecorDefinition,
	motifs: ReadonlyMap<MotifId, MotifDefinition>,
	geometry: PageGeometry,
	seedToken: string,
): readonly ResolvedMotif[] {
	const contentLeft = geometry.pageMarginMm + geometry.contentInset.left;
	const contentRight =
		PAGE_WIDTH_MM - geometry.pageMarginMm - geometry.contentInset.right;
	const contentTop = geometry.pageMarginMm + geometry.contentInset.top;
	const contentBottom =
		PAGE_HEIGHT_MM - geometry.pageMarginMm - geometry.contentInset.bottom;
	const resolved: ResolvedMotif[] = [];
	for (const placement of decor.motifs) {
		const motif = requireMotif(motifs, placement.motif);
		for (let index = 0; index < placement.count; index += 1) {
			const axis = `motif:${placement.slot}:${index}`;
			const heightMm = lerp(
				placement.sizeMm,
				axisRandom(seedToken, `${axis}:size`),
			);
			const rotateDeg = lerp(
				placement.rotateDeg,
				axisRandom(seedToken, `${axis}:rotate`),
			);
			const widthMm = heightMm * motif.aspect;
			const bounds = rotatedBounds(0, 0, widthMm, heightMm, rotateDeg);
			const alongX = (span: readonly [number, number]) =>
				span[0] + ((index + 0.5) * (span[1] - span[0])) / placement.count;
			let xMm: number;
			let yMm: number;
			switch (placement.slot) {
				case "corner-nw":
					xMm = MOTIF_EDGE_OFFSET_MM;
					yMm = MOTIF_EDGE_OFFSET_MM;
					break;
				case "corner-ne":
					xMm = PAGE_WIDTH_MM - MOTIF_EDGE_OFFSET_MM - widthMm;
					yMm = MOTIF_EDGE_OFFSET_MM;
					break;
				case "corner-sw":
					xMm = MOTIF_EDGE_OFFSET_MM;
					yMm = PAGE_HEIGHT_MM - MOTIF_EDGE_OFFSET_MM - heightMm;
					break;
				case "corner-se":
					xMm = PAGE_WIDTH_MM - MOTIF_EDGE_OFFSET_MM - widthMm;
					yMm = PAGE_HEIGHT_MM - MOTIF_EDGE_OFFSET_MM - heightMm;
					break;
				case "margin-left":
					xMm = MOTIF_EDGE_OFFSET_MM;
					yMm = alongX([contentTop, contentBottom]) - heightMm / 2;
					break;
				case "margin-right":
					xMm = PAGE_WIDTH_MM - MOTIF_EDGE_OFFSET_MM - widthMm;
					yMm = alongX([contentTop, contentBottom]) - heightMm / 2;
					break;
				case "band-top":
					xMm = alongX([contentLeft, contentRight]) - widthMm / 2;
					yMm =
						placement.anchor === "page-edge"
							? 0
							: contentTop - heightMm / 2 - bounds.heightMm / 2;
					break;
				case "band-bottom":
					xMm = alongX([contentLeft, contentRight]) - widthMm / 2;
					yMm =
						placement.anchor === "page-edge"
							? PAGE_HEIGHT_MM - heightMm
							: contentBottom - heightMm / 2 + bounds.heightMm / 2;
					break;
			}
			resolved.push({
				boundsMm: rotatedBounds(xMm, yMm, widthMm, heightMm, rotateDeg),
				color: placement.color,
				heightMm,
				index,
				motif: placement.motif,
				opacity: placement.opacity,
				rotateDeg,
				slot: placement.slot,
				widthMm,
				xMm,
				yMm,
			});
		}
	}
	return resolved;
}

export function panelRect(decor: DecorDefinition): PanelRect | null {
	if (decor.panel.kind !== "sheet") {
		return null;
	}
	return {
		heightMm: PAGE_HEIGHT_MM - 2 * decor.panel.insetMm,
		opacity: decor.panel.opacity,
		radiusMm: decor.panel.radiusMm,
		widthMm: PAGE_WIDTH_MM - 2 * decor.panel.insetMm,
		xMm: decor.panel.insetMm,
		yMm: decor.panel.insetMm,
	};
}

/** Fraction of the page a pattern ground covers with ink. */
export function patternCoverage(
	decor: DecorDefinition,
	motifs: ReadonlyMap<MotifId, MotifDefinition>,
): number {
	if (decor.ground.kind !== "pattern") {
		return 0;
	}
	const motif = requireMotif(motifs, decor.ground.motif);
	const scale = decor.ground.sizeMm / decor.ground.tileMm;
	return motif.coverage * scale * scale * motif.aspect;
}

/** CSS custom property that paints a motif colour on body pages. */
export function motifColorVariable(color: MotifColor): string | null {
	switch (color) {
		case "accent":
			return "var(--booklet-itinerary-accent)";
		case "border":
			return "var(--booklet-itinerary-border)";
		case "muted":
			return "var(--booklet-itinerary-muted)";
		case "own":
			return null;
	}
}
