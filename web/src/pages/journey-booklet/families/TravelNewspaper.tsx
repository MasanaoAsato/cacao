import type { CSSProperties, ReactNode } from "react";
import { formatBookletDate } from "../../../booklet/dateFormat";
import type {
	EditorialArrivalUnit,
	EditorialBooklet,
	EditorialDay,
} from "../../../booklet/editorialModel";
import {
	TRAVEL_NEWSPAPER_ARTICLE_GAP_MM,
	TRAVEL_NEWSPAPER_ARTICLE_START_Y_MM,
	TRAVEL_NEWSPAPER_COLUMN_GAP_MM,
	TRAVEL_NEWSPAPER_CONTINUATION_START_Y_MM,
	TRAVEL_NEWSPAPER_PAGE_BOTTOM_Y_MM,
	type TravelNewspaperMeasurements,
	type TravelNewspaperPagePlan,
} from "../../../booklet/families/travelNewspaper";
import { formatTransportMode } from "../../../booklet/itineraryFormat";
import { fontStack } from "../../../theme/families/styleProfiles";
import { travelNewspaperCompositionFor } from "../../../theme/families/travelNewspaper";
import { BookletLayoutError } from "../layoutError";
import type {
	FamilyPalette,
	FamilyTypography,
} from "../program/modules/familyStyle";
import type { EffectMarks } from "../program/sceneParts";
import "./TravelNewspaper.css";

const LAYOUT_TOLERANCE_PX = 1;

type NewspaperStyle = CSSProperties & Record<`--${string}`, string>;

/** The two rule and photo variants of the family CSS. */
export type TravelNewspaperVariant = "city-walk" | "classic-travel";

export function travelNewspaperVariantOf(
	profileId: string,
): TravelNewspaperVariant {
	return profileId.endsWith("city-walk") ? "city-walk" : "classic-travel";
}

/** Neutral inputs of the newspaper style: a registered profile or a direction bundle. */
export type TravelNewspaperStyleInput = {
	readonly compositionId: string;
	readonly palette: FamilyPalette;
	readonly typography: FamilyTypography;
	readonly variant: TravelNewspaperVariant;
};

export function travelNewspaperStyleFor(
	input: TravelNewspaperStyleInput,
): NewspaperStyle {
	const { palette, typography } = input;
	const composition = travelNewspaperCompositionFor(input.compositionId);
	const imageX =
		input.variant === "city-walk"
			? composition.coverImage.cityXmm
			: composition.coverImage.classicXmm;
	return {
		"--newspaper-accent": palette.accent,
		"--newspaper-body-family": fontStack(typography.fontFamilies.body),
		"--newspaper-column-gap": `${composition.columnGapMm}mm`,
		"--newspaper-display-family": fontStack(typography.fontFamilies.display),
		"--newspaper-ink": palette.ink,
		"--newspaper-paper": palette.paper,
		"--newspaper-soft": palette.soft,
		"--newspaper-title-size": `${typography.fontSizesPt.title}pt`,
		"--newspaper-utility-family": fontStack(typography.fontFamilies.utility),
		"--newspaper-cover-left": `${imageX}mm`,
		"--newspaper-cover-width": `${composition.coverImage.widthMm}mm`,
		"--newspaper-cover-height": `${composition.coverImage.heightMm}mm`,
	};
}

function readHeight(element: HTMLElement, name: string): number {
	const rectHeight = element.getBoundingClientRect().height;
	const height = Math.max(
		rectHeight,
		element.scrollHeight > element.clientHeight
			? element.scrollHeight
			: rectHeight,
	);
	if (!Number.isFinite(height) || height <= 0) {
		throw new BookletLayoutError("dom-not-ready", `${name}を計測できません。`);
	}
	return height;
}

function heightMm(element: HTMLElement, scale: number, name: string): number {
	return readHeight(element, name) * scale;
}

function findMeasurementElement(
	root: ParentNode,
	attribute: string,
	value: string,
): HTMLElement | null {
	return (
		Array.from(root.querySelectorAll<HTMLElement>(`[${attribute}]`)).find(
			(element) => element.getAttribute(attribute) === value,
		) ?? null
	);
}

function formatMoney(money: {
	readonly amount: number;
	readonly currency: string;
}): string {
	return `${money.amount.toLocaleString("ja-JP")} ${money.currency}`;
}

