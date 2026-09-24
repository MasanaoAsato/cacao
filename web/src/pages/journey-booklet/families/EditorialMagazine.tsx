import type { CSSProperties, ReactNode } from "react";
import { formatBookletDate } from "../../../booklet/dateFormat";
import type {
	EditorialArrivalUnit,
	EditorialBooklet,
	EditorialDay,
} from "../../../booklet/editorialModel";
import {
	EDITORIAL_MAGAZINE_ARTICLE_CAPACITY_MM,
	EDITORIAL_MAGAZINE_ARTICLE_START_Y_MM,
	EDITORIAL_MAGAZINE_CARD_GAP_MM,
	EDITORIAL_MAGAZINE_CONTINUATION_CAPACITY_MM,
	EDITORIAL_MAGAZINE_CONTINUATION_START_Y_MM,
	EDITORIAL_MAGAZINE_PAGE_BOTTOM_Y_MM,
	type EditorialMagazineMeasurements,
	type EditorialMagazinePagePlan,
} from "../../../booklet/families/editorialMagazine";
import { editorialMagazineCompositionFor } from "../../../theme/families/editorialMagazine";
import { fontStack } from "../../../theme/families/styleProfiles";
import { BookletLayoutError } from "../layoutError";
import type {
	FamilyPalette,
	FamilyTypography,
} from "../program/modules/familyStyle";
import type { EffectMarks } from "../program/sceneParts";
import "./EditorialMagazine.css";

type MagazineStyle = CSSProperties & Record<`--${string}`, string>;

/** The two photo-feature variants: full-width photo or right-aligned bold crop. */
export type EditorialMagazineVariant = "quiet-photo" | "bold-culture";

export function editorialMagazineVariantOf(
	profileId: string,
): EditorialMagazineVariant {
	return profileId.endsWith("bold-culture") ? "bold-culture" : "quiet-photo";
}

/** The weights the family CSS draws with; it has no weight variables. */
export const EDITORIAL_MAGAZINE_FONT_WEIGHTS: FamilyTypography["fontWeights"] =
	{ body: 400, display: 700, utility: 700 };

/** Neutral inputs of the magazine style: a registered profile or a direction bundle. */
export type EditorialMagazineStyleInput = {
	readonly compositionId: string;
	readonly palette: Pick<FamilyPalette, "accent" | "ink" | "paper">;
	readonly typography: Pick<FamilyTypography, "fontFamilies" | "fontSizesPt">;
	readonly variant: EditorialMagazineVariant;
};

