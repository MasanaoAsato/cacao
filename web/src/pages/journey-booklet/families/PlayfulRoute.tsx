import type { CSSProperties, ReactNode } from "react";
import { formatBookletDate } from "../../../booklet/dateFormat";
import type {
	EditorialArrivalUnit,
	EditorialBooklet,
	EditorialDay,
} from "../../../booklet/editorialModel";
import type {
	PlayfulRouteDayMeasurement,
	PlayfulRouteMeasurement,
	PlayfulRoutePagePlan,
} from "../../../booklet/families/playfulRoute";
import type { FamilyDecorDesign } from "../../../booklet/family";
import { formatTransportMode } from "../../../booklet/itineraryFormat";
import type { BookletImage } from "../../../booklet/model";
import {
	type DecorAnchor,
	type FamilyDecoration,
	resolveFamilyDecor,
} from "../../../theme/families/decorPlacement";
import {
	PLAYFUL_ROUTE_COVER_SUN_ASSET_ID,
	type PlayfulRouteDecorSlotId,
	type PlayfulRouteDecorVariant,
	playfulRouteCompositionFor,
	playfulRouteDecorVariantFor,
} from "../../../theme/families/playfulRoute";
import { fontStack } from "../../../theme/families/styleProfiles";
import { motifAssetsFor } from "../../../theme/motifAssets";
import { FamilyDecorLayer } from "../decor/FamilyDecorLayer";
import { BookletLayoutError } from "../layoutError";
import type {
	FamilyPalette,
	FamilyTypography,
} from "../program/modules/familyStyle";
import type { EffectMarks } from "../program/sceneParts";
import "./PlayfulRoute.css";

const COVER_TITLE_SIZES_PT = [40, 34, 28, 22] as const;
const LAYOUT_TOLERANCE_PX = 1;

function requiredElement(
	root: ParentNode,
	selector: string,
	name: string,
): HTMLElement {
	const element = root.querySelector<HTMLElement>(selector);
	if (!element) {
		throw new BookletLayoutError("dom-not-ready", `${name}がありません。`);
	}
	return element;
}

function readHeight(element: HTMLElement, name: string): number {
	const height = Math.max(
		element.getBoundingClientRect().height,
		element.offsetHeight,
		element.scrollHeight,
	);
	if (!Number.isFinite(height) || height <= 0) {
		throw new BookletLayoutError("dom-not-ready", `${name}を計測できません。`);
	}
	return height;
}

/** The family's own title step-down, starting at the style's title size. */
export function playfulRouteTitleSizes(
	titleSizePt: number | undefined,
): readonly number[] {
	return titleSizePt === undefined
		? COVER_TITLE_SIZES_PT
		: [
				titleSizePt,
				...COVER_TITLE_SIZES_PT.filter((size) => size < titleSizePt),
			];
}

export function measurePlayfulRouteCoverTitle(
	root: HTMLElement,
	titleSizesPt: readonly number[],
): number {
	for (const sizePt of titleSizesPt) {
		const title = requiredElement(
			root,
			`[data-playful-route-cover-title-size="${sizePt}"]`,
			`${sizePt}ptの表紙題名`,
		);
		if (
			title.scrollWidth <= title.clientWidth + LAYOUT_TOLERANCE_PX &&
			title.scrollHeight <= title.clientHeight + LAYOUT_TOLERANCE_PX
		) {
			return sizePt;
		}
	}
	throw new BookletLayoutError(
		"cover-block-overflow",
		`表紙の都市名が${titleSizesPt.at(-1)}ptでも予約領域に収まりません。`,
	);
}

/**
 * Body capacities and block heights of every day sample. A program scene
 * measures its single day with these samples.
 */