function titleFor(day: EditorialDay): string {
	return `DAY ${String(day.dayNumber).padStart(2, "0")}`;
}

/** The family CSS positions these figures but leaves the UA margin in place. */
const SLOT_FIGURE_STYLE: CSSProperties = { margin: 0 };

/**
 * Program scenes pass effect marks for the elements that prove a claim and
 * may replace the heading or the illustration with a transplanted system.
 */
export type TravelNewspaperDayHeaderSlots = {
	/** Program scenes add their section label after the family heading. */
	readonly extra?: ReactNode;
	/** A transplanted heading system drawn in the heading copy's place. */
	readonly heading?: ReactNode;
	/** False on a later scene of the same day; the first one owns the art. */
	readonly illustration?: boolean;
	/** A transplanted image treatment inside the illustration's rect. */
	readonly image?: ReactNode;
	readonly imageMarks?: EffectMarks;
	readonly marks?: EffectMarks;
};

export function DayHeader({
	continuation,
	day,
	slots = {},
}: {
	readonly continuation: boolean;
	readonly day: EditorialDay;
	readonly slots?: TravelNewspaperDayHeaderSlots;
}) {
	return (
		<header
			className={
				continuation
					? "travel-newspaper-day-header travel-newspaper-day-header--continuation"
					: "travel-newspaper-day-header"
			}
			{...slots.marks}
		>
			<div className="travel-newspaper-day-header__copy">
				{slots.heading ?? (
					<>
						<p
							className="travel-newspaper-day-header__label"
							data-booklet-text-role="day-label"
						>
							{titleFor(day)}
							{continuation ? " / 続き" : ""}
						</p>
						<time
							className="travel-newspaper-day-header__date"
							data-booklet-text-role="day-date"
							dateTime={day.date}
						>
							{formatBookletDate(day.date)}
						</time>
						<div
							aria-hidden="true"
							className="travel-newspaper-day-header__rule"
						/>
					</>
				)}
				{slots.extra}
			</div>
			{!continuation && (slots.illustration ?? true) && day.illustration ? (
				slots.image ? (
					<figure
						className="travel-newspaper-day-header__image"
						style={SLOT_FIGURE_STYLE}
						{...slots.imageMarks}
					>
						{slots.image}
					</figure>
				) : (
					<img
						alt=""
						className="travel-newspaper-day-header__image"
						src={day.illustration.contentUrl}
						{...slots.imageMarks}
					/>
				)
			) : null}
		</header>
	);
}

function UnitArticle({
	measurement,
	unit,
}: {
	readonly measurement?: boolean;
	readonly unit: EditorialArrivalUnit;
}) {
	const transport = unit.transportMode
		? formatTransportMode(unit.transportMode)
		: null;
	const duration =
		unit.durationMinutes === null ? null : `${unit.durationMinutes}分`;
	return (
		<article
			className="travel-newspaper-article"
			data-travel-newspaper-card={measurement ? unit.id : undefined}
			data-unit-id={unit.id}
		>
			<time
				className="travel-newspaper-article__time"
				data-booklet-text-role="unit-time"
				dateTime={unit.startAt}
			>
				{unit.timeLabel}
			</time>
			<h3
				className="travel-newspaper-article__name"
				data-booklet-text-role="spot-name"
			>
				{unit.spotName}
			</h3>
			{transport || duration ? (
				<p
					className="travel-newspaper-article__transport"
					data-booklet-text-role="transport-summary"
				>
					{[transport, duration].filter(Boolean).join("・")}
				</p>
			) : null}
			{unit.transportCost ? (
				<p
					className="travel-newspaper-article__cost"
					data-booklet-text-role="transport-cost"
				>
					移動費 {formatMoney(unit.transportCost)}
				</p>
			) : null}
			{unit.stayCost ? (
				<p
					className="travel-newspaper-article__cost"
					data-booklet-text-role="stay-cost"
				>
					滞在費 {formatMoney(unit.stayCost)}
				</p>
			) : null}
		</article>
	);
}

function EmptyDayLabel() {
	return (
		<p
			className="travel-newspaper-empty-day"
			data-booklet-text-role="empty-day"
		>
			予定はありません
		</p>
	);
}

export type TravelNewspaperCoverSlots = {
	/** A transplanted image treatment inside the cover photo's rect. */
	readonly image?: ReactNode;
	readonly imageMarks?: EffectMarks;
	readonly titleMarks?: EffectMarks;
};

