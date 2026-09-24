import type { CSSProperties, ReactNode } from "react";
import { formatBookletDate } from "../../../booklet/dateFormat";
import type {
	EditorialArrivalUnit,
	EditorialBooklet,
} from "../../../booklet/editorialModel";
import { formatTransportMode } from "../../../booklet/itineraryFormat";
import type { BookletImage } from "../../../booklet/model";
import type { BodyStructure } from "../../../booklet/program/bodyStructures";
import {
	type BookletFacts,
	ENTRY_CATEGORY_PRESENTATIONS,
	type TimeOfDay,
} from "../../../booklet/program/deriveFacts";
import type {
	AnySceneSpec,
	ArtworkBinding,
	ImageTreatmentId,
	LocalPage,
	ProgramScene,
} from "../../../booklet/program/model";
import {
	IMAGE_TREATMENT_INSETS,
	insetRect,
	type ModuleRect,
	rect,
} from "../../../booklet/program/modules/geometry";
import type { ArtworkAsset } from "../../../theme/artwork/types";
import type { SceneStyle } from "./sceneStyle";

export type SceneRenderMode = "measurement" | "output";

/** Everything a module needs besides its spec and plan. */
export type SceneRenderContext = {
	/** Resolves a frozen asset ID of the program's own catalog. */
	readonly artworkById: (id: string) => ArtworkAsset;
	readonly facts: BookletFacts;
	/** The program's seed; family decor on the profile path is seeded by it. */
	readonly seedToken: string;
	readonly style: SceneStyle;
};

const mm = (value: number) => `${value}mm`;

export function rectStyle(region: ModuleRect): CSSProperties {
	return {
		height: mm(region.heightMm),
		left: mm(region.xMm),
		top: mm(region.yMm),
		width: mm(region.widthMm),
	};
}

/** The token an element carries to prove one EffectClaim. */
export function effectToken(
	regionId: string,
	directionId: string,
	kind: string,
): string {
	return `${regionId}/${directionId}:${kind}`;
}

/**
 * `region/directionId:kind` tokens of every claim of the scene on these
 * regions. The final check measures the element carrying the token at its
 * real size (25.3 EffectClaim); one element may prove several claims.
 */
export function effectTokens(
	scene: ProgramScene,
	...regionIds: readonly string[]
): string | undefined {
	const tokens = scene.effects
		.filter((effect) => regionIds.includes(effect.regionId))
		.map((effect) =>
			effectToken(effect.regionId, effect.directionId, effect.kind),
		);
	return tokens.length > 0 ? [...new Set(tokens)].join(" ") : undefined;
}

/** Effect attributes to spread on an element that proves claims. */
export type EffectMarks = {
	readonly "data-direction-effect"?: string;
};

export function effectMarks(
	scene: ProgramScene,
	...regionIds: readonly string[]
): EffectMarks {
	const tokens = effectTokens(scene, ...regionIds);
	return tokens ? { "data-direction-effect": tokens } : {};
}

export function Region({
	children,
	className,
	effectRegionId,
	region,
	regionId,
	scene,
	style,
}: {
	readonly children?: ReactNode;
	readonly className?: string;
	/** The claim region this element proves, when it differs from `regionId`. */
	readonly effectRegionId?: string;
	readonly region: ModuleRect;
	readonly regionId: string;
	readonly scene: ProgramScene;
	readonly style?: CSSProperties;
}) {
	return (
		<div
			className={`program-region program-region--${regionId}${className ? ` ${className}` : ""}`}
			data-direction-effect={effectTokens(scene, effectRegionId ?? regionId)}
			data-program-region={regionId}
			style={{ ...rectStyle(region), ...style }}
		>
			{children}
		</div>
	);
}

/**
 * One A5 page of a scene. Output pages carry the page identity; measurement
 * pages only share the same parts, width and CSS and are never printed.
 */
