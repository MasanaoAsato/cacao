import { PAGE_HEIGHT_MM, PAGE_WIDTH_MM, rotatedBounds } from "../decorGeometry";
import type { MotifAsset, MotifAssetId } from "../motifAssets";
import { contrastRatio } from "../recipeSafety";
import { axisRandom } from "../seed";
import type { MotifColor } from "../types";

/** Clearance every decor shape keeps from a printed text rect. */
export const TEXT_CLEARANCE_MM = 1;
/** Absorbs float noise in mm comparisons; far below print precision. */
const GEOMETRY_EPSILON_MM = 1e-6;

/**
 * The one asset allowed to sit under text as a ground. Named explicitly so the
 * exception cannot be widened into a flag any asset may set (20.6).
 */
const GROUND_ASSET_ID: MotifAssetId = "paper-torn-sheet";

/** Body text contrast against the opaque surface printed directly behind it. */
export const FAMILY_TEXT_CONTRAST_RATIO = 7;
/** Large headings may use the WCAG large-text ratio instead. */
export const FAMILY_DISPLAY_CONTRAST_RATIO = 4.5;
export const FAMILY_BODY_FONT_SIZE_PT = 10;
export const FAMILY_UTILITY_FONT_SIZE_PT = 8.5;
/** WCAG's large-text threshold, which justifies the relaxed display ratio. */
export const FAMILY_DISPLAY_FONT_SIZE_PT = 18;

/** Rectangle in mm with the A5 page's top-left corner as the origin. */
export type RectMm = {
	readonly heightMm: number;
	readonly widthMm: number;
	readonly xMm: number;
	readonly yMm: number;
};

export type DecorAnchorKind = "title" | "illustration" | "section" | "unit";

export type DecorLayerId = "under-content" | "over-image";

export type DecorAnchor = {
	readonly id: string;
	readonly kind: DecorAnchorKind;
	readonly rect: RectMm;
	/**
	 * Margin the family's composition already set aside around the anchor for
	 * decor. Owned by the family, never widened by a placement.
	 */
	readonly reserveMm: number;
};

export type DecorPlacement = {
	readonly kind: "asset";
	readonly anchorId: string;
	readonly assetId: MotifAssetId;
	/** A palette colour, or `own` for artwork that keeps its own colours. */
	readonly color: MotifColor;
	readonly layer: DecorLayerId;
	/** Offset from the anchor's top-left corner to the asset box. */
	readonly offsetMm: readonly [number, number];
	/** Inclusive rotation range the seed picks from. */
	readonly rotateDeg: readonly [number, number];
	/** Height of the asset box in mm; the width follows the asset's aspect. */
	readonly sizeMm: number;
};

export type FrameShape = "circle" | "rounded" | "torn";

/** Outline of a photo or card, drawn on the anchor's rect without rotation. */
export type FrameDecoration = {
	readonly kind: "frame";
	readonly anchorId: string;
	readonly fill: MotifColor;
	/** Depth of the torn or perforated cut-in measured from the border. */
	readonly notchMm: number;
	readonly radiusMm: number;
	readonly shape: FrameShape;
	readonly stroke: MotifColor;
	readonly widthMm: number;
};

/** Line between two neighbouring unit anchors of the same day and page. */
export type ConnectorDecoration = {
	readonly kind: "connector";
	readonly color: MotifColor;
	readonly fromUnitId: string;
	readonly toUnitId: string;
	readonly widthMm: number;
};

export type FamilyDecoration =
	| DecorPlacement
	| FrameDecoration
	| ConnectorDecoration;

/** Rect of one printed text element, read from `data-booklet-text-role`. */
export type ProtectedTextRect = {
	readonly rect: RectMm;
	readonly role: string;
};

export type ResolvedDecorAsset = {
	readonly kind: "asset";
	readonly anchorId: string;
	readonly assetId: MotifAssetId;
	/** Bounds of the rotated box; always inside the page. */
	readonly boundsMm: RectMm;
	readonly color: MotifColor;
	readonly definition: MotifAsset;
	readonly heightMm: number;
	readonly instanceIndex: number;
	readonly layer: DecorLayerId;
	readonly rotateDeg: number;
	/** True when the seeded rotation collided and 0° was used instead. */
	readonly rotationFallback: boolean;
	readonly widthMm: number;
	/** Top-left corner of the unrotated box. */
	readonly xMm: number;
	readonly yMm: number;
};