export function collectPlayfulRouteDayMeasurement(
	root: HTMLElement,
	booklet: EditorialBooklet,
	compositionId: string,
): PlayfulRouteMeasurement {
	const page = requiredElement(root, ".booklet-page", "計測用紙面");
	const pageWidth = page.getBoundingClientRect().width || page.clientWidth;
	if (!Number.isFinite(pageWidth) || pageWidth <= 0) {
		throw new BookletLayoutError(
			"dom-not-ready",
			"計測用紙面の幅を計測できません。",
		);
	}
	const mmPerPx = 148 / pageWidth;
	const firstBody = requiredElement(
		root,
		"[data-playful-route-first-body]",
		"先頭ページ本文",
	);
	const continuationBody = requiredElement(
		root,
		"[data-playful-route-continuation-body]",
		"継続ページ本文",
	);
	const days: PlayfulRouteDayMeasurement[] = booklet.days.map(
		(day, dayIndex) => ({
			selectedBlockHeights: day.units.map(
				(_unit, unitIndex) =>
					readHeight(
						requiredElement(
							root,
							`[data-playful-route-block="selected-${dayIndex}-${unitIndex}"]`,
							`Day ${dayIndex + 1}の選択幅ブロック ${unitIndex + 1}`,
						),
						`Day ${dayIndex + 1}の選択幅ブロック ${unitIndex + 1}`,
					) * mmPerPx,
			),
			wideBlockHeights: day.units.map(
				(_unit, unitIndex) =>
					readHeight(
						requiredElement(
							root,
							`[data-playful-route-block="wide-${dayIndex}-${unitIndex}"]`,
							`Day ${dayIndex + 1}の広幅ブロック ${unitIndex + 1}`,
						),
						`Day ${dayIndex + 1}の広幅ブロック ${unitIndex + 1}`,
					) * mmPerPx,
			),
		}),
	);
	const composition = playfulRouteCompositionFor(compositionId);
	return {
		blockGap: 8,
		continuationBodyHeight:
			readHeight(continuationBody, "継続ページ本文") * mmPerPx,
		days,
		firstBodyHeight: readHeight(firstBody, "先頭ページ本文") * mmPerPx,
		selectedBlockWidth: composition.blockWidthMm,
		wideBlockWidth: 128,
	};
}

function textOf(root: ParentNode, selector: string, name: string): string {
	return requiredElement(root, selector, name).textContent?.trim() ?? "";
}

function sameValues(
	actual: readonly string[],
	expected: readonly string[],
): boolean {
	return (
		actual.length === expected.length &&
		actual.every((value, index) => value === expected[index])
	);
}

/** The family's own day label, e.g. `Day 02`. */
export function playfulRouteDayLabel(dayNumber: number): string {
	return `Day ${String(dayNumber).padStart(2, "0")}`;
}

/**
 * Verifies that one drawn day page of a program scene preserves the
 * editorial model: its heading, and each unit's order, time, spot and
 * transport. `label` is null when a transplanted heading replaced the
 * family's label and date.
 */
export function ensurePlayfulRouteDayPageContent(
	pageElement: HTMLElement,
	day: EditorialDay,
	page: PlayfulRouteDayPage,
	expected: {
		readonly label: string | null;
		readonly ordinalOffset: number;
		readonly unitLabel: string | null;
	},
): void {
	if (
		expected.label !== null &&
		(textOf(pageElement, '[data-booklet-text-role="day-label"]', "日見出し") !==
			`${expected.label}${page.continuation ? "・続き" : ""}` ||
			textOf(pageElement, '[data-booklet-text-role="day-date"]', "日付") !==
				formatBookletDate(day.date))
	) {
		throw new BookletLayoutError(
			"dom-not-ready",
			`ページ「${page.pageId}」の日見出しが掲載モデルと一致しません。`,
		);
	}
	const planned = page.unitIndexes.map((unitIndex) => {
		const unit = day.units[unitIndex];
		if (!unit) {
			throw new BookletLayoutError(
				"dom-not-ready",
				`ページ「${page.pageId}」の掲載単位がモデルにありません。`,
			);
		}
		return { ordinal: expected.ordinalOffset + unitIndex + 1, unit };
	});
	const blocks = Array.from(
		pageElement.querySelectorAll<HTMLElement>(
			".playful-route-block[data-unit-id]",
		),
	);
	if (
		!sameValues(
			blocks.map((block) => block.dataset.unitId ?? ""),
			planned.map(({ unit }) => unit.id),
		)
	) {
		throw new BookletLayoutError(
			"dom-not-ready",
			`ページ「${page.pageId}」の掲載単位ID順がページ計画と一致しません。`,
		);
	}
	blocks.forEach((block, index) => {
		const item = planned[index];
		if (!item) return;
		const actualTransport = block.querySelector<HTMLElement>(
			'[data-booklet-text-role="unit-transport"]',
		)?.textContent;
		const actualLabel = block.querySelector<HTMLElement>(
			'[data-booklet-text-role="unit-label"]',
		)?.textContent;
		if (
			textOf(block, '[data-booklet-text-role="unit-order"]', "掲載順") !==
				String(item.ordinal).padStart(2, "0") ||
			textOf(block, '[data-booklet-text-role="unit-time"]', "時刻") !==
				item.unit.timeLabel ||
			textOf(block, '[data-booklet-text-role="spot-name"]', "訪問先") !==
				item.unit.spotName ||
			(actualTransport?.trim() ?? null) !==
				playfulRouteTransportLabel(item.unit) ||
			(actualLabel?.trim() ?? null) !== expected.unitLabel
		) {
			throw new BookletLayoutError(
				"dom-not-ready",
				`掲載単位「${item.unit.id}」の表示文字が掲載モデルと一致しません。`,
			);
		}
	});
}