export function ProgramPage({
	children,
	className,
	familyStyle,
	mode,
	page,
	pageId,
	pageNumber,
	spec,
	style,
}: {
	readonly children: ReactNode;
	readonly className?: string;
	/** An extracted family keeps its own page box and variables. */
	readonly familyStyle?: CSSProperties;
	readonly mode: SceneRenderMode;
	readonly page: Pick<LocalPage, "compositionId" | "kind" | "localPageId">;
	readonly pageId?: string;
	readonly pageNumber?: number;
	readonly spec: AnySceneSpec;
	readonly style: SceneStyle;
}) {
	const { scene } = spec;
	const output = mode === "output";
	return (
		<article
			className={`booklet-page program-page${familyStyle ? " program-page--family" : ""} program-page--${scene.moduleId} program-page--${page.kind}${className ? ` ${className}` : ""}`}
			data-booklet-composition={page.compositionId}
			data-booklet-page={output ? "true" : undefined}
			data-booklet-style-id={style.styleId}
			data-local-page-id={page.localPageId}
			data-module-id={scene.moduleId}
			data-page-id={output ? pageId : undefined}
			data-page-number={output ? pageNumber : undefined}
			data-program-page="true"
			data-scene-id={scene.sceneId}
			data-scene-kind={scene.kind}
			style={familyStyle ? { ...style.vars, ...familyStyle } : style.vars}
		>
			{children}
			{output && pageNumber !== undefined ? (
				<footer className="program-page__footer">
					<span data-booklet-text-role="page-number">{pageNumber}</span>
				</footer>
			) : null}
		</article>
	);
}

export function CoverTitle({
	booklet,
	vertical,
}: {
	readonly booklet: EditorialBooklet;
	readonly vertical: boolean;
}) {
	return (
		<h1
			className={`program-title${vertical ? " program-title--vertical" : ""}`}
			data-booklet-text-role="cover-destination"
			data-program-title="true"
		>
			{booklet.cover.title}
		</h1>
	);
}

export function PeriodText({
	booklet,
}: {
	readonly booklet: EditorialBooklet;
}) {
	return (
		<p
			className="program-period"
			data-booklet-text-role="cover-period"
			data-program-period="true"
		>
			<time dateTime={booklet.cover.period.start_date}>
				{formatBookletDate(booklet.cover.period.start_date)}
			</time>
			<span aria-hidden="true"> — </span>
			<time dateTime={booklet.cover.period.end_date}>
				{formatBookletDate(booklet.cover.period.end_date)}
			</time>
		</p>
	);
}

const TIME_OF_DAY_LABELS: Readonly<Record<TimeOfDay, string>> = {
	afternoon: "昼",
	evening: "夕",
	morning: "朝",
	night: "夜",
};

function formatMinutes(minutes: number): string {
	return `${minutes.toLocaleString("ja-JP")}分`;
}

function formatMoney(money: {
	readonly amount: number;
	readonly currency: string;
}): string {
	return `${money.amount.toLocaleString("ja-JP")} ${money.currency}`;
}

/**
 * The day-story section label (朝・昼・夕・夜) that proves the section claim.
 * Extracted families place it inside their own day heading.
 */
export function SectionLabel({ scene }: { readonly scene: ProgramScene }) {
	const section = scene.kind === "day" ? scene.section : null;
	if (!section) return null;
	return (
		<span
			className="program-heading__section"
			data-booklet-text-role="section-label"
			{...effectMarks(scene, "section")}
		>
			{TIME_OF_DAY_LABELS[section.timeOfDay]}
		</span>
	);
}

/** The day label of a module's own header style (25.1), never a new fact. */
export function dayLabel(scene: ProgramScene, dayNumber: number): string {
	if ("dayHeader" in scene.config) {
		if (scene.config.dayHeader === "第○章 / 訪問地点")
			return `第${dayNumber}章`;
		if (scene.config.dayHeader) return `DAY ${dayNumber}`;
	}
	return `${dayNumber}日目`;
}

