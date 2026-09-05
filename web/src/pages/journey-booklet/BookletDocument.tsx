import type { CSSProperties, ReactNode, RefObject } from "react";
import {
	formatBookletDate,
	formatBookletDateTime,
} from "../../booklet/dateFormat";
import { formatTransportMode } from "../../booklet/itineraryFormat";
import type {
	ArrivalUnit,
	BookletCover,
	BookletDay,
	BookletModel,
	BookletPagePlan,
} from "../../booklet/model";
import {
	getBookletPageSurface,
	getBookletThemeCssVariables,
	getCoverLayoutDefinition,
} from "../../theme/bookletTheme";
import type {
	BookletThemeCandidate,
	CoverVeilBounds,
	ResolvedBookletTheme,
} from "../../theme/types";

export type BookletDocumentProps = {
	readonly coverVeilBounds: CoverVeilBounds;
	readonly model: BookletModel;
	readonly pagePlan: readonly BookletPagePlan[];
	readonly rootRef: RefObject<HTMLElement | null>;
	readonly theme: ResolvedBookletTheme;
};

export type BookletMeasurementProps = {
	readonly model: BookletModel;
	readonly rootRef: RefObject<HTMLDivElement | null>;
	readonly theme: BookletThemeCandidate;
};

function formatMoney(money: {
	readonly amount: number;
	readonly currency: string;
}): string {
	return `${money.amount.toLocaleString("ja-JP")} ${money.currency}`;
}

function titleLengthClass(destination: string): string {
	const length = Array.from(destination).length;
	if (length >= 17) {
		return "booklet-cover__title--very-long";
	}
	return length >= 9 ? "booklet-cover__title--long" : "";
}

function themeClass(theme: BookletThemeCandidate): string {
	return [
		"booklet-theme",
		`booklet-theme--cover-${theme.coverLayoutId}`,
		`booklet-theme--itinerary-${theme.itineraryTemplateId}`,
		`booklet-theme--emphasis-${theme.emphasisId}`,
		`booklet-theme--density-${theme.densityId}`,
		`booklet-theme--palette-${theme.paletteId}`,
		`booklet-theme--mood-${theme.moodId}`,
		`booklet-theme--decor-${theme.decorId}`,
	].join(" ");
}

function themeStyle(theme: BookletThemeCandidate): CSSProperties {
	return getBookletThemeCssVariables(theme) as CSSProperties;
}

const COVER_WIDTH = 148;
const COVER_HEIGHT = 210;
const VEIL_SOLID_MARGIN = 4;
const VEIL_FADE_LENGTH = 16;

function percentage(value: number): string {
	return `${Number((value * 100).toFixed(3))}%`;
}