function anchor(
	id: string,
	kind: DecorAnchor["kind"],
	xMm: number,
	yMm: number,
	widthMm: number,
	heightMm: number,
): DecorAnchor {
	return {
		id,
		kind,
		rect: { heightMm, widthMm, xMm, yMm },
		reserveMm: 0,
	};
}

function unitAnchorId(unit: EditorialArrivalUnit): string {
	return `route-unit-${unit.id}`;
}

/** Fills one reserved decor region with the artwork the variant chose (20.11). */
function slotDecoration(
	slotId: PlayfulRouteDecorSlotId,
	variant: PlayfulRouteDecorVariant,
): FamilyDecoration {
	const slot = variant.slots[slotId];
	return {
		anchorId: slotId,
		assetId: slot.assetId,
		color: slot.color,
		kind: "asset",
		layer: "under-content",
		offsetMm: slot.offsetMm,
		rotateDeg: [0, 0],
		sizeMm: slot.sizeMm,
	};
}

/**
 * `ordinalOffset` is the day-running position of the booklet day's first
 * unit; a program scene that starts mid-day keeps the zigzag of its numbers.
 */
export function playfulRouteDecorDefinition(
	page: PlayfulRoutePagePlan,
	compositionId: string,
	decorVariantId: string | null,
	booklet: EditorialBooklet,
	ordinalOffset = 0,
): {
	readonly anchors: readonly DecorAnchor[];
	readonly decorations: readonly FamilyDecoration[];
} {
	const composition = playfulRouteCompositionFor(compositionId);
	const variant = playfulRouteDecorVariantFor(decorVariantId);
	if (page.kind === "cover") {
		const positions =
			compositionId === "zigzag"
				? {
						bag: [10, 148, 18, 24] as const,
						burst: [10, 68, 24, 12] as const,
						sun: [116, 10, 20, 20] as const,
					}
				: {
						bag: [50, 154, 18, 24] as const,
						burst: [10, 70, 24, 12] as const,
						sun: [18, 150, 24, 24] as const,
					};
		const anchors = [
			anchor(
				"playful-cover-sun",
				"section",
				positions.sun[0],
				positions.sun[1],
				positions.sun[2],
				positions.sun[3],
			),
			anchor(
				"playful-cover-bag",
				"section",
				positions.bag[0],
				positions.bag[1],
				positions.bag[2],
				positions.bag[3],
			),
			anchor(
				"playful-cover-burst",
				"section",
				positions.burst[0],
				positions.burst[1],
				positions.burst[2],
				positions.burst[3],
			),
		];
		return {
			anchors,
			decorations: [
				{
					anchorId: "playful-cover-sun",
					assetId: PLAYFUL_ROUTE_COVER_SUN_ASSET_ID,
					color: "muted",
					kind: "asset",
					layer: "under-content",
					offsetMm: [0, 0],
					rotateDeg: [0, 0],
					sizeMm: positions.sun[3],
				},
				slotDecoration("playful-cover-bag", variant),
				slotDecoration("playful-cover-burst", variant),
			],
		};
	}

	const day = booklet.days[page.dayIndex];
	if (!day) {
		return { anchors: [], decorations: [] };
	}
	const compact = page.continuation || page.layoutVariant !== "selected";
	const bodyTopMm = compact ? 34 : 52;
	const widthMm =
		page.layoutVariant === "wide-ribbon" ? 128 : composition.blockWidthMm;
	let yMm = bodyTopMm;
	const unitAnchors: DecorAnchor[] = [];
	page.unitIndexes.forEach((unitIndex, index) => {
		const unit = day.units[unitIndex];
		const heightMm = page.blockHeightsMm[index];
		if (!unit || heightMm === undefined) {
			return;
		}
		const xMm =
			compositionId === "zigzag" &&
			page.layoutVariant !== "wide-ribbon" &&
			(ordinalOffset + unitIndex) % 2 === 1
				? 34
				: 10;
		unitAnchors.push(
			anchor(unitAnchorId(unit), "unit", xMm, yMm, widthMm, heightMm),
		);
		yMm += heightMm + 8;
	});
	const connectorDecorations: FamilyDecoration[] = page.unitIndexes
		.slice(1)
		.flatMap((unitIndex, index) => {
			const from = day.units[page.unitIndexes[index] ?? -1];
			const to = day.units[unitIndex];
			return from && to
				? [
						{
							color: "accent" as const,
							fromUnitId: unitAnchorId(from),
							kind: "connector" as const,
							toUnitId: unitAnchorId(to),
							widthMm: 0.8,
						},
					]
				: [];
		});
	return {
		anchors: [
			...unitAnchors,
			anchor("playful-day-squiggle", "section", 62, 194, 24, 8),
		],
		decorations: [
			...connectorDecorations,
			slotDecoration("playful-day-squiggle", variant),
		],
	};
}