/** The per-unit label that pairs with a day header label, e.g. MISSION. */
export function unitLabelOf(scene: ProgramScene): string | null {
	if (!("dayHeader" in scene.config) || !scene.config.dayHeader) return null;
	return scene.config.dayHeader.split(" / ")[1] ?? null;
}

/**
 * The 18pt+ day heading. A transplanted heading system changes lettering,
 * rules and band inside the same reserved rect only.
 */
export function DayHeading({
	continuation,
	context,
	spec,
	vertical,
}: {
	readonly continuation: boolean;
	readonly context: SceneRenderContext;
	readonly spec: AnySceneSpec;
	readonly vertical: boolean;
}) {
	const { scene, content } = spec;
	const day = content.day;
	if (!day) return null;
	const system = scene.config.heading.system;
	const ledgerHeading =
		"ledgerHeading" in scene.config ? scene.config.ledgerHeading : null;
	const facts =
		content.dayIndex === null ? null : context.facts.days[content.dayIndex];
	return (
		<div
			className={`program-heading${system ? ` program-heading--${system}` : ""}${ledgerHeading ? ` program-heading--ledger-${ledgerHeading}` : ""}${vertical ? " program-heading--vertical" : ""}`}
			data-program-heading="true"
		>
			<h2 className="program-heading__title" data-booklet-text-role="day-label">
				{dayLabel(scene, day.dayNumber)}
				{continuation ? "（続き）" : ""}
			</h2>
			<time
				className="program-heading__date"
				data-booklet-text-role="day-date"
				dateTime={day.date}
			>
				{formatBookletDate(day.date)}
			</time>
			<SectionLabel scene={scene} />
			{ledgerHeading === "data-book" && facts ? (
				<span
					className="program-heading__totals"
					data-booklet-text-role="day-totals"
				>
					移動 {formatMinutes(facts.movementMinutes)}
					{facts.costTotals.map((total) => (
						<span key={total.currency}> ・{formatMoney(total)}</span>
					))}
				</span>
			) : null}
		</div>
	);
}

/**
 * The existing itinerary image, contained inside the treatment's effective
 * rect. A treatment reserves its frame inside the image region and never
 * covers text; a caption band only carries the date as utility text.
 */
export function ItineraryImage({
	alt,
	captionDate,
	image,
	region,
	scene,
	treatment,
}: {
	readonly alt: string;
	readonly captionDate: string | null;
	readonly image: BookletImage | null;
	readonly region: ModuleRect;
	readonly scene: ProgramScene;
	readonly treatment: ImageTreatmentId | null;
}) {
	const inset = treatment ? IMAGE_TREATMENT_INSETS[treatment] : null;
	const inner = inset
		? insetRect(rect(0, 0, region.widthMm, region.heightMm), inset)
		: rect(0, 0, region.widthMm, region.heightMm);
	const captioned =
		treatment === "post" ||
		treatment === "polaroid" ||
		treatment === "caption-margin" ||
		treatment === "sketch-note";
	return (
		<Region
			className={`program-image${treatment ? ` program-image--${treatment}` : ""}`}
			region={region}
			regionId="image"
			scene={scene}
		>
			{image ? (
				<figure className="program-image__frame" style={rectStyle(inner)}>
					<img
						alt={alt}
						className="program-image__img"
						decoding="async"
						height={image.height}
						loading="eager"
						src={image.contentUrl}
						width={image.width}
					/>
				</figure>
			) : (
				<div className="program-image__paper" aria-hidden="true" />
			)}
			{captioned && inset && captionDate ? (
				<p
					className="program-image__caption"
					data-booklet-text-role="image-caption"
					style={{
						height: mm(inset.bottomMm),
						left: mm(inset.leftMm),
						width: mm(region.widthMm - inset.leftMm - inset.rightMm),
					}}
				>
					{formatBookletDate(captionDate)}
				</p>
			) : null}
		</Region>
	);
}

