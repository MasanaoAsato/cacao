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
	getCompositionDefinition,
	getCoverLayoutDefinition,
	getDecorDefinition,
} from "../../theme/bookletTheme";
import { motifColorVariable } from "../../theme/decorGeometry";
import { getDecorLayer } from "../../theme/decorLayer";
import { MOTIFS } from "../../theme/motifs";
import type {
	BookletThemeCandidate,
	CoverVeilBounds,
	MotifDefinition,
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
		`booklet-theme--unit-${theme.unitFormId}`,
		`booklet-theme--composition-${theme.compositionId}`,
		`booklet-theme--ink-${theme.inkStyleId}`,
		`booklet-theme--rule-${getDecorDefinition(theme.decorId).rule}`,
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

function svgId(...parts: readonly string[]): string {
	return parts.join("-").replace(/[^a-z0-9-]/gi, "-");
}

function paint(
	value: "color" | "none",
	color: string | null,
): string | undefined {
	if (value === "none") {
		return "none";
	}
	return color ?? undefined;
}

/** Draws one motif's shapes in its unit box (`aspect` wide, 1 high). */
function MotifShapes({
	color,
	definition,
	maskId,
}: {
	readonly color: string | null;
	readonly definition: MotifDefinition;
	readonly maskId: string;
}) {
	if (definition.kind === "asset") {
		if (definition.recolor === "mask" && color) {
			return (
				<>
					<mask id={maskId}>
						<image
							height="1"
							href={definition.src}
							preserveAspectRatio="none"
							width={definition.aspect}
						/>
					</mask>
					<rect
						fill={color}
						height="1"
						mask={`url(#${maskId})`}
						width={definition.aspect}
					/>
				</>
			);
		}
		return (
			<image
				height="1"
				href={definition.src}
				preserveAspectRatio="none"
				width={definition.aspect}
			/>
		);
	}
	return (
		<>
			{definition.shapes.map((shape, index) => {
				const key = `${definition.id}-${index}`;
				const common = {
					fill: paint(shape.fill, color),
					stroke: paint(shape.stroke, color),
					strokeWidth: shape.strokeWidth,
				};
				switch (shape.kind) {
					case "circle":
						return (
							<circle
								key={key}
								cx={shape.cx}
								cy={shape.cy}
								r={shape.r}
								{...common}
							/>
						);
					case "rect":
						return (
							<rect
								key={key}
								height={shape.height}
								width={shape.width}
								x={shape.x}
								y={shape.y}
								{...common}
							/>
						);
					default:
						return (
							<path
								key={key}
								d={shape.d}
								strokeDasharray={
									shape.dashed
										? `${shape.strokeWidth * 3} ${shape.strokeWidth * 3}`
										: undefined
								}
								{...common}
							/>
						);
				}
			})}
		</>
	);
}

function formatBounds(bounds: {
	readonly xMm: number;
	readonly yMm: number;
	readonly widthMm: number;
	readonly heightMm: number;
}): string {
	return [bounds.xMm, bounds.yMm, bounds.widthMm, bounds.heightMm]
		.map((value) => value.toFixed(2))
		.join(",");
}

/**
 * The page decor (18.4): page gradient, then the decor set's ground, its
 * motifs, and finally the sheet panel the body text sits on. All of it is one
 * inline SVG under the body content, so the PDF keeps it as vectors.
 */
function BookletPageSurface({
	groundImageUrl,
	pageId,
	theme,
}: {
	readonly groundImageUrl: string | null;
	readonly pageId: string;
	readonly theme: BookletThemeCandidate;
}) {
	const [startColor, endColor] = getBookletPageSurface(theme);
	const layer = getDecorLayer(theme);
	const { decor } = layer;
	const idBase = svgId("booklet-page-surface", pageId, theme.resolvedThemeKey);
	const gradientId = idBase;
	const patternId = svgId(idBase, "pattern");
	const blurId = svgId(idBase, "blur");
	const imageTileId = svgId(idBase, "image-tile");
	const groundColor =
		decor.ground.kind === "pattern" || decor.ground.kind === "frame"
			? motifColorVariable(decor.ground.color)
			: null;
	const patternMotif =
		decor.ground.kind === "pattern"
			? (MOTIFS.get(decor.ground.motif) ?? null)
			: null;
	const image = decor.ground.kind === "image" ? decor.ground : null;
	const imageHref = image && groundImageUrl ? groundImageUrl : null;

	return (
		<svg
			aria-hidden="true"
			className="booklet-page__surface"
			data-booklet-decor={decor.id}
			focusable="false"
			preserveAspectRatio="none"
			viewBox="0 0 148 210"
		>
			<defs>
				<linearGradient id={gradientId} x1="0" x2="1" y1="0" y2="1">
					<stop offset="0" stopColor={startColor} />
					<stop offset="1" stopColor={endColor} />
				</linearGradient>
				{decor.ground.kind === "pattern" && patternMotif ? (
					<pattern
						height={decor.ground.tileMm}
						id={patternId}
						patternUnits="userSpaceOnUse"
						width={decor.ground.tileMm}
					>
						<g
							transform={`translate(${(decor.ground.tileMm - decor.ground.sizeMm * patternMotif.aspect) / 2} ${(decor.ground.tileMm - decor.ground.sizeMm) / 2}) scale(${decor.ground.sizeMm})`}
						>
							<MotifShapes
								color={groundColor}
								definition={patternMotif}
								maskId={svgId(patternId, "mask")}
							/>
						</g>
					</pattern>
				) : null}
				{image?.treatment === "blur" ? (
					<filter id={blurId}>
						<feGaussianBlur stdDeviation="2" />
					</filter>
				) : null}
				{image?.treatment === "tile" && imageHref ? (
					<pattern
						height="30"
						id={imageTileId}
						patternUnits="userSpaceOnUse"
						width="30"
					>
						<image
							height="30"
							href={imageHref}
							preserveAspectRatio="xMidYMid slice"
							width="30"
						/>
					</pattern>
				) : null}
			</defs>
			<rect fill={`url(#${gradientId})`} height="210" width="148" />
			{decor.ground.kind === "pattern" ? (
				<rect
					data-booklet-ground="pattern"
					fill={`url(#${patternId})`}
					height="210"
					opacity={decor.ground.opacity}
					width="148"
				/>
			) : null}
			{decor.ground.kind === "frame" ? (
				<rect
					data-booklet-ground="frame"
					fill="none"
					height={210 - 2 * decor.ground.edgeMm - decor.ground.widthMm}
					opacity={decor.ground.opacity}
					stroke={groundColor ?? undefined}
					strokeDasharray={
						decor.ground.stroke === "dashed"
							? `${Math.max(0.8, decor.ground.widthMm * 3)} ${Math.max(0.8, decor.ground.widthMm * 3)}`
							: undefined
					}
					strokeWidth={decor.ground.widthMm}
					width={148 - 2 * decor.ground.edgeMm - decor.ground.widthMm}
					x={decor.ground.edgeMm + decor.ground.widthMm / 2}
					y={decor.ground.edgeMm + decor.ground.widthMm / 2}
				/>
			) : null}
			{image && imageHref ? (
				image.treatment === "tile" ? (
					<rect
						data-booklet-ground="image"
						fill={`url(#${imageTileId})`}
						height="210"
						opacity={image.opacity}
						width="148"
					/>
				) : (
					<image
						data-booklet-ground="image"
						filter={image.treatment === "blur" ? `url(#${blurId})` : undefined}
						height="210"
						href={imageHref}
						opacity={image.opacity}
						preserveAspectRatio="xMidYMid slice"
						style={
							image.treatment === "tint"
								? { mixBlendMode: "multiply" }
								: undefined
						}
						width="148"
					/>
				)
			) : null}
			{layer.motifs.map((motif) => (
				<g
					key={`${motif.slot}-${motif.index}`}
					data-booklet-motif={motif.slot}
					data-booklet-motif-bounds={formatBounds(motif.boundsMm)}
					opacity={motif.opacity}
					transform={`translate(${(motif.xMm + motif.widthMm / 2).toFixed(3)} ${(motif.yMm + motif.heightMm / 2).toFixed(3)}) rotate(${motif.rotateDeg.toFixed(2)}) translate(${(-motif.widthMm / 2).toFixed(3)} ${(-motif.heightMm / 2).toFixed(3)}) scale(${motif.heightMm.toFixed(4)})`}
				>
					<MotifShapes
						color={motifColorVariable(motif.color)}
						definition={motif.definition}
						maskId={svgId(idBase, motif.slot, String(motif.index), "mask")}
					/>
				</g>
			))}
			{layer.panel ? (
				<rect
					data-booklet-panel="true"
					fill="var(--booklet-itinerary-surface)"
					height={layer.panel.heightMm}
					opacity={layer.panel.opacity}
					rx={layer.panel.radiusMm}
					width={layer.panel.widthMm}
					x={layer.panel.xMm}
					y={layer.panel.yMm}
				/>
			) : null}
		</svg>
	);
}

function groundImageFor(
	theme: BookletThemeCandidate,
	model: BookletModel,
	day: BookletDay | null,
): string | null {
	const decor = getDecorDefinition(theme.decorId);
	if (decor.ground.kind !== "image") {
		return null;
	}
	if (decor.ground.source === "illustration" && day?.illustration) {
		return day.illustration.contentUrl;
	}
	return model.cover.image.contentUrl;
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
				<div aria-hidden="true" className="booklet-cover__decor" />
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
	destination,
	showIllustration,
}: {
	readonly continuation: boolean;
	readonly day: BookletDay;
	readonly destination: string;
	readonly showIllustration: boolean;
}) {
	return (
		<header
			className={`booklet-day-header${continuation ? " booklet-day-header--continuation" : ""}`}
		>
			{!continuation && showIllustration && day.illustration ? (
				<figure className="booklet-day__illustration">
					<img
						alt={`${destination}の挿絵`}
						decoding="async"
						height={day.illustration.height}
						loading="eager"
						src={day.illustration.contentUrl}
						width={day.illustration.width}
					/>
				</figure>
			) : null}
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
	destination,
	page,
}: {
	readonly day: BookletDay;
	readonly destination: string;
	readonly page: Extract<BookletPagePlan, { readonly kind: "day" }>;
}) {
	return (
		<>
			<DayHeader
				continuation={page.continuation}
				day={day}
				destination={destination}
				showIllustration={page.illustration}
			/>
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
			<DayPage
				day={model.days[page.dayIndex]}
				destination={model.cover.destination}
				page={page}
			/>
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

	const composition =
		page.kind === "day" ? getCompositionDefinition(theme.compositionId) : null;

	return (
		<article
			className={pageClassName}
			data-booklet-columns={composition?.columns}
			data-booklet-composition={composition?.id}
			data-booklet-page="true"
			data-booklet-theme-key={theme.resolvedThemeKey}
			data-page-id={page.pageId}
		>
			{page.kind === "day" ? (
				<BookletPageSurface
					groundImageUrl={groundImageFor(
						theme,
						model,
						model.days[page.dayIndex] ?? null,
					)}
					pageId={page.pageId}
					theme={theme}
				/>
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
	destination,
	model,
	theme,
}: {
	readonly day: BookletDay;
	readonly dayIndex: number;
	readonly destination: string;
	readonly model: BookletModel;
	readonly theme: BookletThemeCandidate;
}) {
	return (
		<article className="booklet-page booklet-page--measurement">
			<BookletPageSurface
				groundImageUrl={groundImageFor(theme, model, day)}
				pageId={`measurement-${day.id}`}
				theme={theme}
			/>
			<div
				className="booklet-page__content"
				data-booklet-measurement-content="true"
			>
				<div className="booklet-measurement__sample">
					<DayHeader
						continuation={false}
						day={day}
						destination={destination}
						showIllustration={day.illustration !== null}
					/>
					<DayHeader
						continuation={false}
						day={day}
						destination={destination}
						showIllustration={false}
					/>
					<DayHeader
						continuation
						day={day}
						destination={destination}
						showIllustration={false}
					/>
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
					destination={model.cover.destination}
					model={model}
					theme={theme}
				/>
			))}
		</div>
	);
}