/** What the family decor reads from a program profile scene. */
export type PlayfulRouteDecorDesign = FamilyDecorDesign & {
	readonly decorVariantId: string | null;
};

export function playfulRouteDecorFor(
	page: PlayfulRoutePagePlan,
	design: PlayfulRouteDecorDesign,
	booklet: EditorialBooklet,
	ordinalOffset = 0,
) {
	const definition = playfulRouteDecorDefinition(
		page,
		design.compositionId,
		design.decorVariantId,
		booklet,
		ordinalOffset,
	);
	return resolveFamilyDecor({
		anchors: definition.anchors,
		assets: motifAssetsFor(design.decorAssetIds),
		decorations: definition.decorations,
		familyId: design.familyId,
		pageId: page.pageId,
		protectedTexts: [],
		seedToken: design.seedToken,
	});
}

export function playfulRouteDecorationsByPage(
	pagePlan: readonly PlayfulRoutePagePlan[],
	compositionId: string,
	decorVariantId: string | null,
	booklet: EditorialBooklet,
	ordinalOffset = 0,
): ReadonlyMap<string, readonly FamilyDecoration[]> {
	return new Map(
		pagePlan.map((page) => [
			page.pageId,
			playfulRouteDecorDefinition(
				page,
				compositionId,
				decorVariantId,
				booklet,
				ordinalOffset,
			).decorations,
		]),
	);
}

/** Neutral inputs of the playful style: a registered profile or a direction bundle. */
export type PlayfulRouteStyleInput = {
	readonly compositionId: string;
	readonly palette: FamilyPalette;
	readonly photoTreatment: string;
	readonly ruleTreatment: string;
	readonly typography: FamilyTypography;
};