export function editorialMagazineStyleFor(
	input: EditorialMagazineStyleInput,
): MagazineStyle {
	const { palette, typography } = input;
	const composition = editorialMagazineCompositionFor(input.compositionId);
	const coverImage =
		input.variant === "bold-culture"
			? composition.boldCoverImage
			: composition.quietCoverImage;
	return {
		"--editorial-accent": palette.accent,
		"--editorial-body-family": fontStack(typography.fontFamilies.body),
		"--editorial-display-family": fontStack(typography.fontFamilies.display),
		"--editorial-ink": palette.ink,
		"--editorial-paper": palette.paper,
		"--editorial-title-size": `${typography.fontSizesPt.title}pt`,
		"--editorial-utility-family": fontStack(typography.fontFamilies.utility),
		"--editorial-cover-height": `${coverImage.heightMm}mm`,
		"--editorial-cover-left": `${coverImage.xMm}mm`,
		"--editorial-cover-width": `${coverImage.widthMm}mm`,
	};
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

function pageScale(page: HTMLElement): number {
	const width = page.getBoundingClientRect().width;
	if (!Number.isFinite(width) || width <= 0) {
		throw new BookletLayoutError(
			"dom-not-ready",
			"editorial-magazineのページ幅を計測できません。",
		);
	}
	return 148 / width;
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

function formatDate(date: string): string {
	return formatBookletDate(date);
}

function titleFor(day: EditorialDay): string {
	return `DAY ${String(day.dayNumber).padStart(2, "0")}`;
}

/**
 * Program scenes pass effect marks for the elements that prove a claim, and
 * may replace the family heading or illustration with a transplanted one.
 * Without slots the family draws its own heading and illustration.
 */
export type MagazineDayHeaderSlots = {
	/** The section label, beside the family heading without moving it. */
	readonly extra?: ReactNode;
	/** A transplanted heading system drawn in the heading copy's place. */
	readonly heading?: ReactNode;
	/** A transplanted image treatment drawn in the illustration's rect. */
	readonly illustration?: ReactNode;
	readonly illustrationMarks?: EffectMarks;
	readonly marks?: EffectMarks;
};

export function DayHeader({
	continuation,
	day,
	slots = {},
}: {
	readonly continuation: boolean;
	readonly day: EditorialDay;
	readonly slots?: MagazineDayHeaderSlots;
}) {
	return (
		<header
			className={
				continuation
					? "editorial-magazine-day-header editorial-magazine-day-header--continuation"
					: "editorial-magazine-day-header"
			}
			{...slots.marks}
		>
			<div className="editorial-magazine-day-header__copy">
				{slots.extra ? (
					<span
						className="editorial-magazine-day-header__extra"
						style={{ float: "right" }}
					>
						{slots.extra}
					</span>
				) : null}
				{slots.heading ?? (
					<>
						<p
							className="editorial-magazine-day-header__label"
							data-booklet-text-role="day-label"
						>
							{titleFor(day)}
							{continuation ? " / 続き" : ""}
						</p>
						<p
							className="editorial-magazine-day-header__date"
							data-booklet-text-role="day-date"
						>
							{formatDate(day.date)}
						</p>
						<div
							aria-hidden="true"
							className="editorial-magazine-day-header__short-rule"
						/>
					</>
				)}
			</div>
			{!continuation && day.illustration ? (
				slots.illustration ? (
					<span
						className="editorial-magazine-day-header__image"
						{...slots.illustrationMarks}
					>
						{slots.illustration}
					</span>
				) : (
					<img
						alt=""
						className="editorial-magazine-day-header__image"
						src={day.illustration.contentUrl}
						{...slots.illustrationMarks}
					/>
				)
			) : null}
		</header>
	);
}

export function UnitCard({
	measurement,
	unit,
}: {
	readonly measurement?: boolean;
	readonly unit: EditorialArrivalUnit;
}) {
	return (
		<article
			className="editorial-magazine-card"
			data-editorial-magazine-card={measurement ? unit.id : undefined}
			data-unit-id={unit.id}
		>
			<time
				className="editorial-magazine-card__time"
				data-booklet-text-role="unit-time"
				dateTime={unit.startAt}
			>
				{unit.timeLabel}
			</time>
			<h3
				className="editorial-magazine-card__name"
				data-booklet-text-role="spot-name"
			>
				{unit.spotName}
			</h3>
			{unit.description ? (
				<p
					className="editorial-magazine-card__caption"
					data-booklet-text-role="unit-description"
				>
					{unit.description}
				</p>
			) : null}
		</article>
	);
}

export function EmptyDayLabel() {
	return (
		<p
			className="editorial-magazine-empty-day"
			data-booklet-text-role="empty-day"
		>
			予定はありません
		</p>
	);
}

export type MagazineCoverSlots = {
	/** A transplanted image treatment drawn in the cover photo's rect. */
	readonly image?: ReactNode;
	readonly imageMarks?: EffectMarks;
	readonly titleMarks?: EffectMarks;
};

/**
 * The cover page's content. The measurement copy has no rule and no text
 * roles, and marks its title for the cover title measurement.
 */
export function MagazineCover({
	booklet,
	measurement,
	slots = {},
}: {
	readonly booklet: EditorialBooklet;
	readonly measurement: boolean;
	readonly slots?: MagazineCoverSlots;
}) {
	return (
		<div className="editorial-magazine-page__content">
			{measurement ? null : (
				<div aria-hidden="true" className="editorial-magazine-page__rule" />
			)}
			<h1
				className="editorial-magazine-cover__title"
				data-booklet-text-role={measurement ? undefined : "cover-title"}
				data-editorial-magazine-cover-title={measurement ? true : undefined}
				{...(measurement ? {} : slots.titleMarks)}
			>
				{booklet.cover.title}
			</h1>
			<p
				className="editorial-magazine-cover__period"
				data-booklet-text-role={measurement ? undefined : "cover-period"}
			>
				{formatDate(booklet.cover.period.start_date)} —{" "}
				{formatDate(booklet.cover.period.end_date)}
			</p>
			{slots.image ? (
				<span className="editorial-magazine-cover__image" {...slots.imageMarks}>
					{slots.image}
				</span>
			) : (
				<img
					alt={booklet.cover.title}
					className="editorial-magazine-cover__image"
					src={booklet.cover.image.contentUrl}
					{...slots.imageMarks}
				/>
			)}
		</div>
	);
}

/** The reserved body height below the article or continuation header. */
export function magazineBodyHeightMm(continuation: boolean): number {
	return continuation
		? EDITORIAL_MAGAZINE_CONTINUATION_CAPACITY_MM
		: EDITORIAL_MAGAZINE_ARTICLE_CAPACITY_MM;
}

export type MagazineDayPageSlots = MagazineDayHeaderSlots & {
	/**
	 * Program scenes: the card column holds the whole reserved body rect,
	 * so the body claim and overflow checks read the family's real region.
	 */
	readonly bodyRegion?: EffectMarks;
};

/** The content of an article or continuation page. */
export function MagazineDayPage({
	day,
	page,
	slots = {},
}: {
	readonly day: EditorialDay;
	readonly page: Exclude<EditorialMagazinePagePlan, { readonly kind: "cover" }>;
	readonly slots?: MagazineDayPageSlots;
}) {
	const continuation = page.kind === "continuation";
	const units = page.unitIndexes
		.map((unitIndex) => day.units[unitIndex])
		.filter((unit): unit is EditorialArrivalUnit => unit !== undefined);
	const region = slots.bodyRegion;
	return (
		<div className="editorial-magazine-page__content">
			<div aria-hidden="true" className="editorial-magazine-page__rule" />
			<DayHeader continuation={continuation} day={day} slots={slots} />
			<div
				className="editorial-magazine-article-cards"
				data-program-region={region ? "body" : undefined}
				style={
					region
						? {
								alignContent: "start",
								height: `${magazineBodyHeightMm(continuation)}mm`,
							}
						: undefined
				}
				{...region}
			>
				{units.length > 0 ? (
					units.map((unit) => <UnitCard key={unit.id} unit={unit} />)
				) : day.units.length === 0 ? (
					<EmptyDayLabel />
				) : null}
			</div>
		</div>
	);
}

/**
 * One day as the measurement DOM draws it: both headers and every card.
 * Program scenes measure their single day with the same sample.
 */
export function MagazineDayMeasurementSample({
	articleSlots,
	continuationSlots,
	day,
}: {
	readonly articleSlots?: MagazineDayHeaderSlots;
	readonly continuationSlots?: MagazineDayHeaderSlots;
	readonly day: EditorialDay;
}) {
	return (
		<div className="editorial-magazine-page__content">
			<DayHeader continuation={false} day={day} slots={articleSlots} />
			<DayHeader continuation day={day} slots={continuationSlots} />
			<div className="editorial-magazine-article-cards">
				{day.units.length > 0 ? (
					day.units.map((unit) => (
						<UnitCard key={unit.id} measurement unit={unit} />
					))
				) : (
					<div
						className="editorial-magazine-empty-day"
						data-editorial-magazine-empty-day-label
					>
						予定はありません
					</div>
				)}
			</div>
		</div>
	);
}

/** The page a day sample sits in: the sample itself or its program page. */
function samplePageOf(sample: HTMLElement): HTMLElement {
	return sample.matches(".editorial-magazine-page")
		? sample
		: requiredElement(sample, ".editorial-magazine-page", "計測用紙面");
}

function measurementScale(
	root: HTMLElement,
	booklet: EditorialBooklet,
): number {
	const firstPage = root.querySelector<HTMLElement>(
		"[data-editorial-magazine-measurement-day]",
	);
	if (!firstPage && booklet.days.length > 0) {
		throw new BookletLayoutError(
			"dom-not-ready",
			"editorial-magazineの日別計測用DOMがありません。",
		);
	}
	const pageForScale = firstPage
		? samplePageOf(firstPage)
		: requiredElement(root, ".editorial-magazine-page", "計測用紙面");
	return pageScale(pageForScale);
}

function measureDays(
	root: HTMLElement,
	booklet: EditorialBooklet,
	scale: number,
): EditorialMagazineMeasurements {
	const unitHeightsMm = new Map<string, number>();
	const articleHeaderHeights: number[] = [];
	const continuationHeaderHeights: number[] = [];

	for (const [dayIndex, day] of booklet.days.entries()) {
		const page = findMeasurementElement(
			root,
			"data-editorial-magazine-measurement-day",
			day.id,
		);
		if (!page) {
			throw new BookletLayoutError(
				"dom-not-ready",
				`Day ${dayIndex + 1}の計測用紙面がありません。`,
			);
		}
		const headers = page.querySelectorAll<HTMLElement>(
			".editorial-magazine-day-header",
		);
		const articleHeader = headers[0];
		const continuationHeader = headers[1];
		if (!articleHeader || !continuationHeader) {
			throw new BookletLayoutError(
				"dom-not-ready",
				`Day ${dayIndex + 1}のヘッダーを計測できません。`,
			);
		}
		articleHeaderHeights.push(
			heightMm(articleHeader, scale, `Day ${dayIndex + 1}の記事ヘッダー`),
		);
		continuationHeaderHeights.push(
			heightMm(continuationHeader, scale, `Day ${dayIndex + 1}の継続ヘッダー`),
		);
		for (const unit of day.units) {
			const card = findMeasurementElement(
				page,
				"data-editorial-magazine-card",
				unit.id,
			);
			if (!card) {
				throw new BookletLayoutError(
					"dom-not-ready",
					`単位「${unit.id}」の計測用カードがありません。`,
				);
			}
			unitHeightsMm.set(unit.id, heightMm(card, scale, `単位「${unit.id}」`));
		}
	}

	const maxOrZero = (values: readonly number[]) =>
		values.length === 0 ? 0 : Math.max(...values);
	return {
		articleHeaderHeightMm: maxOrZero(articleHeaderHeights),
		articleStartYmm: EDITORIAL_MAGAZINE_ARTICLE_START_Y_MM,
		cardGapMm: EDITORIAL_MAGAZINE_CARD_GAP_MM,
		continuationHeaderHeightMm: maxOrZero(continuationHeaderHeights),
		continuationStartYmm: EDITORIAL_MAGAZINE_CONTINUATION_START_Y_MM,
		pageBottomYmm: EDITORIAL_MAGAZINE_PAGE_BOTTOM_Y_MM,
		unitHeightsMm,
	};
}

/** Header and card heights of the day samples under `root`. */
export function collectEditorialMagazineDayMeasurement(
	root: HTMLElement,
	booklet: EditorialBooklet,
): EditorialMagazineMeasurements {
	return measureDays(root, booklet, measurementScale(root, booklet));
}