export type ResolvedDecorFrame = {
	readonly kind: "frame";
	readonly anchorId: string;
	readonly fill: MotifColor;
	/** Inner edge of the border band and its cut-in; the face stops here. */
	readonly innerRectMm: RectMm;
	readonly layer: DecorLayerId;
	readonly notchMm: number;
	readonly radiusMm: number;
	readonly rectMm: RectMm;
	readonly shape: FrameShape;
	readonly stroke: MotifColor;
	/** Where text may sit, narrowed to the drawn shape rather than the band. */
	readonly textSafeRectMm: RectMm;
	readonly widthMm: number;
};

export type ResolvedDecorConnector = {
	readonly kind: "connector";
	readonly boundsMm: RectMm;
	readonly color: MotifColor;
	readonly fromMm: readonly [number, number];
	readonly fromUnitId: string;
	readonly layer: DecorLayerId;
	readonly pointsMm: readonly (readonly [number, number])[];
	readonly toMm: readonly [number, number];
	readonly toUnitId: string;
	readonly widthMm: number;
};

export type ResolvedFamilyDecoration =
	| ResolvedDecorAsset
	| ResolvedDecorFrame
	| ResolvedDecorConnector;

export type ResolvedFamilyDecor = {
	readonly items: readonly ResolvedFamilyDecoration[];
	/** `anchorId:instanceIndex` of every asset drawn at 0° after a collision. */
	readonly rotationFallbacks: readonly string[];
};

export type DecorPlacementFailureCode =
	/** An asset, anchor or unit the definition names does not exist. */
	| "decor-unregistered"
	/** A definition value is out of range, or a measured rect is unusable. */
	| "decor-definition-invalid"
	/** The shape does not fit the page or clear the text, even at 0°. */
	| "decor-collision"
	/** A family's text colours or sizes fall below the readable floor. */
	| "family-text-unsafe";

export class DecorPlacementError extends Error {
	readonly code: DecorPlacementFailureCode;

	constructor(code: DecorPlacementFailureCode, message: string) {
		super(message);
		this.code = code;
		this.name = "DecorPlacementError";
	}
}

const PAGE_RECT: RectMm = {
	heightMm: PAGE_HEIGHT_MM,
	widthMm: PAGE_WIDTH_MM,
	xMm: 0,
	yMm: 0,
};

function isUsableRect(rect: RectMm): boolean {
	return (
		[rect.xMm, rect.yMm, rect.widthMm, rect.heightMm].every(Number.isFinite) &&
		rect.widthMm > 0 &&
		rect.heightMm > 0
	);
}

function inflate(rect: RectMm, amountMm: number): RectMm {
	return {
		heightMm: rect.heightMm + 2 * amountMm,
		widthMm: rect.widthMm + 2 * amountMm,
		xMm: rect.xMm - amountMm,
		yMm: rect.yMm - amountMm,
	};
}

function contains(outer: RectMm, inner: RectMm): boolean {
	return (
		inner.xMm >= outer.xMm - GEOMETRY_EPSILON_MM &&
		inner.yMm >= outer.yMm - GEOMETRY_EPSILON_MM &&
		inner.xMm + inner.widthMm <=
			outer.xMm + outer.widthMm + GEOMETRY_EPSILON_MM &&
		inner.yMm + inner.heightMm <=
			outer.yMm + outer.heightMm + GEOMETRY_EPSILON_MM
	);
}

function overlaps(left: RectMm, right: RectMm): boolean {
	return (
		left.xMm < right.xMm + right.widthMm - GEOMETRY_EPSILON_MM &&
		right.xMm < left.xMm + left.widthMm - GEOMETRY_EPSILON_MM &&
		left.yMm < right.yMm + right.heightMm - GEOMETRY_EPSILON_MM &&
		right.yMm < left.yMm + left.heightMm - GEOMETRY_EPSILON_MM
	);
}

function segmentBounds(
	from: readonly [number, number],
	to: readonly [number, number],
	widthMm: number,
): RectMm {
	const half = widthMm / 2;
	return {
		heightMm: Math.abs(to[1] - from[1]) + widthMm,
		widthMm: Math.abs(to[0] - from[0]) + widthMm,
		xMm: Math.min(from[0], to[0]) - half,
		yMm: Math.min(from[1], to[1]) - half,
	};
}