export function playfulRouteStyleFor(
	input: PlayfulRouteStyleInput,
): CSSProperties {
	const { palette, typography: profile } = input;
	const composition = playfulRouteCompositionFor(input.compositionId);
	return {
		"--booklet-itinerary-accent": palette.accent,
		"--booklet-itinerary-border": palette.secondary,
		"--booklet-itinerary-muted": palette.soft,
		"--playful-route-body-family": fontStack(profile.fontFamilies.body),
		"--playful-route-body-size": `${profile.fontSizesPt.body}pt`,
		"--playful-route-body-weight": profile.fontWeights.body,
		"--playful-route-accent": palette.accent,
		"--playful-route-ink": palette.ink,
		"--playful-route-paper": palette.paper,
		"--playful-route-secondary": palette.secondary,
		"--playful-route-selected-width": `${composition.blockWidthMm}mm`,
		"--playful-route-soft": palette.soft,
		"--booklet-body-family": fontStack(profile.fontFamilies.body),
		"--booklet-body-size": `${profile.fontSizesPt.body}pt`,
		"--playful-route-display-family": fontStack(profile.fontFamilies.display),
		"--playful-route-display-weight": profile.fontWeights.display,
		"--playful-route-photo-radius":
			input.photoTreatment === "diary-photo" ? "4mm" : "8mm",
		"--playful-route-rule-width":
			input.ruleTreatment === "hand-drawn-route" ? "0.8pt" : "0.6mm",
		"--playful-route-utility-family": fontStack(profile.fontFamilies.utility),
		"--playful-route-utility-size": `${profile.fontSizesPt.utility}pt`,
		"--playful-route-utility-weight": profile.fontWeights.utility,
	} as CSSProperties;
}

export function DecorAnchorElement({
	className,
	id,
}: {
	readonly className: string;
	readonly id: string;
}) {
	return (
		<span
			aria-hidden="true"
			className={className}
			data-booklet-anchor={id}
			data-booklet-anchor-kind="section"
		/>
	);
}

function RoutePhoto({
	className,
	image,
	imageClassName,
	marks,
	replacement,
	title,
}: {
	readonly className: string;
	readonly image: BookletImage;
	readonly imageClassName?: string;
	readonly marks?: EffectMarks;
	/** A transplanted image treatment drawn inside the family's figure. */
	readonly replacement?: ReactNode;
	readonly title: string;
}) {
	return (
		<figure className={className} {...marks}>
			{replacement ?? (
				<img
					alt={playfulRoutePhotoAlt(title)}
					className={imageClassName}
					decoding="async"
					height={image.height}
					loading="eager"
					src={image.contentUrl}
					width={image.width}
				/>
			)}
		</figure>
	);
}

/** Alt text of the family's photos; a transplanted image keeps it. */
export function playfulRoutePhotoAlt(title: string): string {
	return `${title}の旅のイメージ`;
}

/**
 * Program scenes pass effect marks for the elements that prove a claim and
 * may replace the photo with a transplanted image treatment. Both are
 * optional; without them the cover is drawn with the family's own photo.
 */
export type PlayfulRouteCoverSlots = {
	readonly image?: ReactNode;
	readonly imageMarks?: EffectMarks;
	readonly titleMarks?: EffectMarks;
};

export function PlayfulRouteCover({
	booklet,
	measurement,
	slots = {},
	titleSizePt,
	titleSizesPt,
}: {
	readonly booklet: EditorialBooklet;
	readonly measurement: boolean;
	readonly slots?: PlayfulRouteCoverSlots;
	readonly titleSizePt: number;
	readonly titleSizesPt: readonly number[];
}) {
	const titleSizes = measurement ? titleSizesPt : [titleSizePt];
	return (
		<div className="playful-route-cover">
			{titleSizes.map((sizePt) => (
				<div
					className={`playful-route-cover__title${measurement ? " playful-route-cover__title--measurement" : ""}`}
					data-playful-route-cover-title-size={sizePt}
					key={sizePt}
					{...(measurement ? {} : slots.titleMarks)}
				>
					<p data-booklet-text-role="cover-label">旅のしおり</p>
					<h1
						data-booklet-text-role="cover-destination"
						style={{ fontSize: `${sizePt}pt` }}
					>
						{booklet.cover.title}
					</h1>
				</div>
			))}
			<RoutePhoto
				className="playful-route-cover__image"
				image={booklet.cover.image}
				imageClassName="booklet-cover__image"
				marks={slots.imageMarks}
				replacement={slots.image}
				title={booklet.cover.title}
			/>
			<p
				className="playful-route-cover__period"
				data-booklet-text-role="cover-period"
			>
				<time dateTime={booklet.cover.period.start_date}>
					{formatBookletDate(booklet.cover.period.start_date)}
				</time>
				<span aria-hidden="true"> — </span>
				<time dateTime={booklet.cover.period.end_date}>
					{formatBookletDate(booklet.cover.period.end_date)}
				</time>
			</p>
			<DecorAnchorElement
				className="playful-route-anchor playful-route-anchor--cover-sun"
				id="playful-cover-sun"
			/>
			<DecorAnchorElement
				className="playful-route-anchor playful-route-anchor--cover-bag"
				id="playful-cover-bag"
			/>
			<DecorAnchorElement
				className="playful-route-anchor playful-route-anchor--cover-burst"
				id="playful-cover-burst"
			/>
		</div>
	);
}

