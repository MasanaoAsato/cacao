import { motifColorVariable } from "../../../theme/decorGeometry";
import {
	type DecorLayerId,
	formatDecorBounds,
	type RectMm,
	type ResolvedDecorAsset,
	type ResolvedDecorConnector,
	type ResolvedDecorFrame,
	type ResolvedFamilyDecor,
} from "../../../theme/families/decorPlacement";
import { MotifShapes, svgId } from "./MotifShapes";

/** Distinguishes the measurement DOM from the printed document in element ids. */
export type DecorIdScope = "measurement" | "output";

export type FamilyDecorLayerProps = {
	readonly decor: ResolvedFamilyDecor;
	readonly layer: DecorLayerId;
	readonly pageId: string;
	readonly scope: DecorIdScope;
};

/** Pitch of the torn edge's cut-ins; the shape is fixed, never randomised. */
const TORN_PITCH_MM = 4;

function lerp(from: number, to: number, t: number): number {
	return from + (to - from) * t;
}

function point(xMm: number, yMm: number): string {
	return `${xMm.toFixed(3)} ${yMm.toFixed(3)}`;
}

/**
 * Rect outline whose edges step in and out by `notchMm`, drawn inside the
 * stroke so the whole frame stays within the anchor's rect.
 */
function tornPath(rect: RectMm, insetMm: number, notchMm: number): string {
	const left = rect.xMm + insetMm;
	const top = rect.yMm + insetMm;
	const right = rect.xMm + rect.widthMm - insetMm;
	const bottom = rect.yMm + rect.heightMm - insetMm;
	const steps = (length: number) =>
		Math.max(2, Math.round(Math.abs(length) / TORN_PITCH_MM));
	const horizontalSteps = steps(right - left);
	const verticalSteps = steps(bottom - top);
	const cut = (index: number) => (index % 2 === 0 ? 0 : notchMm);
	const points: string[] = [];
	for (let index = 0; index <= horizontalSteps; index += 1) {
		points.push(
			point(lerp(left, right, index / horizontalSteps), top + cut(index)),
		);
	}
	for (let index = 1; index <= verticalSteps; index += 1) {
		points.push(
			point(right - cut(index), lerp(top, bottom, index / verticalSteps)),
		);
	}
	for (let index = 1; index <= horizontalSteps; index += 1) {
		points.push(
			point(lerp(right, left, index / horizontalSteps), bottom - cut(index)),
		);
	}
	for (let index = 1; index < verticalSteps; index += 1) {
		points.push(
			point(left + cut(index), lerp(bottom, top, index / verticalSteps)),
		);
	}
	return `M${points.join(" L")} Z`;
}

function DecorAsset({
	item,
	pageId,
	scope,
}: {
	readonly item: ResolvedDecorAsset;
	readonly pageId: string;
	readonly scope: DecorIdScope;
}) {
	const centerX = item.xMm + item.widthMm / 2;
	const centerY = item.yMm + item.heightMm / 2;
	return (
		<g
			data-booklet-decor-anchor={item.anchorId}
			data-booklet-decor-asset={item.assetId}
			data-booklet-decor-bounds={formatDecorBounds(item.boundsMm)}
			data-booklet-decor-index={item.instanceIndex}
			data-booklet-decor-rotation={item.rotateDeg.toFixed(2)}
			data-booklet-decor-rotation-fallback={
				item.rotationFallback ? "true" : undefined
			}
			transform={`translate(${centerX.toFixed(3)} ${centerY.toFixed(3)}) rotate(${item.rotateDeg.toFixed(2)}) translate(${(-item.widthMm / 2).toFixed(3)} ${(-item.heightMm / 2).toFixed(3)}) scale(${item.heightMm.toFixed(4)})`}
		>
			<MotifShapes
				color={motifColorVariable(item.color)}
				definition={item.definition}
				maskId={svgId(
					"booklet-family-decor",
					scope,
					pageId,
					item.anchorId,
					String(item.instanceIndex),
					"mask",
				)}
			/>
		</g>
	);
}

function roundedRectPath(
	rect: RectMm,
	insetMm: number,
	radiusMm: number,
): string {
	const left = rect.xMm + insetMm;
	const top = rect.yMm + insetMm;
	const right = rect.xMm + rect.widthMm - insetMm;
	const bottom = rect.yMm + rect.heightMm - insetMm;
	const radius = Math.max(
		0,
		Math.min(radiusMm, (right - left) / 2, (bottom - top) / 2),
	);
	const arc = (xMm: number, yMm: number) =>
		`A${radius.toFixed(3)} ${radius.toFixed(3)} 0 0 1 ${point(xMm, yMm)}`;
	return [
		`M${point(left + radius, top)}`,
		`L${point(right - radius, top)}`,
		arc(right, top + radius),
		`L${point(right, bottom - radius)}`,
		arc(right - radius, bottom),
		`L${point(left + radius, bottom)}`,
		arc(left, bottom - radius),
		`L${point(left, top + radius)}`,
		arc(left + radius, top),
		"Z",
	].join(" ");
}