function CoverVeil({
	bounds,
	theme,
}: {
	readonly bounds: CoverVeilBounds;
	readonly theme: BookletThemeCandidate;
}) {
	const { veil } = getCoverLayoutDefinition(theme.coverLayoutId);
	if (veil === "none") {
		return null;
	}
	const gradientId = `booklet-cover-veil-${theme.resolvedThemeKey}`.replace(
		/[^a-z0-9-]/gi,
		"-",
	);
	const veilStop = (
		<stop
			stopColor="var(--booklet-cover-veil)"
			stopOpacity="var(--booklet-cover-veil-opacity)"
		/>
	);
	let gradient: ReactNode;

	if (veil === "linear-x") {
		const solidEdge = bounds.x + bounds.width + VEIL_SOLID_MARGIN;
		const transparentEdge = solidEdge + VEIL_FADE_LENGTH;
		gradient = (
			<linearGradient
				gradientUnits="userSpaceOnUse"
				id={gradientId}
				x1="0"
				x2={transparentEdge}
				y1="0"
				y2="0"
			>
				{veilStop}
				<stop
					offset={percentage(solidEdge / transparentEdge)}
					stopColor="var(--booklet-cover-veil)"
					stopOpacity="var(--booklet-cover-veil-opacity)"
				/>
				<stop
					offset="100%"
					stopColor="var(--booklet-cover-veil)"
					stopOpacity="0"
				/>
			</linearGradient>
		);
	} else if (veil === "linear-y") {
		const solidEdge = bounds.y - VEIL_SOLID_MARGIN;
		const transparentEdge = solidEdge - VEIL_FADE_LENGTH;
		const gradientLength = COVER_HEIGHT - transparentEdge;
		gradient = (
			<linearGradient
				gradientUnits="userSpaceOnUse"
				id={gradientId}
				x1="0"
				x2="0"
				y1={COVER_HEIGHT}
				y2={transparentEdge}
			>
				{veilStop}
				<stop
					offset={percentage((COVER_HEIGHT - solidEdge) / gradientLength)}
					stopColor="var(--booklet-cover-veil)"
					stopOpacity="var(--booklet-cover-veil-opacity)"
				/>
				<stop
					offset="100%"
					stopColor="var(--booklet-cover-veil)"
					stopOpacity="0"
				/>
			</linearGradient>
		);
	} else {
		const centerX = bounds.x + bounds.width / 2;
		const centerY = bounds.y + bounds.height / 2;
		const outerRadiusX =
			bounds.width / 2 + VEIL_SOLID_MARGIN + VEIL_FADE_LENGTH;
		const outerRadiusY =
			bounds.height / 2 + VEIL_SOLID_MARGIN + VEIL_FADE_LENGTH;
		const innerStop = Math.max(
			(bounds.width / 2 + VEIL_SOLID_MARGIN) / outerRadiusX,
			(bounds.height / 2 + VEIL_SOLID_MARGIN) / outerRadiusY,
		);
		gradient = (
			<radialGradient
				cx={centerX}
				cy={centerY}
				gradientTransform={`translate(${centerX} ${centerY}) scale(1 ${outerRadiusY / outerRadiusX}) translate(${-centerX} ${-centerY})`}
				gradientUnits="userSpaceOnUse"
				id={gradientId}
				r={outerRadiusX}
			>
				{veilStop}
				<stop
					offset={percentage(innerStop)}
					stopColor="var(--booklet-cover-veil)"
					stopOpacity="var(--booklet-cover-veil-opacity)"
				/>
				<stop
					offset="100%"
					stopColor="var(--booklet-cover-veil)"
					stopOpacity="0"
				/>
			</radialGradient>
		);
	}

	return (
		<svg
			aria-hidden="true"
			className="booklet-cover__veil"
			data-booklet-cover-veil={`${bounds.x},${bounds.y},${bounds.width},${bounds.height}`}
			data-booklet-cover-veil-kind={veil}
			focusable="false"
			preserveAspectRatio="none"
			viewBox={`0 0 ${COVER_WIDTH} ${COVER_HEIGHT}`}
		>
			<defs>{gradient}</defs>
			<rect
				fill={`url(#${gradientId})`}
				height={COVER_HEIGHT}
				width={COVER_WIDTH}
			/>
		</svg>
	);
}

function BookletPageSurface({
	pageId,
	theme,
}: {
	readonly pageId: string;
	readonly theme: BookletThemeCandidate;
}) {
	const [startColor, endColor] = getBookletPageSurface(theme);
	const gradientId =
		`booklet-page-surface-${pageId}-${theme.resolvedThemeKey}`.replace(
			/[^a-z0-9-]/gi,
			"-",
		);
	return (
		<svg
			aria-hidden="true"
			className="booklet-page__surface"
			focusable="false"
			preserveAspectRatio="none"
			viewBox="0 0 148 210"
		>
			<defs>
				<linearGradient id={gradientId} x1="0" x2="1" y1="0" y2="1">
					<stop offset="0" stopColor={startColor} />
					<stop offset="1" stopColor={endColor} />
				</linearGradient>
			</defs>
			<rect fill={`url(#${gradientId})`} height="210" width="148" />
		</svg>
	);
}

