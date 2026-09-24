import type { CSSProperties, ReactNode } from "react";
import { formatBookletDate } from "../../../booklet/dateFormat";
import type {
	EditorialArrivalUnit,
	EditorialBooklet,
	EditorialDay,
} from "../../../booklet/editorialModel";
import type {
	PaperCollageMeasurement as PaperCollageCardMeasurement,
	PaperCollageDayMeasurement,
	PaperCollagePagePlan,
} from "../../../booklet/families/paperCollage";
import type { FamilyDecorDesign } from "../../../booklet/family";
import type { BookletImage } from "../../../booklet/model";
import {
	type DecorAnchor,
	type FamilyDecoration,
	resolveFamilyDecor,
} from "../../../theme/families/decorPlacement";
import { paperCollageCompositionFor } from "../../../theme/families/paperCollage";
import { fontStack } from "../../../theme/families/styleProfiles";
import { motifAssetsFor } from "../../../theme/motifAssets";
import { FamilyDecorLayer } from "../decor/FamilyDecorLayer";
import { BookletLayoutError } from "../layoutError";
import type {
	FamilyPalette,
	FamilyTypography,
} from "../program/modules/familyStyle";
import type { EffectMarks } from "../program/sceneParts";
import "./PaperCollage.css";

const COVER_TITLE_SIZES_PT = [36, 30, 26, 22] as const;
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
export function paperCollageTitleSizes(
	titleSizePt: number | undefined,
): readonly number[] {
	return titleSizePt === undefined
		? COVER_TITLE_SIZES_PT
		: [
				titleSizePt,
				...COVER_TITLE_SIZES_PT.filter((size) => size < titleSizePt),
			];
}

