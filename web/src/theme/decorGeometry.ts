import type { MotifColor } from "./types";

export const PAGE_WIDTH_MM = 148;
export const PAGE_HEIGHT_MM = 210;

export type MotifBounds = {
	readonly heightMm: number;
	readonly widthMm: number;
	readonly xMm: number;
	readonly yMm: number;
};

/** Axis-aligned bounds of a box rotated around its own centre. */
export function rotatedBounds(
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