export function playfulRouteTransportLabel(
	unit: EditorialArrivalUnit,
): string | null {
	const parts = [
		unit.transportMode ? formatTransportMode(unit.transportMode) : null,
		unit.durationMinutes === null ? null : `${unit.durationMinutes}分`,
	].filter((part): part is string => part !== null);
	return parts.length === 0 ? null : parts.join("・");
}

export function PlayfulRouteBlock({
	heightMm,
	measurementKey,
	ordinal,
	unit,
	unitLabel,
}: {
	readonly heightMm?: number;
	readonly measurementKey?: string;
	readonly ordinal: number;
	readonly unit: EditorialArrivalUnit;
	/** The per-unit label of a direction's day header, e.g. EVENT. */
	readonly unitLabel?: string | null;
}) {
	const transport = playfulRouteTransportLabel(unit);
	return (
		<article
			className={`playful-route-block playful-route-block--${ordinal % 2 === 0 ? "right" : "left"}`}
			data-booklet-anchor={unitAnchorId(unit)}
			data-booklet-anchor-kind="unit"
			data-playful-route-block={measurementKey}
			data-unit-id={unit.id}
			style={heightMm === undefined ? undefined : { height: `${heightMm}mm` }}
		>
			<span
				className="playful-route-block__number"
				data-booklet-text-role="unit-order"
			>
				{String(ordinal).padStart(2, "0")}
			</span>
			<div className="playful-route-block__content">
				{unitLabel ? (
					<p data-booklet-text-role="unit-label">{unitLabel}</p>
				) : null}
				<time data-booklet-text-role="unit-time" dateTime={unit.startAt}>
					{unit.timeLabel}
				</time>
				<h3 data-booklet-text-role="spot-name">{unit.spotName}</h3>
				{transport ? (
					<p data-booklet-text-role="unit-transport">{transport}</p>
				) : null}
			</div>
		</article>
	);
}

type PlayfulRouteDayPage = Extract<
	PlayfulRoutePagePlan,
	{ readonly kind: "day" }
>;

/**
 * Program slots of the day header. Without them the family's own label,
 * date and photo are drawn.
 */
export type PlayfulRouteDayHeaderSlots = {
	/** Program section label placed after the family's own heading. */
	readonly extra?: ReactNode;
	/** A transplanted heading system drawn in the heading's place. */
	readonly heading?: ReactNode;
	readonly image?: ReactNode;
	readonly imageMarks?: EffectMarks;
	/** Replaces the family's `Day 01` with a direction's own day label. */
	readonly label?: string;
	readonly marks?: EffectMarks;
	/**
	 * False when another scene of the same day already placed the
	 * illustration. The header keeps its geometry; only the photo is absent.
	 */
	readonly showIllustration?: boolean;
};

export function RouteDayHeader({
	booklet,
	day,
	page,
	slots = {},
}: {
	readonly booklet: EditorialBooklet;
	readonly day: EditorialDay;
	readonly page: PlayfulRouteDayPage;
	readonly slots?: PlayfulRouteDayHeaderSlots;
}) {
	const showImage = !page.continuation && page.layoutVariant === "selected";
	return (
		<header
			className={`playful-route-day-header${showImage ? " playful-route-day-header--image" : " playful-route-day-header--compact"}`}
			data-day-id={day.id}
			{...slots.marks}
		>
			<div className="playful-route-day-header__heading">
				{slots.heading ?? (
					<>
						<p data-booklet-text-role="day-label">
							{slots.label ?? <>Day {String(day.dayNumber).padStart(2, "0")}</>}
							{page.continuation ? "・続き" : ""}
						</p>
						<h2 data-booklet-text-role="day-date">
							<time dateTime={day.date}>{formatBookletDate(day.date)}</time>
						</h2>
					</>
				)}
				{slots.extra}
			</div>
			{showImage && slots.showIllustration !== false ? (
				<RoutePhoto
					className="playful-route-day-header__image"
					image={day.illustration ?? booklet.cover.image}
					marks={slots.imageMarks}
					replacement={slots.image}
					title={booklet.cover.title}
				/>
			) : null}
		</header>
	);
}