/**
 * A transplanted image treatment inside an extracted family's own figure.
 * The figure keeps its family rect; the treatment reserves its frame inside
 * it and contains the image in the remaining rect.
 */
export function TreatedImageFill({
	alt,
	captionDate,
	image,
	treatment,
}: {
	readonly alt: string;
	readonly captionDate: string | null;
	readonly image: BookletImage;
	readonly treatment: ImageTreatmentId;
}) {
	const inset = IMAGE_TREATMENT_INSETS[treatment];
	const captioned =
		treatment === "post" ||
		treatment === "polaroid" ||
		treatment === "caption-margin" ||
		treatment === "sketch-note";
	return (
		<span
			className={`program-image program-image--fill program-image--${treatment}`}
		>
			<span
				className="program-image__frame"
				style={{
					bottom: mm(inset?.bottomMm ?? 0),
					left: mm(inset?.leftMm ?? 0),
					right: mm(inset?.rightMm ?? 0),
					top: mm(inset?.topMm ?? 0),
				}}
			>
				<img
					alt={alt}
					className="program-image__img"
					decoding="async"
					height={image.height}
					loading="eager"
					src={image.contentUrl}
					width={image.width}
				/>
			</span>
			{captioned && inset && captionDate ? (
				<span
					className="program-image__caption"
					data-booklet-text-role="image-caption"
					style={{
						height: mm(inset.bottomMm),
						left: mm(inset.leftMm),
						right: mm(inset.rightMm),
					}}
				>
					{formatBookletDate(captionDate)}
				</span>
			) : null}
		</span>
	);
}

/**
 * A reserved artwork rect. The asset is contained with its own aspect; a mask
 * asset takes the bundle's accent, a multi-color one keeps its colors. An
 * unbound optional slot keeps the paper color.
 */
export function ArtSlot({
	binding,
	context,
	region,
	scene,
}: {
	readonly binding: ArtworkBinding | null;
	readonly context: SceneRenderContext;
	readonly region: ModuleRect;
	readonly scene: ProgramScene;
}) {
	const asset = binding?.assetId ? context.artworkById(binding.assetId) : null;
	const view =
		asset && binding?.viewId
			? (asset.views?.find((item) => item.id === binding.viewId) ?? null)
			: null;
	const aspect = view ? view.width / view.height : (asset?.aspect ?? 1);
	const widthMm = Math.min(region.widthMm, region.heightMm * aspect);
	const heightMm = widthMm / aspect;
	const drawn = rect(
		(region.widthMm - widthMm) / 2,
		(region.heightMm - heightMm) / 2,
		widthMm,
		heightMm,
	);
	return (
		<Region
			className="program-art"
			effectRegionId="hero"
			region={region}
			regionId={`art-${binding?.slotId ?? "empty"}`}
			scene={scene}
		>
			{asset && binding ? (
				<span
					aria-hidden="true"
					className={`program-art__asset program-art__asset--${asset.recolor}`}
					data-artwork-asset={asset.id}
					data-artwork-slot={binding.slotId}
					style={{
						...rectStyle(drawn),
						...(asset.recolor === "mask"
							? {
									WebkitMaskImage: `url("${asset.src}")`,
									maskImage: `url("${asset.src}")`,
								}
							: {}),
						...(view
							? {
									backgroundImage: `url("${asset.src}")`,
									backgroundPosition: `${(-view.x / view.width) * widthMm}mm ${(-view.y / view.height) * heightMm}mm`,
									backgroundSize: `${(asset.width / view.width) * widthMm}mm ${(asset.height / view.height) * heightMm}mm`,
								}
							: {}),
					}}
				>
					{asset.recolor === "none" && !view ? (
						<img
							alt=""
							className="program-art__img"
							decoding="async"
							loading="eager"
							src={asset.src}
						/>
					) : null}
				</span>
			) : null}
		</Region>
	);
}