function unionBounds(rects: readonly RectMm[]): RectMm {
	const first = rects[0];
	if (!first) {
		throw new DecorPlacementError(
			"decor-definition-invalid",
			"接続線の経路がありません。",
		);
	}
	const left = Math.min(...rects.map((rect) => rect.xMm));
	const top = Math.min(...rects.map((rect) => rect.yMm));
	const right = Math.max(...rects.map((rect) => rect.xMm + rect.widthMm));
	const bottom = Math.max(...rects.map((rect) => rect.yMm + rect.heightMm));
	return {
		heightMm: bottom - top,
		widthMm: right - left,
		xMm: left,
		yMm: top,
	};
}

function lerp(range: readonly [number, number], t: number): number {
	return range[0] + (range[1] - range[0]) * t;
}

function requirePositive(value: number, name: string): void {
	if (!Number.isFinite(value) || value <= 0) {
		throw new DecorPlacementError(
			"decor-definition-invalid",
			`${name}は有限の正の数で指定してください。`,
		);
	}
}

function requireNonNegative(value: number, name: string): void {
	if (!Number.isFinite(value) || value < 0) {
		throw new DecorPlacementError(
			"decor-definition-invalid",
			`${name}は0以上の有限の数で指定してください。`,
		);
	}
}

function requirePaletteColor(color: MotifColor, name: string): void {
	if (color === "own") {
		throw new DecorPlacementError(
			"decor-definition-invalid",
			`${name}にはpaletteの色を指定してください。`,
		);
	}
}

function indexAnchors(
	anchors: readonly DecorAnchor[],
): ReadonlyMap<string, DecorAnchor> {
	const byId = new Map<string, DecorAnchor>();
	for (const anchor of anchors) {
		if (byId.has(anchor.id)) {
			throw new DecorPlacementError(
				"decor-definition-invalid",
				`装飾の基準「${anchor.id}」がページ内で重複しています。`,
			);
		}
		if (!isUsableRect(anchor.rect)) {
			throw new DecorPlacementError(
				"decor-definition-invalid",
				`装飾の基準「${anchor.id}」の矩形を計測できませんでした。`,
			);
		}
		requireNonNegative(
			anchor.reserveMm,
			`装飾の基準「${anchor.id}」の予約領域`,
		);
		byId.set(anchor.id, anchor);
	}
	return byId;
}

function requireAnchor(
	anchors: ReadonlyMap<string, DecorAnchor>,
	anchorId: string,
): DecorAnchor {
	const anchor = anchors.get(anchorId);
	if (!anchor) {
		throw new DecorPlacementError(
			"decor-unregistered",
			`装飾の基準「${anchorId}」がページにありません。`,
		);
	}
	return anchor;
}

function requireUnitAnchor(
	anchors: ReadonlyMap<string, DecorAnchor>,
	unitId: string,
): DecorAnchor {
	const anchor = requireAnchor(anchors, unitId);
	if (anchor.kind !== "unit") {
		throw new DecorPlacementError(
			"decor-definition-invalid",
			`接続線は掲載単位の基準だけを結べます（「${unitId}」は${anchor.kind}です）。`,
		);
	}
	return anchor;
}

function indexAssets(
	assets: readonly MotifAsset[],
): ReadonlyMap<MotifAssetId, MotifAsset> {
	return new Map(assets.map((asset) => [asset.id, asset] as const));
}

/**
 * Text rects a shape must clear. A rect with no area cannot hold visible ink,
 * so it is dropped instead of becoming a clearance-sized exclusion zone.
 */
function collidableTextRects(
	texts: readonly ProtectedTextRect[],
): readonly RectMm[] {
	return texts.flatMap((text) => {
		if (
			![
				text.rect.xMm,
				text.rect.yMm,
				text.rect.widthMm,
				text.rect.heightMm,
			].every(Number.isFinite) ||
			text.rect.widthMm < 0 ||
			text.rect.heightMm < 0
		) {
			throw new DecorPlacementError(
				"decor-definition-invalid",
				`文字「${text.role}」の矩形を計測できませんでした。`,
			);
		}
		return text.rect.widthMm === 0 || text.rect.heightMm === 0
			? []
			: [text.rect];
	});
}