export type PlayfulRouteDaySlots = PlayfulRouteDayHeaderSlots & {
	readonly bodyMarks?: EffectMarks;
	/** Day-running position of the day's first unit (a mid-day scene). */
	readonly ordinalOffset?: number;
	readonly unitLabel?: string | null;
};

export function RouteDayPage({
	booklet,
	page,
	slots = {},
}: {
	readonly booklet: EditorialBooklet;
	readonly page: PlayfulRouteDayPage;
	readonly slots?: PlayfulRouteDaySlots;
}) {
	const day = booklet.days[page.dayIndex];
	if (!day) {
		return null;
	}
	const ordinalOffset = slots.ordinalOffset ?? 0;
	return (
		<>
			<RouteDayHeader booklet={booklet} day={day} page={page} slots={slots} />
			<div
				className={`playful-route-blocks playful-route-blocks--${page.layoutVariant}${page.continuation ? " playful-route-blocks--continuation" : ""}`}
				{...slots.bodyMarks}
			>
				{day.units.length === 0 ? (
					<p className="playful-route-empty" data-booklet-text-role="empty-day">
						予定はありません
					</p>
				) : (
					page.unitIndexes.map((unitIndex, index) => {
						const unit = day.units[unitIndex];
						return unit ? (
							<PlayfulRouteBlock
								heightMm={page.blockHeightsMm[index]}
								key={unit.id}
								ordinal={ordinalOffset + unitIndex + 1}
								unit={unit}
								unitLabel={slots.unitLabel}
							/>
						) : null;
					})
				)}
			</div>
			<DecorAnchorElement
				className="playful-route-anchor playful-route-anchor--day-squiggle"
				id="playful-day-squiggle"
			/>
		</>
	);
}

export function PlayfulDecor({
	booklet,
	design,
	ordinalOffset = 0,
	page,
	scope,
}: {
	readonly booklet: EditorialBooklet;
	readonly design: PlayfulRouteDecorDesign;
	readonly ordinalOffset?: number;
	readonly page: PlayfulRoutePagePlan;
	readonly scope: "measurement" | "output";
}) {
	const decor = playfulRouteDecorFor(page, design, booklet, ordinalOffset);
	return (
		<FamilyDecorLayer
			decor={decor}
			layer="under-content"
			pageId={page.pageId}
			scope={scope}
		/>
	);
}

/** The empty first and continuation bodies whose heights are the capacities. */
export function PlayfulRouteMeasurementBodies() {
	return (
		<>
			<div
				className="playful-route-measurement-body playful-route-measurement-body--first"
				data-playful-route-first-body="true"
			/>
			<div
				className="playful-route-measurement-body playful-route-measurement-body--continuation"
				data-playful-route-continuation-body="true"
			/>
		</>
	);
}

/** One day's blocks at both widths as the measurement DOM draws them. */
export function PlayfulRouteDayMeasurementSample({
	day,
	dayIndex,
	ordinalOffset = 0,
	unitLabel,
}: {
	readonly day: EditorialDay;
	readonly dayIndex: number;
	readonly ordinalOffset?: number;
	readonly unitLabel?: string | null;
}) {
	return (
		<>
			{(["selected", "wide"] as const).map((width) => (
				<div
					className={`playful-route-measurement-blocks playful-route-measurement-blocks--${width}`}
					key={`${day.id}-${width}`}
				>
					{day.units.map((unit, unitIndex) => (
						<PlayfulRouteBlock
							key={unit.id}
							measurementKey={`${width}-${dayIndex}-${unitIndex}`}
							ordinal={ordinalOffset + unitIndex + 1}
							unit={unit}
							unitLabel={unitLabel}
						/>
					))}
				</div>
			))}
		</>
	);
}