export function bindingFor(
	scene: ProgramScene,
	slotId: string,
): ArtworkBinding | null {
	return (
		scene.config.bindings.find((binding) => binding.slotId === slotId) ?? null
	);
}

function transportText(unit: EditorialArrivalUnit): string | null {
	if (!unit.transportMode) return null;
	return `${formatTransportMode(unit.transportMode)}${unit.durationMinutes !== null ? `・${unit.durationMinutes}分` : ""}`;
}

function costText(unit: EditorialArrivalUnit): string | null {
	const costs = [
		unit.stayCost ? `滞在 ${formatMoney(unit.stayCost)}` : null,
		unit.transportCost ? `移動 ${formatMoney(unit.transportCost)}` : null,
	].filter((item) => item !== null);
	return costs.length > 0 ? costs.join(" / ") : null;
}

export type UnitBlockProps = {
	readonly measureIndex?: number;
	readonly number: number;
	readonly scene: ProgramScene;
	readonly structure: BodyStructure;
	readonly unit: EditorialArrivalUnit;
};

/**
 * One itinerary unit in the scene's body structure. Name, time and order
 * always stay; fields the policy did not project are simply absent.
 */
export function UnitBlock({
	measureIndex,
	number,
	scene,
	structure,
	unit,
}: UnitBlockProps) {
	const numbered = scene.config.numberedEntries;
	const label = unitLabelOf(scene);
	const lane =
		"participationLane" in scene.config
			? (scene.config.participationLane?.lane ?? null)
			: null;
	const transport = transportText(unit);
	const cost = costText(unit);
	const main = (
		<div className="program-unit__main">
			{numbered ? (
				<span
					className="program-unit__number"
					data-booklet-text-role="entry-number"
				>
					No.{number}
				</span>
			) : null}
			{label ? (
				<span
					className="program-unit__label"
					data-booklet-text-role="unit-label"
				>
					{label}
				</span>
			) : null}
			<strong className="program-unit__name" data-booklet-text-role="spot-name">
				{unit.spotName}
			</strong>
			{unit.description ? (
				<p
					className="program-unit__caption"
					data-booklet-text-role="unit-caption"
				>
					{unit.description}
				</p>
			) : null}
			{transport ? (
				<span
					className="program-unit__transport"
					data-booklet-text-role="transport-summary"
				>
					{transport}
				</span>
			) : null}
			{cost && structure.id !== "ledger-rows" ? (
				<span className="program-unit__cost" data-booklet-text-role="unit-cost">
					{cost}
				</span>
			) : null}
		</div>
	);
	const time = (
		<time
			className="program-unit__time"
			data-booklet-text-role="unit-time"
			dateTime={unit.startAt}
		>
			{unit.timeLabel}
		</time>
	);
	const common = {
		className: `program-unit program-unit--${structure.id}`,
		"data-program-measure-unit": measureIndex,
		"data-unit-id": measureIndex === undefined ? unit.id : undefined,
	};
	switch (structure.id) {
		case "ledger-rows":
		case "data-columns":
		case "fixed-columns":
			return (
				<div {...common}>
					{time}
					<span
						className="program-unit__cell"
						data-booklet-text-role="transport-summary"
					>
						{transport ?? "—"}
					</span>
					<strong
						className="program-unit__cell program-unit__name"
						data-booklet-text-role="spot-name"
					>
						{numbered ? `No.${number} ` : ""}
						{unit.spotName}
					</strong>
					<span
						className="program-unit__cell"
						data-booklet-text-role="unit-cost"
					>
						{cost ?? "—"}
					</span>
				</div>
			);
		case "category-bands":
			return (
				<div {...common}>
					{time}
					<div className="program-unit__bands">
						{transport ? (
							<p
								className="program-unit__band"
								style={{
									borderColor: ENTRY_CATEGORY_PRESENTATIONS.transport.color,
								}}
							>
								<span data-booklet-text-role="category-label">
									{ENTRY_CATEGORY_PRESENTATIONS.transport.label}
								</span>
								<span data-booklet-text-role="transport-summary">
									{transport}
								</span>
							</p>
						) : null}
						<p
							className="program-unit__band"
							style={{ borderColor: ENTRY_CATEGORY_PRESENTATIONS.visit.color }}
						>
							<span data-booklet-text-role="category-label">
								{ENTRY_CATEGORY_PRESENTATIONS.visit.label}
							</span>
							<strong data-booklet-text-role="spot-name">
								{unit.spotName}
							</strong>
						</p>
					</div>
				</div>
			);
		case "quest-panels":
			return (
				<div {...common} data-lane={lane ?? undefined}>
					{lane === "checklist" ? (
						<span className="program-unit__checkbox" aria-hidden="true" />
					) : null}
					<div
						className="program-unit__panel-text"
						data-program-text-box="true"
					>
						{time}
						{main}
					</div>
					{lane === "stamp" ? (
						<span className="program-unit__stamp" aria-hidden="true" />
					) : null}
				</div>
			);
		case "stage-panels":
			return (
				<div {...common}>
					<span
						className="program-unit__stage"
						data-booklet-text-role="stage-label"
					>
						STAGE {number}
					</span>
					{time}
					{main}
				</div>
			);
		case "numbered-route":
		case "concept-route":
		case "route-line":
		case "board-squares":
			return (
				<div {...common}>
					<span
						className="program-unit__node"
						data-booklet-text-role="route-number"
					>
						{number}
					</span>
					{time}
					{main}
				</div>
			);
		default:
			return (
				<div {...common}>
					{time}
					{main}
				</div>
			);
	}
}