function circlePath(rect: RectMm, insetMm: number): string {
	const centerX = rect.xMm + rect.widthMm / 2;
	const centerY = rect.yMm + rect.heightMm / 2;
	const radius = Math.max(
		0,
		Math.min(rect.widthMm, rect.heightMm) / 2 - insetMm,
	);
	const sweep = `A${radius.toFixed(3)} ${radius.toFixed(3)} 0 1 0`;
	return `M${point(centerX - radius, centerY)} ${sweep} ${point(centerX + radius, centerY)} ${sweep} ${point(centerX - radius, centerY)} Z`;
}

function framePath(
	item: ResolvedDecorFrame,
	insetMm: number,
	notchMm: number,
	radiusMm: number,
): string {
	switch (item.shape) {
		case "circle":
			return circlePath(item.rectMm, insetMm);
		case "torn":
			return tornPath(item.rectMm, insetMm, notchMm);
		case "rounded":
			return roundedRectPath(item.rectMm, insetMm, radiusMm);
	}
}

/**
 * The face and the outline of one frame. A card frame's face is the opaque
 * surface the body text sits on, so it covers the whole anchor rect. A photo
 * frame's face is only the border band, so the image stays visible. Neither
 * reaches past `innerRectMm`, which is the edge the text clearance assumes.
 */
function DecorFrame({ item }: { readonly item: ResolvedDecorFrame }) {
	const bandMm = item.widthMm + item.notchMm;
	const face = framePath(
		item,
		0,
		item.notchMm,
		item.radiusMm + item.widthMm / 2,
	);
	const hole =
		item.layer === "over-image"
			? framePath(
					item,
					bandMm,
					0,
					item.radiusMm - item.widthMm / 2 - item.notchMm,
				)
			: null;
	return (
		<g
			data-booklet-decor-anchor={item.anchorId}
			data-booklet-decor-bounds={formatDecorBounds(item.rectMm)}
			data-booklet-decor-frame={item.shape}
		>
			<path
				d={hole === null ? face : `${face} ${hole}`}
				fill={motifColorVariable(item.fill) ?? undefined}
				fillRule={hole === null ? undefined : "evenodd"}
				stroke="none"
			/>
			<path
				d={framePath(item, item.widthMm / 2, item.notchMm, item.radiusMm)}
				fill="none"
				stroke={motifColorVariable(item.stroke) ?? undefined}
				strokeWidth={item.widthMm}
			/>
		</g>
	);
}

function DecorConnector({ item }: { readonly item: ResolvedDecorConnector }) {
	return (
		<polyline
			data-booklet-decor-bounds={formatDecorBounds(item.boundsMm)}
			data-booklet-decor-connector={`${item.fromUnitId}>${item.toUnitId}`}
			fill="none"
			points={item.pointsMm.map((point) => point.join(",")).join(" ")}
			stroke={motifColorVariable(item.color) ?? undefined}
			strokeLinecap="round"
			strokeLinejoin="round"
			strokeWidth={item.widthMm}
		/>
	);
}

/**
 * One decor layer of a family page. `under-content` carries the grounds, cards
 * and connectors that sit behind the opaque body surface; `over-image` carries
 * the tape and photo frames that may cover the illustration but never text.
 */
export function FamilyDecorLayer({
	decor,
	layer,
	pageId,
	scope,
}: FamilyDecorLayerProps) {
	const items = decor.items.filter((item) => item.layer === layer);
	if (items.length === 0) {
		return null;
	}
	return (
		<svg
			aria-hidden="true"
			className={`booklet-family-decor booklet-family-decor--${layer}`}
			data-booklet-decor-layer={layer}
			focusable="false"
			preserveAspectRatio="none"
			viewBox="0 0 148 210"
		>
			{items.map((item, index) => {
				// The resolved order is deterministic, and a family may repeat a
				// frame or a connector on the same anchors, so the position is the
				// only identity that stays unique.
				const key = `${item.kind}-${index}`;
				if (item.kind === "asset") {
					return (
						<DecorAsset key={key} item={item} pageId={pageId} scope={scope} />
					);
				}
				if (item.kind === "frame") {
					return <DecorFrame key={key} item={item} />;
				}
				return <DecorConnector key={key} item={item} />;
			})}
		</svg>
	);
}