function CoverContent({
	cover,
	veilBounds,
	theme,
}: {
	readonly cover: BookletCover;
	readonly veilBounds: CoverVeilBounds | null;
	readonly theme: BookletThemeCandidate;
}) {
	return (
		<div className="booklet-cover-content">
			<div className="booklet-cover__frame">
				<img
					className="booklet-cover__image"
					decoding="async"
					height={cover.image.height}
					loading="eager"
					src={cover.image.contentUrl}
					alt={`${cover.destination}の表紙画像`}
					width={cover.image.width}
				/>
			</div>
			{veilBounds ? <CoverVeil bounds={veilBounds} theme={theme} /> : null}
			<div className="booklet-cover__text">
				<div className="booklet-cover__copy" data-booklet-cover-copy="true">
					<p className="booklet-eyebrow" data-booklet-text-role="utility-label">
						TRAVEL JOURNAL
					</p>
					<h1
						className={`booklet-cover__title ${titleLengthClass(cover.destination)}`}
						data-booklet-text-role="cover-destination"
					>
						{cover.destination}
					</h1>
					<p
						className="booklet-cover__route"
						data-booklet-text-role="cover-route"
					>
						{cover.departure} <span aria-hidden="true">→</span>{" "}
						{cover.destination}
					</p>
					<p
						className="booklet-cover__period"
						data-booklet-text-role="cover-period"
					>
						<time dateTime={cover.period.start_date}>
							{formatBookletDate(cover.period.start_date)}
						</time>
						<span aria-hidden="true"> — </span>
						<time dateTime={cover.period.end_date}>
							{formatBookletDate(cover.period.end_date)}
						</time>
					</p>
					<p
						className="booklet-cover__budget"
						data-booklet-text-role="cover-budget"
					>
						予算 {formatMoney(cover.budget)}
					</p>
				</div>
			</div>
		</div>
	);
}

function DayHeader({
	continuation,
	day,
}: {
	readonly continuation: boolean;
	readonly day: BookletDay;
}) {
	return (
		<header
			className={`booklet-day-header${continuation ? " booklet-day-header--continuation" : ""}`}
		>
			<p className="booklet-eyebrow" data-booklet-text-role="utility-label">
				DAY {String(day.dayNumber).padStart(2, "0")}
				{continuation ? "（続き）" : ""}
			</p>
			<h2 data-booklet-text-role="day-title">{formatBookletDate(day.date)}</h2>
		</header>
	);
}

function ArrivalUnitView({
	measurementKey,
	unit,
}: {
	readonly measurementKey?: string;
	readonly unit: ArrivalUnit;
}) {
	return (
		<li
			className="booklet-unit"
			data-booklet-measurement-unit={measurementKey}
			data-unit-id={unit.id}
		>
			<div className="booklet-unit__spot">
				<p
					className="booklet-unit__label"
					data-booklet-text-role="utility-label"
				>
					訪問先
				</p>
				<p className="booklet-unit__time" data-booklet-text-role="unit-time">
					<time dateTime={unit.spot.start_at}>
						{formatBookletDateTime(unit.spot.start_at)}
					</time>
				</p>
				<h3 data-booklet-text-role="spot-name">{unit.spot.name}</h3>
				<div className="booklet-unit__leg">
					<p
						className="booklet-unit__label"
						data-booklet-text-role="utility-label"
					>
						移動
					</p>
					<p
						className="booklet-unit__route"
						data-booklet-text-role="unit-route"
					>
						<span>{unit.leg.from.label}</span>
						<span aria-hidden="true"> → </span>
						<span>{unit.leg.to.label}</span>
					</p>
					<dl className="booklet-unit__details">
						<div>
							<dt data-booklet-text-role="detail-term">交通</dt>
							<dd data-booklet-text-role="detail-value">
								{formatTransportMode(unit.leg.mode)}
							</dd>
						</div>
						<div>
							<dt data-booklet-text-role="detail-term">所要時間</dt>
							<dd data-booklet-text-role="detail-value">
								{unit.leg.duration_minutes}分
							</dd>
						</div>
						<div>
							<dt data-booklet-text-role="detail-term">移動費</dt>
							<dd data-booklet-text-role="detail-value">
								{formatMoney(unit.leg.estimated_cost)}
							</dd>
						</div>
					</dl>
				</div>
				<p
					className="booklet-unit__description"
					data-booklet-text-role="spot-description"
				>
					{unit.spot.description}
				</p>
				<p className="booklet-unit__cost" data-booklet-text-role="unit-cost">
					滞在費 {formatMoney(unit.spot.estimated_cost)}
				</p>
			</div>
		</li>
	);
}