export function EmptyDayText({
	measure = false,
}: {
	readonly measure?: boolean;
}) {
	return (
		<p
			className="program-empty-day"
			data-booklet-text-role="empty-day"
			data-program-measure-empty={measure ? "true" : undefined}
		>
			予定はありません
		</p>
	);
}

/**
 * A numbered concept route. It shows order only, not scale or position, and
 * leaves every name to the numbered body (25.1).
 */
export function ConceptRoute({
	count,
	firstNumber,
	variant,
}: {
	readonly count: number;
	readonly firstNumber: number;
	readonly variant: "concept-route" | "route-line";
}) {
	const nodes = Array.from({ length: count }, (_, index) => index);
	const step = count > 1 ? 100 / (count - 1) : 0;
	return (
		<svg
			aria-label="番号付きの概念ルート（縮尺・位置を表しません）"
			className={`program-route program-route--${variant}`}
			preserveAspectRatio="none"
			role="img"
			viewBox="-6 -6 112 22"
		>
			{count > 1 ? (
				<polyline
					className="program-route__line"
					fill="none"
					points={nodes
						.map(
							(index) =>
								`${index * step},${variant === "concept-route" && index % 2 === 1 ? 10 : 2}`,
						)
						.join(" ")}
				/>
			) : null}
			{nodes.map((index) => (
				<g key={index}>
					<circle
						className="program-route__node"
						cx={index * step}
						cy={variant === "concept-route" && index % 2 === 1 ? 10 : 2}
						r={3.2}
					/>
					<text
						className="program-route__label"
						dominantBaseline="central"
						textAnchor="middle"
						x={index * step}
						y={variant === "concept-route" && index % 2 === 1 ? 10 : 2}
					>
						{firstNumber + index}
					</text>
				</g>
			))}
		</svg>
	);
}

/** Ledger and transplanted column structures share these headings. */
export function LedgerColumnHeadings() {
	return (
		<div className="program-ledger-head" aria-hidden="false">
			<span data-booklet-text-role="column-heading">時刻</span>
			<span data-booklet-text-role="column-heading">交通</span>
			<span data-booklet-text-role="column-heading">名称</span>
			<span data-booklet-text-role="column-heading">費用</span>
		</div>
	);
}