type ShapeFit = {
	readonly bounds: RectMm;
	/** Set when the shape may sit under text as a ground or an opaque frame. */
	readonly skipTextClearance?: boolean;
	/** Extra region the shape must stay inside, beyond the page. */
	readonly within?: RectMm;
};

function firstTextCollision(
	fit: ShapeFit,
	textRects: readonly RectMm[],
): RectMm | null {
	if (fit.skipTextClearance) {
		return null;
	}
	for (const textRect of textRects) {
		if (overlaps(fit.bounds, inflate(textRect, TEXT_CLEARANCE_MM))) {
			return textRect;
		}
	}
	return null;
}

function fitsPage(fit: ShapeFit): boolean {
	return (
		contains(PAGE_RECT, fit.bounds) &&
		(fit.within === undefined || contains(fit.within, fit.bounds))
	);
}

function resolveAsset(
	placement: DecorPlacement,
	anchor: DecorAnchor,
	definition: MotifAsset,
	instanceIndex: number,
	textRects: readonly RectMm[],
	seedToken: string,
	familyId: string,
	pageId: string,
): ResolvedDecorAsset {
	requirePositive(placement.sizeMm, `装飾「${placement.assetId}」の実寸`);
	for (const [index, offset] of placement.offsetMm.entries()) {
		if (!Number.isFinite(offset)) {
			throw new DecorPlacementError(
				"decor-definition-invalid",
				`装飾「${placement.assetId}」のoffset[${index}]が不正です。`,
			);
		}
	}
	const [minimumDeg, maximumDeg] = placement.rotateDeg;
	if (
		!Number.isFinite(minimumDeg) ||
		!Number.isFinite(maximumDeg) ||
		minimumDeg > maximumDeg ||
		minimumDeg < -180 ||
		maximumDeg > 180
	) {
		throw new DecorPlacementError(
			"decor-definition-invalid",
			`装飾「${placement.assetId}」の回転範囲が不正です。`,
		);
	}
	if (placement.layer === "over-image" && anchor.kind !== "illustration") {
		throw new DecorPlacementError(
			"decor-definition-invalid",
			`over-imageの装飾は写真の基準にだけ置けます（「${anchor.id}」は${anchor.kind}です）。`,
		);
	}
	if ((definition.recolor === "none") !== (placement.color === "own")) {
		throw new DecorPlacementError(
			"decor-definition-invalid",
			`装飾「${placement.assetId}」の着色方式と色指定が一致しません。`,
		);
	}

	const heightMm = placement.sizeMm;
	const widthMm = placement.sizeMm * definition.aspect;
	requirePositive(widthMm, `装飾「${placement.assetId}」の幅`);
	const xMm = anchor.rect.xMm + placement.offsetMm[0];
	const yMm = anchor.rect.yMm + placement.offsetMm[1];
	const within =
		placement.layer === "over-image"
			? inflate(anchor.rect, anchor.reserveMm)
			: undefined;
	const skipTextClearance =
		placement.assetId === GROUND_ASSET_ID &&
		placement.layer === "under-content";

	const seededDeg = lerp(
		[minimumDeg, maximumDeg],
		axisRandom(
			seedToken,
			`decor:${familyId}:${pageId}:${anchor.id}:${instanceIndex}`,
		),
	);
	// The seeded rotation first, then a single attempt at 0° with the same
	// anchor and size. Shrinking, dropping or swapping the asset is not allowed.
	const attempts = seededDeg === 0 ? [0] : [seededDeg, 0];
	for (const rotateDeg of attempts) {
		const fit: ShapeFit = {
			bounds: rotatedBounds(xMm, yMm, widthMm, heightMm, rotateDeg),
			skipTextClearance,
			within,
		};
		if (fitsPage(fit) && firstTextCollision(fit, textRects) === null) {
			return {
				anchorId: anchor.id,
				assetId: placement.assetId,
				boundsMm: fit.bounds,
				color: placement.color,
				definition,
				heightMm,
				instanceIndex,
				kind: "asset",
				layer: placement.layer,
				rotateDeg,
				rotationFallback: rotateDeg !== seededDeg,
				widthMm,
				xMm,
				yMm,
			};
		}
	}
	throw new DecorPlacementError(
		"decor-collision",
		`装飾「${placement.assetId}」を基準「${anchor.id}」に配置できませんでした。`,
	);
}