export function measurePaperCollageCoverTitle(
	root: HTMLElement,
	titleSizesPt: readonly number[],
): number {
	for (const sizePt of titleSizesPt) {
		const title = requiredElement(
			root,
			`[data-paper-collage-cover-title-size="${sizePt}"]`,
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
 * Body capacities and card heights of every day sample drawn by
 * `PaperCollageDayMeasurementSample`; a program scene measures its single day.
 */
export function collectPaperCollageMeasurement(
	root: HTMLElement,
	booklet: EditorialBooklet,
): PaperCollageCardMeasurement {
	const firstBody = requiredElement(
		root,
		"[data-paper-collage-first-body]",
		"先頭ページ本文",
	);
	const continuationBody = requiredElement(
		root,
		"[data-paper-collage-continuation-body]",
		"継続ページ本文",
	);
	const page = requiredElement(root, ".booklet-page", "計測用紙面");
	const cardGap = (page.clientWidth / 148) * 5;
	const days: PaperCollageDayMeasurement[] = booklet.days.map(
		(day, dayIndex) => ({
			narrowCardHeights: day.units.map((_unit, unitIndex) =>
				readHeight(
					requiredElement(
						root,
						`[data-paper-collage-card="narrow-${dayIndex}-${unitIndex}"]`,
						`Day ${dayIndex + 1}の狭幅カード ${unitIndex + 1}`,
					),
					`Day ${dayIndex + 1}の狭幅カード ${unitIndex + 1}`,
				),
			),
			wideCardHeights: day.units.map((_unit, unitIndex) =>
				readHeight(
					requiredElement(
						root,
						`[data-paper-collage-card="wide-${dayIndex}-${unitIndex}"]`,
						`Day ${dayIndex + 1}の広幅カード ${unitIndex + 1}`,
					),
					`Day ${dayIndex + 1}の広幅カード ${unitIndex + 1}`,
				),
			),
		}),
	);
	return {
		cardGap,
		continuationBodyHeight: continuationBody.clientHeight,
		days,
		firstBodyHeight: firstBody.clientHeight,
	};
}

function anchor(
	id: string,
	kind: DecorAnchor["kind"],
	xMm: number,
	yMm: number,
	widthMm: number,
	heightMm: number,
	reserveMm = 0,
): DecorAnchor {
	return {
		id,
		kind,
		rect: { heightMm, widthMm, xMm, yMm },
		reserveMm,
	};
}

export function paperCollageDecorDefinition(
	page: PaperCollagePagePlan,
	compositionId: string,
): {
	readonly anchors: readonly DecorAnchor[];
	readonly decorations: readonly FamilyDecoration[];
} {
	const composition = paperCollageCompositionFor(compositionId);
	if (page.kind === "cover") {
		const image = composition.coverImage;
		return {
			anchors: [
				anchor(
					"paper-cover-image",
					"illustration",
					image.xMm,
					image.yMm,
					image.widthMm,
					image.heightMm,
					6,
				),
				anchor("paper-cover-leaf", "section", 118, 166, 12, 24),
			],
			decorations: [
				{
					anchorId: "paper-cover-image",
					assetId: "paper-torn-sheet",
					color: "own",
					kind: "asset",
					layer: "under-content",
					offsetMm: [-4, -4],
					rotateDeg: [-2, 2],
					sizeMm: 90,
				},
				{
					anchorId: "paper-cover-image",
					assetId: "paper-tape",
					color: "own",
					kind: "asset",
					layer: "over-image",
					offsetMm: [44, -4],
					rotateDeg: [-3, 3],
					sizeMm: 8,
				},
				{
					anchorId: "paper-cover-leaf",
					assetId: "paper-leaf",
					color: "accent",
					kind: "asset",
					layer: "under-content",
					offsetMm: [0, 0],
					rotateDeg: [0, 0],
					sizeMm: 24,
				},
			],
		};
	}
	if (page.continuation || page.layoutVariant !== "selected") {
		return { anchors: [], decorations: [] };
	}
	const image = composition.dayImage;
	return {
		anchors: [
			anchor(
				"paper-day-image",
				"illustration",
				image.xMm,
				image.yMm,
				image.widthMm,
				image.heightMm,
				4,
			),
		],
		decorations: [
			{
				anchorId: "paper-day-image",
				assetId: "paper-tape",
				color: "own",
				kind: "asset",
				layer: "over-image",
				offsetMm: [12, -3],
				rotateDeg: [-3, 3],
				sizeMm: 6,
			},
			{
				anchorId: "paper-day-image",
				assetId: "paper-postage",
				color: "accent",
				kind: "asset",
				layer: "over-image",
				offsetMm: [33, 27],
				rotateDeg: [0, 0],
				sizeMm: 9,
			},
		],
	};
}

function paperCollageDecorFor(
	page: PaperCollagePagePlan,
	design: FamilyDecorDesign,
) {
	const definition = paperCollageDecorDefinition(page, design.compositionId);
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

export function paperCollageDecorationsByPage(
	pagePlan: readonly PaperCollagePagePlan[],
	compositionId: string,
): ReadonlyMap<string, readonly FamilyDecoration[]> {
	return new Map(
		pagePlan.map((page) => [
			page.pageId,
			paperCollageDecorDefinition(page, compositionId).decorations,
		]),
	);
}

/** Neutral inputs of the paper style: a registered profile or a direction bundle. */
export type PaperCollageStyleInput = {
	readonly compositionId: string;
	readonly palette: FamilyPalette;
	readonly photoTreatment: string;
	readonly ruleTreatment: string;
	readonly typography: FamilyTypography;
};

export function paperCollageStyleFor(
	input: PaperCollageStyleInput,
): CSSProperties {
	const { palette, typography } = input;
	// The composition only selects CSS classes, but it must be a family one.
	paperCollageCompositionFor(input.compositionId);
	return {
		"--paper-collage-accent": palette.accent,
		"--paper-collage-body-family": fontStack(typography.fontFamilies.body),
		"--paper-collage-body-size": `${typography.fontSizesPt.body}pt`,
		"--paper-collage-body-weight": typography.fontWeights.body,
		"--paper-collage-ink": palette.ink,
		"--paper-collage-paper": palette.paper,
		"--paper-collage-secondary": palette.secondary,
		"--paper-collage-soft": palette.soft,
		"--booklet-body-family": fontStack(typography.fontFamilies.body),
		"--booklet-body-size": `${typography.fontSizesPt.body}pt`,
		"--paper-collage-display-family": fontStack(
			typography.fontFamilies.display,
		),
		"--paper-collage-display-weight": typography.fontWeights.display,
		"--paper-collage-photo-rotation":
			input.photoTreatment === "rotated-paper" ? "-1.5deg" : "0deg",
		"--paper-collage-rule-width":
			input.ruleTreatment === "hand-pasted" ? "1pt" : "0.5pt",
		"--paper-collage-utility-family": fontStack(
			typography.fontFamilies.utility,
		),
		"--paper-collage-utility-size": `${typography.fontSizesPt.utility}pt`,
		"--paper-collage-utility-weight": typography.fontWeights.utility,
	} as CSSProperties;
}

function DecorAnchorElement({
	id,
	kind,
	reserveMm,
}: {
	readonly id: string;
	readonly kind: DecorAnchor["kind"];
	readonly reserveMm?: number;
}) {
	return (
		<span
			aria-hidden="true"
			className={`paper-collage-anchor paper-collage-anchor--${id}`}
			data-booklet-anchor={id}
			data-booklet-anchor-kind={kind}
			data-booklet-anchor-reserve={reserveMm}
		/>
	);
}

function PaperPhoto({
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
	/** A transplanted image treatment drawn inside the family's own frame. */
	readonly replacement?: ReactNode;
	readonly title: string;
}) {
	return (
		<figure className={className} {...marks}>
			{replacement ?? (
				<img
					alt={`${title}の旅のイメージ`}
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

/**
 * Program scenes pass effect marks for the elements that prove a claim and
 * may replace the photo with a transplanted image treatment. The measurement
 * sample passes neither.
 */
export type PaperCollageCoverSlots = {
	readonly image?: ReactNode;
	readonly imageMarks?: EffectMarks;
	readonly titleMarks?: EffectMarks;
};

export function PaperCollageCover({
	booklet,
	measurement,
	slots = {},
	titleSizePt,
	titleSizesPt,
}: {
	readonly booklet: EditorialBooklet;
	readonly measurement: boolean;
	readonly slots?: PaperCollageCoverSlots;
	readonly titleSizePt: number;
	readonly titleSizesPt: readonly number[];
}) {
	const titleSizes = measurement ? titleSizesPt : [titleSizePt];
	return (
		<div className="paper-collage-cover">
			{titleSizes.map((sizePt) => (
				<h1
					className={`paper-collage-cover__title${measurement ? " paper-collage-cover__title--measurement" : ""}`}
					data-booklet-text-role="cover-destination"
					data-paper-collage-cover-title-size={sizePt}
					key={sizePt}
					style={{ fontSize: `${sizePt}pt` }}
					{...(measurement ? {} : slots.titleMarks)}
				>
					{booklet.cover.title}
				</h1>
			))}
			<PaperPhoto
				className="paper-collage-cover__image"
				image={booklet.cover.image}
				imageClassName="booklet-cover__image"
				marks={slots.imageMarks}
				replacement={slots.image}
				title={booklet.cover.title}
			/>
			<p
				className="paper-collage-cover__period"
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
				id="paper-cover-image"
				kind="illustration"
				reserveMm={6}
			/>
			<DecorAnchorElement id="paper-cover-leaf" kind="section" />
		</div>
	);
}

function PaperCollageCard({
	measurementKey,
	unit,
}: {
	readonly measurementKey?: string;
	readonly unit: EditorialArrivalUnit;
}) {
	return (
		<article
			className="paper-collage-card"
			data-paper-collage-card={measurementKey}
			data-unit-id={unit.id}
		>
			<time data-booklet-text-role="unit-time" dateTime={unit.startAt}>
				{unit.timeLabel}
			</time>
			<h3 data-booklet-text-role="spot-name">{unit.spotName}</h3>
			{unit.description !== null ? (
				<p data-booklet-text-role="unit-description">{unit.description}</p>
			) : null}
		</article>
	);
}

function PaperCollageColumn({
	day,
	unitIndexes,
}: {
	readonly day: EditorialDay;
	readonly unitIndexes: readonly number[];
}) {
	return (
		<div className="paper-collage-column">
			{unitIndexes.map((unitIndex) => {
				const unit = day.units[unitIndex];
				return unit ? <PaperCollageCard key={unit.id} unit={unit} /> : null;
			})}
		</div>
	);
}

/** What a program scene adds to or replaces in the family's day header. */
export type PaperCollageDayHeaderSlots = {
	/** A transplanted heading system drawn in the heading region's place. */
	readonly heading?: ReactNode;
	/** Program scenes add their section label after the family heading. */
	readonly headingExtra?: ReactNode;
	readonly headingMarks?: EffectMarks;
	readonly image?: ReactNode;
	readonly imageMarks?: EffectMarks;
};

export function PaperCollageDayHeader({
	booklet,
	day,
	page,
	slots = {},
}: {
	readonly booklet: EditorialBooklet;
	readonly day: EditorialDay;
	readonly page: Pick<
		Extract<PaperCollagePagePlan, { readonly kind: "day" }>,
		"continuation" | "layoutVariant"
	>;
	readonly slots?: PaperCollageDayHeaderSlots;
}) {
	const showImage = !page.continuation && page.layoutVariant === "selected";
	return (
		<header
			className={`paper-collage-day-header${showImage ? " paper-collage-day-header--photo" : " paper-collage-day-header--compact"}`}
			data-day-id={day.id}
		>
			{showImage ? (
				<>
					<PaperPhoto
						className="paper-collage-day-header__image"
						image={day.illustration ?? booklet.cover.image}
						marks={slots.imageMarks}
						replacement={slots.image}
						title={booklet.cover.title}
					/>
					<DecorAnchorElement
						id="paper-day-image"
						kind="illustration"
						reserveMm={4}
					/>
				</>
			) : null}
			<div
				className="paper-collage-day-header__heading"
				{...slots.headingMarks}
			>
				{slots.heading ?? (
					<>
						<p data-booklet-text-role="day-label">
							Day {String(day.dayNumber).padStart(2, "0")}
							{page.continuation ? "・続き" : ""}
						</p>
						<h2 data-booklet-text-role="day-date">
							<time dateTime={day.date}>{formatBookletDate(day.date)}</time>
						</h2>
					</>
				)}
				{slots.headingExtra}
			</div>
		</header>
	);
}

export type PaperCollageDaySlots = PaperCollageDayHeaderSlots & {
	readonly bodyMarks?: EffectMarks;
};

export function PaperCollageDayPage({
	booklet,
	page,
	slots = {},
}: {
	readonly booklet: EditorialBooklet;
	readonly page: Extract<PaperCollagePagePlan, { readonly kind: "day" }>;
	readonly slots?: PaperCollageDaySlots;
}) {
	const day = booklet.days[page.dayIndex];
	if (!day) {
		return null;
	}
	const { bodyMarks, ...headerSlots } = slots;
	return (
		<>
			<PaperCollageDayHeader
				booklet={booklet}
				day={day}
				page={page}
				slots={headerSlots}
			/>
			<div
				className={`paper-collage-columns paper-collage-columns--${page.layoutVariant}${page.continuation ? " paper-collage-columns--continuation" : ""}`}
				{...bodyMarks}
			>
				{day.units.length === 0 ? (
					<p className="paper-collage-empty" data-booklet-text-role="empty-day">
						予定はありません
					</p>
				) : (
					<>
						<PaperCollageColumn day={day} unitIndexes={page.columns[0] ?? []} />
						{page.columns[1] ? (
							<PaperCollageColumn day={day} unitIndexes={page.columns[1]} />
						) : null}
					</>
				)}
			</div>
		</>
	);
}

export function PaperCollageDecor({
	design,
	page,
	scope,
}: {
	readonly design: FamilyDecorDesign;
	readonly page: PaperCollagePagePlan;
	readonly scope: "measurement" | "output";
}) {
	const decor = paperCollageDecorFor(page, design);
	return (
		<>
			<FamilyDecorLayer
				decor={decor}
				layer="under-content"
				pageId={page.pageId}
				scope={scope}
			/>
			<FamilyDecorLayer
				decor={decor}
				layer="over-image"
				pageId={page.pageId}
				scope={scope}
			/>
		</>
	);
}

/** An empty body container of the height the family reserves for its cards. */
export function PaperCollageMeasurementBody({
	frame,
}: {
	readonly frame: "first" | "continuation";
}) {
	return frame === "first" ? (
		<div
			className="paper-collage-measurement-body paper-collage-measurement-body--first"
			data-paper-collage-first-body="true"
		/>
	) : (
		<div
			className="paper-collage-measurement-body paper-collage-measurement-body--continuation"
			data-paper-collage-continuation-body="true"
		/>
	);
}

export const PAPER_COLLAGE_CARD_WIDTHS = ["narrow", "wide"] as const;

/** One day's cards at one width as the measurement DOM draws them; shared with program scenes. */
export function PaperCollageDayMeasurementSample({
	day,
	dayIndex,
	width,
}: {
	readonly day: EditorialDay;
	readonly dayIndex: number;
	readonly width: (typeof PAPER_COLLAGE_CARD_WIDTHS)[number];
}) {
	return (
		<div
			className={`paper-collage-measurement-cards paper-collage-measurement-cards--${width}`}
		>
			{day.units.map((unit, unitIndex) => (
				<PaperCollageCard
					key={unit.id}
					measurementKey={`${width}-${dayIndex}-${unitIndex}`}
					unit={unit}
				/>
			))}
		</div>
	);
}
