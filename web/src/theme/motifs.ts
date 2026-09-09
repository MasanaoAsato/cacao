import type { MotifDefinition, MotifShape } from "./types";
import { MOTIF_ASSETS } from "./motifAssets";

/** 1px expressed in mm, used for hairline strokes. */
const HAIRLINE_MM = 0.26;

function starPath(points: number, outer: number, inner: number): string {
	const steps: string[] = [];
	for (let index = 0; index < points * 2; index += 1) {
		const radius = index % 2 === 0 ? outer : inner;
		const angle = -Math.PI / 2 + (index * Math.PI) / points;
		const x = 0.5 + radius * Math.cos(angle);
		const y = 0.5 + radius * Math.sin(angle);
		steps.push(`${index === 0 ? "M" : "L"}${x.toFixed(4)} ${y.toFixed(4)}`);
	}
	return `${steps.join(" ")} Z`;
}

function diagonalStripes(aspect: number, period: number): string {
	const segments: string[] = [];
	for (let x = -1; x < aspect + 1; x += period) {
		segments.push(`M${x.toFixed(3)} 1 L${(x + 1).toFixed(3)} 0`);
	}
	return segments.join(" ");
}

function procedural(
	id: MotifDefinition["id"],
	aspect: number,
	coverage: number,
	shapes: readonly MotifShape[],
): MotifDefinition {
	return { aspect, coverage, id, kind: "procedural", shapes };
}

/**
 * Procedural motif vocabulary (18.4). Shapes live in a box `aspect` wide and
 * 1 high; the renderer scales the box to the placement's size in mm and paints
 * `"color"` with the palette colour of the placement. No asset files are
 * needed for any of these, so the decor layer can exist before any artwork.
 */
const PROCEDURAL_MOTIFS = new Map<MotifDefinition["id"], MotifDefinition>([
	[
		"dot",
		procedural("dot", 1, Math.PI / 4, [
			{
				cx: 0.5,
				cy: 0.5,
				fill: "color",
				kind: "circle",
				r: 0.5,
				stroke: "none",
				strokeWidth: 0,
			},
		]),
	],
	[
		"stripe",
		// A 148mm wide, 6mm tall band of 45° hairline-ish stripes: 1mm ink every 3mm.
		procedural("stripe", 148 / 6, 1 / 3, [
			{
				d: diagonalStripes(148 / 6, 0.5),
				fill: "none",
				kind: "path",
				stroke: "color",
				strokeWidth: 1 / 6,
			},
		]),
	],
	[
		"dash-rail",
		// A 196mm long dashed hairline in a 4mm box, so it sits 6mm from the edge
		// and needs no body inset.
		procedural("dash-rail", 4 / 196, 0.001, [
			{
				d: `M${(2 / 196).toFixed(5)} 0 L${(2 / 196).toFixed(5)} 1`,
				dashed: true,
				fill: "none",
				kind: "path",
				stroke: "color",
				strokeWidth: HAIRLINE_MM / 196,
			},
		]),
	],
	[
		"rule-square",
		// A 128mm hairline along the bottom with a 3mm square at its right end.
		procedural("rule-square", 128 / 3, 0.11, [
			{
				d: `M0 ${(1 - HAIRLINE_MM / 3 / 2).toFixed(4)} L${(128 / 3).toFixed(4)} ${(1 - HAIRLINE_MM / 3 / 2).toFixed(4)}`,
				fill: "none",
				kind: "path",
				stroke: "color",
				strokeWidth: HAIRLINE_MM / 3,
			},
			{
				fill: "color",
				height: 1,
				kind: "rect",
				stroke: "none",
				strokeWidth: 0,
				width: 1,
				x: 128 / 3 - 1,
				y: 0,
			},
		]),
	],
	[
		"wave",
		procedural("wave", 2, 0.1, [
			{
				d: "M0 0.5 Q0.5 0 1 0.5 T2 0.5",
				fill: "none",
				kind: "path",
				stroke: "color",
				strokeWidth: 0.12,
			},
		]),
	],
	[
		"ring",
		procedural("ring", 1, 0.3, [
			{
				cx: 0.5,
				cy: 0.5,
				fill: "none",
				kind: "circle",
				r: 0.44,
				stroke: "color",
				strokeWidth: 0.12,
			},
		]),
	],
	[
		"star",
		procedural("star", 1, 0.35, [
			{
				d: starPath(5, 0.5, 0.22),
				fill: "color",
				kind: "path",
				stroke: "none",
				strokeWidth: 0,
			},
		]),
	],
	[
		"sparkle",
		procedural("sparkle", 1, 0.2, [
			{
				d: "M0.5 0 Q0.5 0.5 1 0.5 Q0.5 0.5 0.5 1 Q0.5 0.5 0 0.5 Q0.5 0.5 0.5 0 Z",
				fill: "color",
				kind: "path",
				stroke: "none",
				strokeWidth: 0,
			},
		]),
	],
	[
		"cross",
		procedural("cross", 1, 0.36, [
			{
				fill: "color",
				height: 1,
				kind: "rect",
				stroke: "none",
				strokeWidth: 0,
				width: 0.2,
				x: 0.4,
				y: 0,
			},
			{
				fill: "color",
				height: 0.2,
				kind: "rect",
				stroke: "none",
				strokeWidth: 0,
				width: 1,
				x: 0,
				y: 0.4,
			},
		]),
	],
	[
		"notch",
		// A half disc bulging to the right, like a ticket punch on the left edge.
		procedural("notch", 0.5, Math.PI / 4, [
			{
				d: "M0 0 A0.5 0.5 0 0 1 0 1 Z",
				fill: "color",
				kind: "path",
				stroke: "none",
				strokeWidth: 0,
			},
		]),
	],
	[
		"binder-hole",
		procedural("binder-hole", 1, 0.35, [
			{
				cx: 0.5,
				cy: 0.5,
				fill: "none",
				kind: "circle",
				r: 0.38,
				stroke: "color",
				strokeWidth: 0.16,
			},
		]),
	],
	[
		"triangle",
		procedural("triangle", 1, 0.5, [
			{
				d: "M0.5 0 L1 1 L0 1 Z",
				fill: "color",
				kind: "path",
				stroke: "none",
				strokeWidth: 0,
			},
		]),
	],
]);

/** All procedural and repository-managed motif definitions addressable by decor. */
export const MOTIFS = new Map<MotifDefinition["id"], MotifDefinition>([
	...PROCEDURAL_MOTIFS,
	...MOTIF_ASSETS.map((motif) => [motif.id, motif] as const),
]);