/**
 * Region inside the frame where text may sit, measured to the inner edge of
 * the ink of the shape that is actually drawn. A circle and a rounded corner
 * pull that edge further in than the rectangular band does, so validating
 * against the band alone would accept text the stroke crosses.
 */
function frameTextSafeRect(
	frame: FrameDecoration,
	rect: RectMm,
	innerRect: RectMm,
): RectMm {
	switch (frame.shape) {
		case "circle": {
			// Largest axis-aligned rect inside the inner circle.
			const radius =
				Math.min(rect.widthMm, rect.heightMm) / 2 -
				(frame.widthMm + frame.notchMm);
			const halfSide = radius / Math.SQRT2;
			return {
				heightMm: 2 * halfSide,
				widthMm: 2 * halfSide,
				xMm: rect.xMm + rect.widthMm / 2 - halfSide,
				yMm: rect.yMm + rect.heightMm / 2 - halfSide,
			};
		}
		case "rounded":
			// Conservative: keep text clear of the whole corner square.
			return inflate(innerRect, -frame.radiusMm);
		case "torn":
			// The cut-ins are already subtracted through `notchMm`.
			return innerRect;
	}
}

function resolveFrame(
	frame: FrameDecoration,
	anchor: DecorAnchor,
	textRects: readonly RectMm[],
): ResolvedDecorFrame {
	requirePositive(frame.widthMm, `枠「${anchor.id}」の枠幅`);
	requireNonNegative(frame.radiusMm, `枠「${anchor.id}」の角丸`);
	requireNonNegative(frame.notchMm, `枠「${anchor.id}」の切り込み`);
	// The fill is the opaque surface text may sit on, so neither part of the
	// frame may keep an asset's own colours.
	requirePaletteColor(frame.fill, `枠「${anchor.id}」の面色`);
	requirePaletteColor(frame.stroke, `枠「${anchor.id}」の枠色`);

	const bandMm = frame.widthMm + frame.notchMm;
	const innerRectMm = inflate(anchor.rect, -bandMm);
	if (!isUsableRect(innerRectMm)) {
		throw new DecorPlacementError(
			"decor-definition-invalid",
			`枠「${anchor.id}」の枠幅と切り込みが基準の矩形より大きいです。`,
		);
	}
	if (!contains(PAGE_RECT, anchor.rect)) {
		throw new DecorPlacementError(
			"decor-collision",
			`枠「${anchor.id}」が紙面に収まりません。`,
		);
	}
	const textSafeRectMm = frameTextSafeRect(frame, anchor.rect, innerRectMm);
	// The opaque face may sit behind text; the border band and its cut-in may
	// not come within the clearance of any text.
	const safeInner = inflate(textSafeRectMm, -TEXT_CLEARANCE_MM);
	for (const textRect of textRects) {
		const insideInner = isUsableRect(safeInner)
			? contains(safeInner, textRect)
			: false;
		const outsideOuter = !overlaps(
			inflate(anchor.rect, TEXT_CLEARANCE_MM),
			textRect,
		);
		if (!insideInner && !outsideOuter) {
			throw new DecorPlacementError(
				"decor-collision",
				`枠「${anchor.id}」の輪郭が文字から${TEXT_CLEARANCE_MM}mm以上離れていません。`,
			);
		}
	}

	return {
		anchorId: anchor.id,
		fill: frame.fill,
		innerRectMm,
		kind: "frame",
		// A photo frame has to read on top of its image; a card frame is the
		// opaque surface under the body text.
		layer: anchor.kind === "illustration" ? "over-image" : "under-content",
		notchMm: frame.notchMm,
		radiusMm: frame.radiusMm,
		rectMm: anchor.rect,
		shape: frame.shape,
		textSafeRectMm,
		stroke: frame.stroke,
		widthMm: frame.widthMm,
	};
}

/**
 * Endpoints on the facing edges of two neighbouring units, so the line runs in
 * the gap the family reserved rather than across either unit's text.
 */