/** Cover content inside `.travel-newspaper-page__content`. */
export function TravelNewspaperCover({
	booklet,
	slots = {},
}: {
	readonly booklet: EditorialBooklet;
	readonly slots?: TravelNewspaperCoverSlots;
}) {
	return (
		<>
			<p
				className="travel-newspaper-cover__masthead"
				data-booklet-text-role="masthead"
			>
				旅の通信
			</p>
			<h1
				className="travel-newspaper-cover__title"
				data-booklet-text-role="cover-title"
				{...slots.titleMarks}
			>
				{booklet.cover.title}
			</h1>
			<p
				className="travel-newspaper-cover__period"
				data-booklet-text-role="cover-period"
			>
				<time dateTime={booklet.cover.period.start_date}>
					{formatBookletDate(booklet.cover.period.start_date)}
				</time>{" "}
				—{" "}
				<time dateTime={booklet.cover.period.end_date}>
					{formatBookletDate(booklet.cover.period.end_date)}
				</time>
			</p>
			{slots.image ? (
				<figure
					className="travel-newspaper-cover__image"
					style={SLOT_FIGURE_STYLE}
					{...slots.imageMarks}
				>
					{slots.image}
				</figure>
			) : (
				<img
					alt={booklet.cover.title}
					className="travel-newspaper-cover__image booklet-cover__image"
					src={booklet.cover.image.contentUrl}
					{...slots.imageMarks}
				/>
			)}
		</>
	);
}

export type TravelNewspaperDayPagePlan = Exclude<
	TravelNewspaperPagePlan,
	{ readonly kind: "cover" }
>;

export type TravelNewspaperArticlesSlots = {
	readonly bodyMarks?: EffectMarks;
	readonly header?: TravelNewspaperDayHeaderSlots;
};

/**
 * Article or continuation page content: the day header and the family's own
 * two article columns, never a shared card body.
 */
export function TravelNewspaperArticles({
	booklet,
	page,
	slots = {},
}: {
	readonly booklet: EditorialBooklet;
	readonly page: TravelNewspaperDayPagePlan;
	readonly slots?: TravelNewspaperArticlesSlots;
}) {
	const day = booklet.days[page.dayIndex];
	if (!day) {
		return null;
	}
	const units = page.unitIndexes
		.map((unitIndex) => day.units[unitIndex])
		.filter((unit): unit is EditorialArrivalUnit => unit !== undefined);
	return (
		<>
			<DayHeader
				continuation={page.kind === "continuation"}
				day={day}
				slots={slots.header}
			/>
			<div className="travel-newspaper-articles" {...slots.bodyMarks}>
				{units.length > 0 ? (
					units.map((unit) => <UnitArticle key={unit.id} unit={unit} />)
				) : (
					<EmptyDayLabel />
				)}
			</div>
		</>
	);
}

/**
 * One day's headers and articles as the measurement DOM draws them, inside
 * `.travel-newspaper-page__content`, used by program scenes.
 */
export function TravelNewspaperDayMeasurementSample({
	day,
	headers = {},
}: {
	readonly day: EditorialDay;
	readonly headers?: {
		readonly continuation?: TravelNewspaperDayHeaderSlots;
		readonly first?: TravelNewspaperDayHeaderSlots;
	};
}) {
	return (
		<>
			<DayHeader continuation={false} day={day} slots={headers.first} />
			<DayHeader continuation day={day} slots={headers.continuation} />
			<div className="travel-newspaper-articles travel-newspaper-articles--measurement">
				{day.units.length > 0 ? (
					day.units.map((unit) => (
						<UnitArticle key={unit.id} measurement unit={unit} />
					))
				) : (
					<div
						className="travel-newspaper-empty-day"
						data-travel-newspaper-empty-day-label
					>
						予定はありません
					</div>
				)}
			</div>
		</>
	);
}

export type TravelNewspaperDayHeights = Pick<
	TravelNewspaperMeasurements,
	"continuationHeaderHeightMm" | "dayHeaderHeightMm" | "unitHeightsMm"
>;

/**
 * Header and article heights of every day sample, in mm. A program scene
 * measures its single day with these samples.
 */