function DayPage({
	day,
	page,
}: {
	readonly day: BookletDay;
	readonly page: Extract<BookletPagePlan, { readonly kind: "day" }>;
}) {
	return (
		<>
			<DayHeader continuation={page.continuation} day={day} />
			<ol className="booklet-day__units booklet-itinerary" aria-label="旅程">
				{page.unitIndexes.map((unitIndex) => {
					const unit = day.units[unitIndex];
					return unit ? <ArrivalUnitView key={unit.id} unit={unit} /> : null;
				})}
			</ol>
		</>
	);
}

function PhysicalPage({
	coverVeilBounds,
	model,
	page,
	theme,
}: {
	readonly coverVeilBounds: CoverVeilBounds;
	readonly model: BookletModel;
	readonly page: BookletPagePlan;
	readonly theme: ResolvedBookletTheme;
}) {
	const pageContent =
		page.kind === "cover" ? (
			<CoverContent
				cover={model.cover}
				theme={theme}
				veilBounds={coverVeilBounds}
			/>
		) : model.days[page.dayIndex] ? (
			<DayPage day={model.days[page.dayIndex]} page={page} />
		) : null;
	const pageClassName = [
		"booklet-page",
		`booklet-page--${page.kind}`,
		page.kind === "day" && page.continuation
			? "booklet-page--day-continuation"
			: null,
	]
		.filter(Boolean)
		.join(" ");

	return (
		<article
			className={pageClassName}
			data-booklet-page="true"
			data-booklet-theme-key={theme.resolvedThemeKey}
			data-page-id={page.pageId}
		>
			{page.kind === "day" ? (
				<BookletPageSurface pageId={page.pageId} theme={theme} />
			) : null}
			<div className="booklet-page__content">{pageContent}</div>
		</article>
	);
}

export function BookletDocument({
	coverVeilBounds,
	model,
	pagePlan,
	rootRef,
	theme,
}: BookletDocumentProps) {
	return (
		<main
			ref={rootRef}
			aria-label="旅のしおり印刷プレビュー"
			className={`booklet-document ${themeClass(theme)}`}
			data-booklet-design={theme.requestedRecipeId}
			data-booklet-theme-key={theme.resolvedThemeKey}
			style={themeStyle(theme)}
		>
			{pagePlan.map((page) => (
				<PhysicalPage
					key={page.pageId}
					coverVeilBounds={coverVeilBounds}
					model={model}
					page={page}
					theme={theme}
				/>
			))}
		</main>
	);
}

function MeasurementDay({
	day,
	dayIndex,
	theme,
}: {
	readonly day: BookletDay;
	readonly dayIndex: number;
	readonly theme: BookletThemeCandidate;
}) {
	return (
		<article className="booklet-page booklet-page--measurement">
			<BookletPageSurface pageId={`measurement-${day.id}`} theme={theme} />
			<div
				className="booklet-page__content"
				data-booklet-measurement-content="true"
			>
				<div className="booklet-measurement__sample">
					<DayHeader continuation={false} day={day} />
					<DayHeader continuation day={day} />
				</div>
				<ol className="booklet-day__units booklet-itinerary" aria-label="旅程">
					{day.units.map((unit, unitIndex) => (
						<ArrivalUnitView
							key={unit.id}
							measurementKey={`${dayIndex}-${unitIndex}`}
							unit={unit}
						/>
					))}
				</ol>
			</div>
		</article>
	);
}

export function BookletMeasurement({
	model,
	rootRef,
	theme,
}: BookletMeasurementProps) {
	return (
		<div
			ref={rootRef}
			aria-hidden="true"
			className={`booklet-measurement ${themeClass(theme)}`}
			data-booklet-design={theme.requestedRecipeId}
			data-booklet-theme-key={theme.resolvedThemeKey}
			style={themeStyle(theme)}
		>
			<article className="booklet-page booklet-page--cover">
				<div
					className="booklet-page__content"
					data-booklet-measurement-content="true"
				>
					<CoverContent cover={model.cover} theme={theme} veilBounds={null} />
				</div>
			</article>
			{model.days.map((day, dayIndex) => (
				<MeasurementDay
					key={day.id}
					day={day}
					dayIndex={dayIndex}
					theme={theme}
				/>
			))}
		</div>
	);
}
