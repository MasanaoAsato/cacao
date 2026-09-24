import { PAGE_HEIGHT_MM, PAGE_WIDTH_MM } from "../decorGeometry";

/**
 * Type-independent rectangle and text-clearance checks shared by the legacy
 * family decor and the 25.4 artwork slots. An SVG and a WebP get the same
 * 1mm text guard and the same range checks.
 */

/** Clearance every decor shape or artwork keeps from a printed text rect. */
export const TEXT_CLEARANCE_MM = 1;
/** Absorbs float noise in mm comparisons; far below print precision. */
export const GEOMETRY_EPSILON_MM = 1e-6;

/** Rectangle in mm with the A5 page's top-left corner as the origin. */
export type RectMm = {
	readonly heightMm: number;
	readonly widthMm: number;
	readonly xMm: number;
	readonly yMm: number;
};

/** Rect of one printed text element, read from `data-booklet-text-role`. */
export type ProtectedTextRect = {
	readonly rect: RectMm;
	readonly role: string;
};

export const PAGE_RECT: RectMm = Object.freeze({
	heightMm: PAGE_HEIGHT_MM,
	widthMm: PAGE_WIDTH_MM,
	xMm: 0,
	yMm: 0,
});

export function isUsableRect(rect: RectMm): boolean {
	return (
		[rect.xMm, rect.yMm, rect.widthMm, rect.heightMm].every(Number.isFinite) &&
		rect.widthMm > 0 &&
		rect.heightMm > 0
	);
}

export function inflate(rect: RectMm, amountMm: number): RectMm {
	return {
		heightMm: rect.heightMm + 2 * amountMm,
		widthMm: rect.widthMm + 2 * amountMm,
		xMm: rect.xMm - amountMm,
		yMm: rect.yMm - amountMm,
	};
}

export function contains(outer: RectMm, inner: RectMm): boolean {
	return (
		inner.xMm >= outer.xMm - GEOMETRY_EPSILON_MM &&
		inner.yMm >= outer.yMm - GEOMETRY_EPSILON_MM &&
		inner.xMm + inner.widthMm <=
			outer.xMm + outer.widthMm + GEOMETRY_EPSILON_MM &&
		inner.yMm + inner.heightMm <=
			outer.yMm + outer.heightMm + GEOMETRY_EPSILON_MM
	);
}

export function overlaps(left: RectMm, right: RectMm): boolean {
	return (
		left.xMm < right.xMm + right.widthMm - GEOMETRY_EPSILON_MM &&
		right.xMm < left.xMm + left.widthMm - GEOMETRY_EPSILON_MM &&
		left.yMm < right.yMm + right.heightMm - GEOMETRY_EPSILON_MM &&
		right.yMm < left.yMm + left.heightMm - GEOMETRY_EPSILON_MM
	);
}

/** The first text rect that could not be measured, or null. */
export function unmeasurableText(
	texts: readonly ProtectedTextRect[],
): ProtectedTextRect | null {
	return (
		texts.find(
			(text) =>
				![
					text.rect.xMm,
					text.rect.yMm,
					text.rect.widthMm,
					text.rect.heightMm,
				].every(Number.isFinite) ||
				text.rect.widthMm < 0 ||
				text.rect.heightMm < 0,
		) ?? null
	);
}

/**
 * Text rects a shape must clear. A rect with no area cannot hold visible ink,
 * so it is dropped instead of becoming a clearance-sized exclusion zone.
 * Callers reject unmeasurable rects first with `unmeasurableText`.
 */
export function collidableTextRects(
	texts: readonly ProtectedTextRect[],
): readonly RectMm[] {
	return texts.flatMap((text) =>
		text.rect.widthMm === 0 || text.rect.heightMm === 0 ? [] : [text.rect],
	);
}

export function firstTextCollision(
	bounds: RectMm,
	textRects: readonly RectMm[],
	clearanceMm = TEXT_CLEARANCE_MM,
): RectMm | null {
	for (const textRect of textRects) {
		if (overlaps(bounds, inflate(textRect, clearanceMm))) {
			return textRect;
		}
	}
	return null;
}

/** Inside the page and, when given, inside the region the shape belongs to. */
export function fitsWithin(bounds: RectMm, within?: RectMm): boolean {
	return (
		contains(PAGE_RECT, bounds) &&
		(within === undefined || contains(within, bounds))
	);
}

/**
 * Tries the seeded rotation first, then a single attempt at 0°. Shrinking,
 * dropping or swapping the shape is never a fallback.
 */
export function placeWithZeroFallback<T>(
	seededDeg: number,
	attempt: (rotateDeg: number) => T | null,
): { readonly result: T; readonly rotateDeg: number } | null {
	for (const rotateDeg of seededDeg === 0 ? [0] : [seededDeg, 0]) {
		const result = attempt(rotateDeg);
		if (result !== null) return { result, rotateDeg };
	}
	return null;
}

export type ArtworkPlacementCheck = {
	/** Where the artwork is actually drawn. */
	readonly bounds: RectMm;
	readonly protectedTexts: readonly ProtectedTextRect[];
	readonly slotId: string;
	/** The reserved slot rect the artwork must stay inside. */
	readonly within: RectMm;
};

/**
 * Why a drawn artwork is not placed legally, or null. Every format gets the
 * same checks; there is no ground-asset exception for new artwork.
 */
export function artworkPlacementIssue(
	check: ArtworkPlacementCheck,
): string | null {
	if (!isUsableRect(check.bounds) || !isUsableRect(check.within))
		return `素材slot「${check.slotId}」の矩形を計測できませんでした。`;
	const invalid = unmeasurableText(check.protectedTexts);
	if (invalid) return `文字「${invalid.role}」の矩形を計測できませんでした。`;
	if (!fitsWithin(check.bounds, check.within))
		return `素材slot「${check.slotId}」が予約領域またはページからはみ出しています。`;
	const collision = firstTextCollision(
		check.bounds,
		collidableTextRects(check.protectedTexts),
	);
	if (collision)
		return `素材slot「${check.slotId}」が文字から${TEXT_CLEARANCE_MM}mm以上離れていません。`;
	return null;
}