function connectorEndpoints(
	from: RectMm,
	to: RectMm,
	fromUnitId: string,
	toUnitId: string,
): readonly [readonly [number, number], readonly [number, number]] {
	const fromCenterX = from.xMm + from.widthMm / 2;
	const fromCenterY = from.yMm + from.heightMm / 2;
	const toCenterX = to.xMm + to.widthMm / 2;
	const toCenterY = to.yMm + to.heightMm / 2;
	if (to.yMm >= from.yMm + from.heightMm - GEOMETRY_EPSILON_MM) {
		return [
			[fromCenterX, from.yMm + from.heightMm],
			[toCenterX, to.yMm],
		];
	}
	if (from.yMm >= to.yMm + to.heightMm - GEOMETRY_EPSILON_MM) {
		return [
			[fromCenterX, from.yMm],
			[toCenterX, to.yMm + to.heightMm],
		];
	}
	if (to.xMm >= from.xMm + from.widthMm - GEOMETRY_EPSILON_MM) {
		return [
			[from.xMm + from.widthMm, fromCenterY],
			[to.xMm, toCenterY],
		];
	}
	if (from.xMm >= to.xMm + to.widthMm - GEOMETRY_EPSILON_MM) {
		return [
			[from.xMm, fromCenterY],
			[to.xMm + to.widthMm, toCenterY],
		];
	}
	throw new DecorPlacementError(
		"decor-definition-invalid",
		`掲載単位「${fromUnitId}」と「${toUnitId}」は隣り合っていません。`,
	);
}

function resolveConnector(
	connector: ConnectorDecoration,
	anchors: ReadonlyMap<string, DecorAnchor>,
	textRects: readonly RectMm[],
): ResolvedDecorConnector {
	if (connector.fromUnitId === connector.toUnitId) {
		throw new DecorPlacementError(
			"decor-definition-invalid",
			`接続線は同じ掲載単位「${connector.fromUnitId}」を結べません。`,
		);
	}
	requirePositive(
		connector.widthMm,
		`接続線「${connector.fromUnitId}→${connector.toUnitId}」の線幅`,
	);
	requirePaletteColor(
		connector.color,
		`接続線「${connector.fromUnitId}→${connector.toUnitId}」の色`,
	);
	const from = requireUnitAnchor(anchors, connector.fromUnitId);
	const to = requireUnitAnchor(anchors, connector.toUnitId);
	const [fromMm, toMm] = connectorEndpoints(
		from.rect,
		to.rect,
		connector.fromUnitId,
		connector.toUnitId,
	);
	const verticalRoute = Math.abs(toMm[1] - fromMm[1]) >= GEOMETRY_EPSILON_MM;
	const midpoint = verticalRoute
		? (fromMm[1] + toMm[1]) / 2
		: (fromMm[0] + toMm[0]) / 2;
	const pointsMm: readonly (readonly [number, number])[] = verticalRoute
		? [fromMm, [fromMm[0], midpoint], [toMm[0], midpoint], toMm]
		: [fromMm, [midpoint, fromMm[1]], [midpoint, toMm[1]], toMm];
	const segmentRects = pointsMm
		.slice(1)
		.map((point, index) =>
			segmentBounds(
				pointsMm[index] as readonly [number, number],
				point,
				connector.widthMm,
			),
		);
	const fits = segmentRects.every((bounds) => {
		const fit: ShapeFit = { bounds };
		return fitsPage(fit) && firstTextCollision(fit, textRects) === null;
	});
	if (!fits) {
		throw new DecorPlacementError(
			"decor-collision",
			`接続線「${connector.fromUnitId}→${connector.toUnitId}」を配置できませんでした。`,
		);
	}

	return {
		boundsMm: unionBounds(segmentRects),
		color: connector.color,
		fromMm,
		fromUnitId: connector.fromUnitId,
		kind: "connector",
		layer: "under-content",
		pointsMm,
		toMm,
		toUnitId: connector.toUnitId,
		widthMm: connector.widthMm,
	};
}

export type FamilyDecorInput = {
	readonly anchors: readonly DecorAnchor[];
	/** Artwork the family declared for this page; unknown IDs are rejected. */
	readonly assets: readonly MotifAsset[];
	readonly decorations: readonly FamilyDecoration[];
	readonly familyId: string;
	readonly pageId: string;
	readonly protectedTexts: readonly ProtectedTextRect[];
	readonly seedToken: string;
};

/**
 * Resolves one page's decor to mm coordinates on the A5 page and validates the
 * result. Pure, so the same input always yields the same placement. Every
 * failure is raised instead of being hidden by dropping the decor (20.6).
 */
