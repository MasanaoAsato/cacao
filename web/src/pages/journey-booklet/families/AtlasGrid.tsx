import type { CSSProperties, ReactNode } from "react";
import { formatBookletDate } from "../../../booklet/dateFormat";
import type {
	EditorialArrivalUnit,
	EditorialBooklet,
	EditorialDay,
} from "../../../booklet/editorialModel";
import type {
	AtlasGridDayMeasurement,
	AtlasGridMeasurement,
	AtlasGridPagePlan,
} from "../../../booklet/families/atlasGrid";
import type { FamilyDecorDesign } from "../../../booklet/family";
import { formatTransportMode } from "../../../booklet/itineraryFormat";
import { atlasGridCompositionFor } from "../../../theme/families/atlasGrid";
import {
	type DecorAnchor,
	type FamilyDecoration,
	resolveFamilyDecor,
} from "../../../theme/families/decorPlacement";
import { fontStack } from "../../../theme/families/styleProfiles";
import { motifAssetsFor } from "../../../theme/motifAssets";
import { FamilyDecorLayer } from "../decor/FamilyDecorLayer";
import { BookletLayoutError } from "../layoutError";
import type {
	FamilyPalette,
	FamilyTypography,
} from "../program/modules/familyStyle";
import type { EffectMarks } from "../program/sceneParts";
import "./AtlasGrid.css";

const COVER_TITLE_SIZES_PT = [40, 34, 28, 22] as const;
const LAYOUT_TOLERANCE_PX = 1;