export function collectTravelNewspaperDayHeights(
	root: ParentNode,
	booklet: EditorialBooklet,
	scale: number,
): TravelNewspaperDayHeights {
	const unitHeightsMm = new Map<string, number>();
	const dayHeaderHeights: number[] = [];
	const continuationHeaderHeights: number[] = [];

	for (const [dayIndex, day] of booklet.days.entries()) {
		const page = findMeasurementElement(
			root,
			"data-travel-newspaper-measurement-day",
			day.id,
		);
		if (!page) {
			throw new BookletLayoutError(
				"dom-not-ready",
				`Day ${dayIndex + 1}の計測用紙面がありません。`,
			);
		}
		const headers = page.querySelectorAll<HTMLElement>(
			".travel-newspaper-day-header",
		);
		const dayHeader = headers[0];
		const continuationHeader = headers[1];
		if (!dayHeader || !continuationHeader) {
			throw new BookletLayoutError(
				"dom-not-ready",
				`Day ${dayIndex + 1}のヘッダーを計測できません。`,
			);
		}
		dayHeaderHeights.push(
			heightMm(dayHeader, scale, `Day ${dayIndex + 1}の日付ヘッダー`),
		);
		continuationHeaderHeights.push(
			heightMm(continuationHeader, scale, `Day ${dayIndex + 1}の継続ヘッダー`),
		);
		for (const unit of day.units) {
			const card = findMeasurementElement(
				page,
				"data-travel-newspaper-card",
				unit.id,
			);
			if (!card) {
				throw new BookletLayoutError(
					"dom-not-ready",
					`単位「${unit.id}」の計測用記事がありません。`,
				);
			}
			unitHeightsMm.set(unit.id, heightMm(card, scale, `単位「${unit.id}」`));
		}
	}

	const maxOrZero = (values: readonly number[]) =>
		values.length === 0 ? 0 : Math.max(...values);
	return {
		continuationHeaderHeightMm: maxOrZero(continuationHeaderHeights),
		dayHeaderHeightMm: maxOrZero(dayHeaderHeights),
		unitHeightsMm,
	};
}

/** Day heights plus the family's fixed geometry, in the paginator's contract. */
export function travelNewspaperMeasurementsOf(
	days: TravelNewspaperDayHeights,
): TravelNewspaperMeasurements {
	return {
		articleGapMm: TRAVEL_NEWSPAPER_ARTICLE_GAP_MM,
		articleStartYmm: TRAVEL_NEWSPAPER_ARTICLE_START_Y_MM,
		columnGapMm: TRAVEL_NEWSPAPER_COLUMN_GAP_MM,
		continuationHeaderHeightMm: days.continuationHeaderHeightMm,
		continuationStartYmm: TRAVEL_NEWSPAPER_CONTINUATION_START_Y_MM,
		dayHeaderHeightMm: days.dayHeaderHeightMm,
		pageBottomYmm: TRAVEL_NEWSPAPER_PAGE_BOTTOM_Y_MM,
		unitHeightsMm: days.unitHeightsMm,
	};
}

/**
 * Page and text fit of the newspaper pages a program scene draws.
 */
export function ensureTravelNewspaperPagesFit(
	pages: readonly HTMLElement[],
): void {
	for (const page of pages) {
		if (page.scrollWidth > page.clientWidth + LAYOUT_TOLERANCE_PX) {
			throw new BookletLayoutError(
				"page-inline-overflow",
				"travel-newspaperの紙面が横方向にあふれています。",
			);
		}
		if (page.scrollHeight > page.clientHeight) {
			throw new BookletLayoutError(
				"page-block-overflow",
				"travel-newspaperの紙面が縦方向にあふれています。",
			);
		}
	}
	for (const text of pages.flatMap((page) =>
		Array.from(page.querySelectorAll<HTMLElement>("[data-booklet-text-role]")),
	)) {
		const style = getComputedStyle(text);
		if (
			style.overflow === "hidden" ||
			style.overflowX === "hidden" ||
			style.overflowY === "hidden" ||
			style.whiteSpace === "nowrap" ||
			text.scrollWidth > text.clientWidth + LAYOUT_TOLERANCE_PX ||
			text.scrollHeight > text.clientHeight
		) {
			throw new BookletLayoutError(
				"text-inline-overflow",
				`${text.dataset.bookletTextRole ?? "文字"}があふれています。`,
			);
		}
	}
}