export function resolveFamilyDecor(
	input: FamilyDecorInput,
): ResolvedFamilyDecor {
	const anchors = indexAnchors(input.anchors);
	const assets = indexAssets(input.assets);
	const textRects = collidableTextRects(input.protectedTexts);
	const instanceCounts = new Map<string, number>();
	const items: ResolvedFamilyDecoration[] = [];
	const rotationFallbacks: string[] = [];

	for (const decoration of input.decorations) {
		if (decoration.kind === "connector") {
			items.push(resolveConnector(decoration, anchors, textRects));
			continue;
		}
		const anchor = requireAnchor(anchors, decoration.anchorId);
		if (decoration.kind === "frame") {
			items.push(resolveFrame(decoration, anchor, textRects));
			continue;
		}
		const definition = assets.get(decoration.assetId);
		if (!definition) {
			throw new DecorPlacementError(
				"decor-unregistered",
				`装飾素材「${decoration.assetId}」が登録されていません。`,
			);
		}
		const instanceIndex = instanceCounts.get(anchor.id) ?? 0;
		instanceCounts.set(anchor.id, instanceIndex + 1);
		const resolved = resolveAsset(
			decoration,
			anchor,
			definition,
			instanceIndex,
			textRects,
			input.seedToken,
			input.familyId,
			input.pageId,
		);
		if (resolved.rotationFallback) {
			rotationFallbacks.push(`${anchor.id}:${instanceIndex}`);
		}
		items.push(resolved);
	}

	return Object.freeze({
		items: Object.freeze(items),
		rotationFallbacks: Object.freeze(rotationFallbacks),
	});
}

/** One serialisation of a rect, shared by the renderer and the drawn check. */
export function formatDecorBounds(rect: RectMm): string {
	return [rect.xMm, rect.yMm, rect.widthMm, rect.heightMm]
		.map((value) => value.toFixed(2))
		.join(",");
}

export type FamilyTextRole = "body" | "utility" | "display";

export type FamilyTextStyle = {
	readonly colorHex: string;
	readonly fontSizePt: number;
	readonly role: FamilyTextRole;
};

const TEXT_ROLE_FLOORS: Readonly<
	Record<
		FamilyTextRole,
		{
			readonly contrast: number;
			readonly fontSizePt: number;
			readonly label: string;
		}
	>
> = {
	body: {
		contrast: FAMILY_TEXT_CONTRAST_RATIO,
		fontSizePt: FAMILY_BODY_FONT_SIZE_PT,
		label: "本文",
	},
	display: {
		contrast: FAMILY_DISPLAY_CONTRAST_RATIO,
		fontSizePt: FAMILY_DISPLAY_FONT_SIZE_PT,
		label: "大見出し",
	},
	utility: {
		contrast: FAMILY_TEXT_CONTRAST_RATIO,
		fontSizePt: FAMILY_UTILITY_FONT_SIZE_PT,
		label: "補助文字",
	},
};

/**
 * Readability floor for a family's own text, measured against the opaque
 * surface printed directly behind it. A photo or texture is never treated as
 * the background of a contrast calculation.
 */
export function validateFamilyTextSafety(
	familyId: string,
	surfaceHex: string,
	styles: readonly FamilyTextStyle[],
): void {
	if (styles.length === 0) {
		throw new DecorPlacementError(
			"family-text-unsafe",
			`系統「${familyId}」の文字定義がありません。`,
		);
	}
	for (const style of styles) {
		const floor = TEXT_ROLE_FLOORS[style.role];
		if (
			!Number.isFinite(style.fontSizePt) ||
			style.fontSizePt < floor.fontSizePt
		) {
			throw new DecorPlacementError(
				"family-text-unsafe",
				`系統「${familyId}」の${floor.label}は${floor.fontSizePt}pt以上にしてください。`,
			);
		}
		const ratio = contrastRatio(style.colorHex, surfaceHex);
		if (ratio === null) {
			throw new DecorPlacementError(
				"family-text-unsafe",
				`系統「${familyId}」の${floor.label}の色を解釈できません。`,
			);
		}
		if (ratio < floor.contrast) {
			throw new DecorPlacementError(
				"family-text-unsafe",
				`系統「${familyId}」の${floor.label}のコントラストは${floor.contrast}:1以上にしてください。`,
			);
		}
	}
}