function formatMoney(money: {
	readonly amount: number;
	readonly currency: string;
}): string {
	return `${money.amount.toLocaleString("ja-JP")} ${money.currency}`;
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

/** The family's own title step-down, starting at the style's title size. */
export function atlasTitleSizes(
	titleSizePt: number | undefined,
): readonly number[] {
	return titleSizePt === undefined
		? COVER_TITLE_SIZES_PT
		: [
				titleSizePt,
				...COVER_TITLE_SIZES_PT.filter((size) => size < titleSizePt),
			];
}

export function measureAtlasCoverTitle(
	root: HTMLElement,
	titleSizesPt: readonly number[],
): number {
	for (const sizePt of titleSizesPt) {
		const title = requiredElement(
			root,
			`[data-atlas-cover-title-size="${sizePt}"]`,
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
 * Row heights of every day sample drawn by `AtlasDayMeasurementSample`; a
 * program scene measures its single day this way.
 */
export function collectAtlasTableMeasurement(
	root: HTMLElement,
	editorial: EditorialBooklet,
): AtlasGridMeasurement {
	const body = requiredElement(root, "[data-atlas-grid-table-body]", "表本体");
	const days: AtlasGridDayMeasurement[] = editorial.days.map(
		(day, dayIndex) => {
			const sample = requiredElement(
				root,
				`[data-atlas-grid-measurement-day="${dayIndex}"]`,
				`Day ${dayIndex + 1}の計測用紙面`,
			);
			return {
				bandHeight: readHeight(
					requiredElement(sample, "[data-atlas-grid-day-band]", "日付帯"),
					`Day ${dayIndex + 1}の日付帯`,
				),
				emptyRowHeight: readHeight(
					requiredElement(sample, "[data-atlas-grid-empty-row]", "空日行"),
					`Day ${dayIndex + 1}の空日行`,
				),
				rowHeights: day.units.map((_unit, unitIndex) =>
					readHeight(
						requiredElement(
							sample,
							`[data-atlas-grid-row="${dayIndex}-${unitIndex}"]`,
							`Day ${dayIndex + 1}の行 ${unitIndex + 1}`,
						),
						`Day ${dayIndex + 1}の行 ${unitIndex + 1}`,
					),
				),
			};
		},
	);
	return { bodyHeight: body.clientHeight, days };
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

export function atlasDecorDefinition(
	page: AtlasGridPagePlan,
	compositionId: string,
): {
	readonly anchors: readonly DecorAnchor[];
	readonly decorations: readonly FamilyDecoration[];
} {
	if (page.kind === "table") {
		return {
			anchors: [anchor("table-compass", "section", 116, 10, 20, 20)],
			decorations: [
				{
					anchorId: "table-compass",
					assetId: "atlas-compass",
					color: "accent",
					kind: "asset",
					layer: "under-content",
					offsetMm: [0, 0],
					rotateDeg: [0, 0],
					sizeMm: 20,
				},
			],
		};
	}
	const routeY = compositionId === "wide-image" ? 157 : 170;
	const anchors: DecorAnchor[] = [
		anchor("cover-route", "section", 10, routeY, 12, 6),
	];
	const decorations: FamilyDecoration[] = [
		{
			anchorId: "cover-route",
			assetId: "atlas-route-mark",
			color: "accent",
			kind: "asset",
			layer: "under-content",
			offsetMm: [0, 0],
			rotateDeg: [0, 0],
			sizeMm: 6,
		},
	];
	if (compositionId === "wide-image") {
		anchors.push(anchor("cover-compass", "section", 116, 10, 20, 20));
		decorations.push({
			anchorId: "cover-compass",
			assetId: "atlas-compass",
			color: "accent",
			kind: "asset",
			layer: "under-content",
			offsetMm: [0, 0],
			rotateDeg: [0, 0],
			sizeMm: 20,
		});
	} else {
		anchors.push(
			anchor("cover-perforation", "illustration", 98, 76, 6, 12, 0.1),
		);
		decorations.push({
			anchorId: "cover-perforation",
			assetId: "atlas-perforation",
			color: "muted",
			kind: "asset",
			layer: "over-image",
			offsetMm: [1.5, 0],
			rotateDeg: [0, 0],
			sizeMm: 12,
		});
	}
	return { anchors, decorations };
}

export function atlasDecorFor(
	page: AtlasGridPagePlan,
	design: FamilyDecorDesign,
) {
	const definition = atlasDecorDefinition(page, design.compositionId);
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

export function atlasDecorationsByPage(
	pagePlan: readonly AtlasGridPagePlan[],
	compositionId: string,
): ReadonlyMap<string, readonly FamilyDecoration[]> {
	return new Map(
		pagePlan.map((page) => [
			page.pageId,
			atlasDecorDefinition(page, compositionId).decorations,
		]),
	);
}

/** Neutral inputs of the atlas style: a registered profile or a direction bundle. */
export type AtlasStyleInput = {
	readonly compositionId: string;
	readonly palette: FamilyPalette;
	readonly photoTreatment: string;
	readonly ruleTreatment: string;
	readonly typography: FamilyTypography;
};

export function atlasStyleFor(input: AtlasStyleInput): CSSProperties {
	const { palette, typography } = input;
	const composition = atlasGridCompositionFor(input.compositionId);
	return {
		"--atlas-accent": palette.accent,
		"--atlas-body-family": fontStack(typography.fontFamilies.body),
		"--atlas-body-size": `${typography.fontSizesPt.body}pt`,
		"--atlas-body-weight": typography.fontWeights.body,
		"--atlas-column-transport": `${composition.columnWidthsMm[2]}mm`,
		"--atlas-column-place": `${composition.columnWidthsMm[1]}mm`,
		"--atlas-column-time": `${composition.columnWidthsMm[0]}mm`,
		"--atlas-ink": palette.ink,
		"--atlas-paper": palette.paper,
		"--atlas-secondary": palette.secondary,
		"--atlas-soft": palette.soft,
		"--atlas-time-size": `${composition.timeFontSizePt}pt`,
		"--booklet-body-family": fontStack(typography.fontFamilies.body),
		"--booklet-body-size": `${typography.fontSizesPt.body}pt`,
		"--atlas-display-family": fontStack(typography.fontFamilies.display),
		"--atlas-display-weight": typography.fontWeights.display,
		"--atlas-photo-border":
			input.photoTreatment === "record-field"
				? "0.7pt solid var(--atlas-accent)"
				: "none",
		"--atlas-photo-padding":
			input.photoTreatment === "record-field" ? "1.5mm" : "0",
		"--atlas-rule-width":
			input.ruleTreatment === "forest-rule" ? "0.7pt" : "0.35pt",
		"--atlas-utility-family": fontStack(typography.fontFamilies.utility),
		"--atlas-utility-size": `${typography.fontSizesPt.utility}pt`,
		"--atlas-utility-weight": typography.fontWeights.utility,
	} as CSSProperties;
}

export function DecorAnchorElement({
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
			className={`atlas-grid-anchor atlas-grid-anchor--${id}`}
			data-booklet-anchor={id}
			data-booklet-anchor-kind={kind}
			data-booklet-anchor-reserve={reserveMm}
		/>
	);
}

/**
 * Program scenes pass effect marks for the elements that prove a claim and
 * may replace the photo with a transplanted image treatment. Measurement
 * passes neither.
 */
export type AtlasCoverSlots = {
	readonly image?: ReactNode;
	readonly imageMarks?: EffectMarks;
	readonly titleMarks?: EffectMarks;
};

export function AtlasCover({
	booklet,
	compositionId,
	measurement,
	slots = {},
	titleSizePt,
	titleSizesPt,
}: {
	readonly booklet: EditorialBooklet;
	readonly compositionId: string;
	readonly measurement: boolean;
	readonly slots?: AtlasCoverSlots;
	readonly titleSizePt: number;
	readonly titleSizesPt: readonly number[];
}) {
	const titleSizes = measurement ? titleSizesPt : [titleSizePt];
	return (
		<div className="atlas-grid-cover">
			{titleSizes.map((sizePt) => (
				<h1
					className={`atlas-grid-cover__title${measurement ? " atlas-grid-cover__title--measurement" : ""}`}
					data-atlas-cover-title-size={sizePt}
					data-booklet-text-role="cover-destination"
					key={sizePt}
					style={{ fontSize: `${sizePt}pt` }}
					{...(measurement ? {} : slots.titleMarks)}
				>
					{booklet.cover.title}
				</h1>
			))}
			<figure className="atlas-grid-cover__image" {...slots.imageMarks}>
				{slots.image ?? (
					<img
						className="booklet-cover__image"
						alt={`${booklet.cover.title}の表紙画像`}
						decoding="async"
						height={booklet.cover.image.height}
						loading="eager"
						src={booklet.cover.image.contentUrl}
						width={booklet.cover.image.width}
					/>
				)}
			</figure>
			<div
				className="atlas-grid-cover__period"
				data-booklet-text-role="cover-period"
			>
				<p>
					<time dateTime={booklet.cover.period.start_date}>
						{formatBookletDate(booklet.cover.period.start_date)}
					</time>
					<span aria-hidden="true"> — </span>
					<time dateTime={booklet.cover.period.end_date}>
						{formatBookletDate(booklet.cover.period.end_date)}
					</time>
				</p>
				{compositionId === "side-index" ? (
					<p className="atlas-grid-cover__days">{booklet.days.length} DAYS</p>
				) : null}
			</div>
			<DecorAnchorElement id="cover-route" kind="section" />
			{compositionId === "wide-image" ? (
				<DecorAnchorElement id="cover-compass" kind="section" />
			) : (
				<DecorAnchorElement
					id="cover-perforation"
					kind="illustration"
					reserveMm={0.1}
				/>
			)}
		</div>
	);
}

export function AtlasDayBand({
	continuation,
	day,
}: {
	readonly continuation: boolean;
	readonly day: EditorialDay;
}) {
	return (
		<tr
			className="atlas-grid-day-band"
			data-atlas-grid-day-band="true"
			data-day-id={day.id}
		>
			<th colSpan={3} scope="rowgroup">
				<span data-booklet-text-role="day-label">
					{day.dayNumber}日目{continuation ? "（続き）" : ""}
				</span>
				<time data-booklet-text-role="day-date" dateTime={day.date}>
					{formatBookletDate(day.date)}
				</time>
			</th>
		</tr>
	);
}

export function AtlasGridRow({
	measurementKey,
	unit,
}: {
	readonly measurementKey?: string;
	readonly unit: EditorialArrivalUnit;
}) {
	return (
		<tr
			className="atlas-grid-row"
			data-atlas-grid-row={measurementKey}
			data-unit-id={unit.id}
		>
			<td className="atlas-grid-cell atlas-grid-cell--time">
				<time data-booklet-text-role="unit-time" dateTime={unit.startAt}>
					{unit.timeLabel}
				</time>
			</td>
			<td className="atlas-grid-cell atlas-grid-cell--place">
				<strong data-booklet-text-role="spot-name">{unit.spotName}</strong>
				{unit.stayCost ? (
					<small data-booklet-text-role="unit-cost">
						滞在費 {formatMoney(unit.stayCost)}
					</small>
				) : null}
			</td>
			<td className="atlas-grid-cell atlas-grid-cell--transport">
				<span data-booklet-text-role="transport-summary">
					{unit.transportMode
						? formatTransportMode(unit.transportMode)
						: "移動情報なし"}
					{unit.durationMinutes !== null ? `・${unit.durationMinutes}分` : ""}
				</span>
				{unit.transportCost ? (
					<small data-booklet-text-role="transport-cost">
						移動費 {formatMoney(unit.transportCost)}
					</small>
				) : null}
			</td>
		</tr>
	);
}

export function AtlasEmptyRow({
	measurement = false,
}: {
	readonly measurement?: boolean;
}) {
	return (
		<tr
			className="atlas-grid-empty-row"
			data-atlas-grid-empty-row={measurement ? "true" : undefined}
		>
			<td colSpan={3} data-booklet-text-role="empty-day">
				予定はありません
			</td>
		</tr>
	);
}

export function AtlasColumnHeadings() {
	return (
		<thead className="atlas-grid-columns">
			<tr>
				<th scope="col">時刻</th>
				<th scope="col">訪問先</th>
				<th scope="col">移動</th>
			</tr>
		</thead>
	);
}

export function AtlasTableHeader({
	continuation,
	extra,
	heading,
	marks,
}: {
	readonly continuation: boolean;
	/** Program scenes add their section label after the family heading. */
	readonly extra?: ReactNode;
	/** A transplanted heading system drawn in the header's place. */
	readonly heading?: ReactNode;
	readonly marks?: EffectMarks;
}) {
	return (
		<>
			<header className="atlas-grid-table__header" {...marks}>
				{heading ?? (
					<>
						<p data-booklet-text-role="utility-label">ITINERARY / ATLAS</p>
						<h2 data-booklet-text-role="page-title">
							旅程一覧{continuation ? "・続き" : ""}
						</h2>
					</>
				)}
				{extra}
			</header>
			<DecorAnchorElement id="table-compass" kind="section" />
		</>
	);
}

export type AtlasTableSlots = {
	readonly bodyMarks?: EffectMarks;
	readonly heading?: ReactNode;
	readonly headingExtra?: ReactNode;
	readonly headingMarks?: EffectMarks;
};

export function AtlasTablePage({
	booklet,
	page,
	slots = {},
}: {
	readonly booklet: EditorialBooklet;
	readonly page: Extract<AtlasGridPagePlan, { readonly kind: "table" }>;
	readonly slots?: AtlasTableSlots;
}) {
	return (
		<>
			<AtlasTableHeader
				continuation={page.sections[0]?.continuation ?? false}
				extra={slots.headingExtra}
				heading={slots.heading}
				marks={slots.headingMarks}
			/>
			<table className="atlas-grid-table">
				<AtlasColumnHeadings />
				<tbody className="atlas-grid-table__body" {...slots.bodyMarks}>
					{page.sections.flatMap((section) => {
						const day = booklet.days[section.dayIndex];
						if (!day) {
							return [];
						}
						return [
							<AtlasDayBand
								continuation={section.continuation}
								day={day}
								key={`${day.id}-band-${section.continuation}`}
							/>,
							...(section.unitIndexes.length === 0
								? [<AtlasEmptyRow key={`${day.id}-empty`} />]
								: section.unitIndexes.flatMap((unitIndex) => {
										const unit = day.units[unitIndex];
										return unit
											? [<AtlasGridRow key={unit.id} unit={unit} />]
											: [];
									})),
						];
					})}
				</tbody>
			</table>
		</>
	);
}

export function AtlasDecor({
	design,
	page,
	scope,
}: {
	readonly design: FamilyDecorDesign;
	readonly page: AtlasGridPagePlan;
	readonly scope: "measurement" | "output";
}) {
	const decor = atlasDecorFor(page, design);
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

/** One day's rows as a program scene's measurement DOM draws them. */
export function AtlasDayMeasurementSample({
	day,
	dayIndex,
	heading,
}: {
	readonly day: EditorialDay;
	readonly dayIndex: number;
	readonly heading?: ReactNode;
}) {
	return (
		<>
			<AtlasTableHeader continuation={false} heading={heading} />
			<table className="atlas-grid-table">
				<AtlasColumnHeadings />
				<tbody
					className="atlas-grid-table__body"
					data-atlas-grid-table-body="true"
				>
					<AtlasDayBand continuation={false} day={day} />
					<AtlasEmptyRow measurement />
					{day.units.map((unit, unitIndex) => (
						<AtlasGridRow
							key={unit.id}
							measurementKey={`${dayIndex}-${unitIndex}`}
							unit={unit}
						/>
					))}
				</tbody>
			</table>
		</>
	);
}
