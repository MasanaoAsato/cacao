import {
	type CSSProperties,
	type RefObject,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { formatBookletDate } from "../../../booklet/dateFormat";
import type {
	EditorialArrivalUnit,
	EditorialBooklet,
	EditorialDay,
} from "../../../booklet/editorialModel";
import {
	type PlayfulRouteDayMeasurement,
	type PlayfulRoutePagePlan,
	paginatePlayfulRoute,
} from "../../../booklet/families/playfulRoute";
import type {
	BookletRenderPagePlan,
	ResolvedBookletDesign,
} from "../../../booklet/family";
import { formatTransportMode } from "../../../booklet/itineraryFormat";
import type { BookletImage, BookletModel } from "../../../booklet/model";
import { projectBooklet } from "../../../booklet/projectBooklet";
import {
	getThemeCandidates,
	resolveBookletTheme,
} from "../../../theme/bookletTheme";
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
	playfulRoutePaletteFor,
} from "../../../theme/families/playfulRoute";
import { fontStack } from "../../../theme/families/styleProfiles";
import { motifAssetsFor } from "../../../theme/motifAssets";
import type { CoverVeilBounds } from "../../../theme/types";
import { waitForMotifAssets } from "../decor/assetReadiness";
import { FamilyDecorLayer } from "../decor/FamilyDecorLayer";
import {
	BookletLayoutError,
	type BookletPagePlanStatus,
} from "../useBookletPagePlan";
import type { FamilyPagePlanResult } from "./useFamilyPagePlan";
import { prepareFamilyDecor } from "./useFamilyPagePlan";
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

async function waitForPlayfulRouteFonts(
	design: ResolvedBookletDesign,
): Promise<void> {
	if (!document.fonts) {
		return;
	}
	await document.fonts.ready;
	const profile = design.styleProfile;
	if (!profile) {
		throw new Error("playful-routeの作風プロファイルがありません。");
	}
	const requiredFonts = new Map([
		[profile.fontFamilies.display, profile.fontWeights.display],
		[profile.fontFamilies.body, profile.fontWeights.body],
		[profile.fontFamilies.utility, profile.fontWeights.utility],
	]);
	for (const [family, weight] of requiredFonts) {
		const descriptor = `${weight} 10pt "${family}"`;
		await document.fonts.load(descriptor, "東京の旅程・京都散策");
		if (!document.fonts.check(descriptor, "東京の旅程・京都散策")) {
			throw new Error(`${family} ${weight} の読み込みを確認できませんでした。`);
		}
	}
}

async function waitForImages(root: ParentNode): Promise<void> {
	await Promise.all(
		Array.from(root.querySelectorAll("img")).map(async (image) => {
			try {
				await image.decode();
			} catch {
				throw new Error(`画像「${image.alt}」の読み込みに失敗しました。`);
			}
		}),
	);
}

function titleSizeCandidates(design: ResolvedBookletDesign): readonly number[] {
	const titleSizePt = design.styleProfile?.fontSizesPt.title;
	return titleSizePt === undefined
		? COVER_TITLE_SIZES_PT
		: [
				titleSizePt,
				...COVER_TITLE_SIZES_PT.filter((size) => size < titleSizePt),
			];
}

function measureCoverTitle(
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

function collectMeasurement(
	root: HTMLElement,
	booklet: EditorialBooklet,
	compositionId: string,
	titleSizesPt: readonly number[],
) {
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
		coverTitleSizePt: measureCoverTitle(root, titleSizesPt),
		measurement: {
			blockGap: 8,
			continuationBodyHeight:
				readHeight(continuationBody, "継続ページ本文") * mmPerPx,
			days,
			firstBodyHeight: readHeight(firstBody, "先頭ページ本文") * mmPerPx,
			selectedBlockWidth: composition.blockWidthMm,
			wideBlockWidth: 128,
		},
	};
}

function nextFrame(): Promise<void> {
	return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

async function waitForOutput(
	getRoot: () => HTMLElement | null,
	renderKey: string,
): Promise<HTMLElement | null> {
	await nextFrame();
	for (let frame = 0; frame < 12; frame += 1) {
		const root = getRoot();
		if (root?.dataset.bookletThemeKey === renderKey) {
			return root;
		}
		await nextFrame();
	}
	return null;
}

function hidesText(style: CSSStyleDeclaration): boolean {
	const unsafe = new Set(["hidden", "clip", "scroll", "auto"]);
	return (
		unsafe.has(style.overflow) ||
		unsafe.has(style.overflowX) ||
		unsafe.has(style.overflowY) ||
		style.whiteSpace === "nowrap" ||
		(style.textOverflow !== "" && style.textOverflow !== "clip") ||
		style.transform.includes("scale")
	);
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

/** Verifies that pagination and the output DOM preserve the editorial model. */
export function ensurePlayfulRouteContent(
	root: HTMLElement,
	booklet: EditorialBooklet,
	pagePlan: readonly PlayfulRoutePagePlan[],
): void {
	if (
		textOf(
			root,
			'.playful-route-page--cover [data-booklet-text-role="cover-destination"]',
			"表紙都市名",
		) !== booklet.cover.title
	) {
		throw new BookletLayoutError(
			"dom-not-ready",
			"表紙都市名が掲載モデルと一致しません。",
		);
	}

	const dayPlans = pagePlan.filter(
		(page): page is Extract<PlayfulRoutePagePlan, { readonly kind: "day" }> =>
			page.kind === "day",
	);
	const expectedDayIds: string[] = [];
	const plannedUnits: Array<{
		readonly ordinal: number;
		readonly unit: EditorialArrivalUnit;
	}> = [];
	for (const page of dayPlans) {
		const day = booklet.days[page.dayIndex];
		if (!day) {
			throw new BookletLayoutError(
				"dom-not-ready",
				`ページ「${page.pageId}」の日が掲載モデルにありません。`,
			);
		}
		expectedDayIds.push(day.id);
		for (const unitIndex of page.unitIndexes) {
			const unit = day.units[unitIndex];
			if (!unit) {
				throw new BookletLayoutError(
					"dom-not-ready",
					`ページ「${page.pageId}」の掲載単位がモデルにありません。`,
				);
			}
			plannedUnits.push({ ordinal: unitIndex + 1, unit });
		}
	}

	const expectedUnitIds = booklet.days.flatMap((day) =>
		day.units.map((unit) => unit.id),
	);
	const plannedUnitIds = plannedUnits.map(({ unit }) => unit.id);
	if (!sameValues(plannedUnitIds, expectedUnitIds)) {
		throw new BookletLayoutError(
			"dom-not-ready",
			"ページ計画の掲載単位ID順が掲載モデルと一致しません。",
		);
	}

	const dayPages = Array.from(
		root.querySelectorAll<HTMLElement>(".playful-route-page--day[data-day-id]"),
	);
	const actualDayIds = dayPages.map((page) => page.dataset.dayId ?? "");
	if (!sameValues(actualDayIds, expectedDayIds)) {
		throw new BookletLayoutError(
			"dom-not-ready",
			"出力ページの日ID順がページ計画と一致しません。",
		);
	}
	dayPages.forEach((pageElement, index) => {
		const plan = dayPlans[index];
		const day = plan ? booklet.days[plan.dayIndex] : null;
		if (!plan || !day) return;
		const expectedLabel = `Day ${String(day.dayNumber).padStart(2, "0")}${plan.continuation ? "・続き" : ""}`;
		if (
			textOf(
				pageElement,
				'[data-booklet-text-role="day-label"]',
				"日見出し",
			) !== expectedLabel ||
			textOf(pageElement, '[data-booklet-text-role="day-date"]', "日付") !==
				formatBookletDate(day.date)
		) {
			throw new BookletLayoutError(
				"dom-not-ready",
				`ページ「${plan.pageId}」の日見出しが掲載モデルと一致しません。`,
			);
		}
	});

	const blocks = Array.from(
		root.querySelectorAll<HTMLElement>(".playful-route-block[data-unit-id]"),
	);
	const actualUnitIds = blocks.map((block) => block.dataset.unitId ?? "");
	if (!sameValues(actualUnitIds, expectedUnitIds)) {
		throw new BookletLayoutError(
			"dom-not-ready",
			"出力の掲載単位ID順が掲載モデルと一致しません。",
		);
	}
	blocks.forEach((block, index) => {
		const planned = plannedUnits[index];
		if (!planned) return;
		const expectedTransport = transportLabel(planned.unit);
		const actualTransport = block.querySelector<HTMLElement>(
			'[data-booklet-text-role="unit-transport"]',
		)?.textContent;
		if (
			textOf(block, '[data-booklet-text-role="unit-order"]', "掲載順") !==
				String(planned.ordinal).padStart(2, "0") ||
			textOf(block, '[data-booklet-text-role="unit-time"]', "時刻") !==
				planned.unit.timeLabel ||
			textOf(block, '[data-booklet-text-role="spot-name"]', "訪問先") !==
				planned.unit.spotName ||
			(actualTransport?.trim() ?? null) !== expectedTransport
		) {
			throw new BookletLayoutError(
				"dom-not-ready",
				`掲載単位「${planned.unit.id}」の表示文字が掲載モデルと一致しません。`,
			);
		}
	});
}

function ensureDocumentFits(
	root: HTMLElement,
	pagePlan: readonly PlayfulRoutePagePlan[],
): void {
	const pages = Array.from(
		root.querySelectorAll<HTMLElement>("[data-booklet-page]"),
	);
	if (pages.length !== pagePlan.length) {
		throw new BookletLayoutError(
			"dom-not-ready",
			"playful-routeのページ数がページ計画と一致しません。",
		);
	}
	for (const page of pages) {
		if (page.scrollWidth > page.clientWidth + LAYOUT_TOLERANCE_PX) {
			throw new BookletLayoutError(
				"page-inline-overflow",
				"playful-routeの紙面が横方向にあふれています。",
			);
		}
		if (page.scrollHeight > page.clientHeight + LAYOUT_TOLERANCE_PX) {
			throw new BookletLayoutError(
				"page-block-overflow",
				"playful-routeの紙面が縦方向にあふれています。",
			);
		}
	}
	for (const text of root.querySelectorAll<HTMLElement>(
		"[data-booklet-text-role]",
	)) {
		if (hidesText(getComputedStyle(text))) {
			throw new BookletLayoutError(
				"hidden-text",
				"playful-routeで文字を隠す表示設定を検出しました。",
			);
		}
		if (text.scrollWidth > text.clientWidth + LAYOUT_TOLERANCE_PX) {
			throw new BookletLayoutError(
				"text-inline-overflow",
				`${text.dataset.bookletTextRole ?? "文字"}が横方向にあふれています。`,
			);
		}
	}
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

export function playfulRouteDecorDefinition(
	page: PlayfulRoutePagePlan,
	compositionId: string,
	decorVariantId: string | null,
	booklet: EditorialBooklet,
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
			unitIndex % 2 === 1
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

function playfulRouteDecorFor(
	page: PlayfulRoutePagePlan,
	design: ResolvedBookletDesign,
	booklet: EditorialBooklet,
) {
	const definition = playfulRouteDecorDefinition(
		page,
		design.compositionId,
		design.decorVariantId,
		booklet,
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

function decorationsByPage(
	pagePlan: readonly PlayfulRoutePagePlan[],
	compositionId: string,
	decorVariantId: string | null,
	booklet: EditorialBooklet,
): ReadonlyMap<string, readonly FamilyDecoration[]> {
	return new Map(
		pagePlan.map((page) => [
			page.pageId,
			playfulRouteDecorDefinition(page, compositionId, decorVariantId, booklet)
				.decorations,
		]),
	);
}

export function playfulRouteStyle(
	design: ResolvedBookletDesign,
): CSSProperties {
	const palette = playfulRoutePaletteFor(design.paletteId);
	const composition = playfulRouteCompositionFor(design.compositionId);
	const profile = design.styleProfile;
	if (!profile) {
		throw new Error("playful-routeの作風プロファイルがありません。");
	}
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
			profile.photoTreatment === "diary-photo" ? "4mm" : "8mm",
		"--playful-route-rule-width":
			profile.ruleTreatment === "hand-drawn-route" ? "0.8pt" : "0.6mm",
		"--playful-route-utility-family": fontStack(profile.fontFamilies.utility),
		"--playful-route-utility-size": `${profile.fontSizesPt.utility}pt`,
		"--playful-route-utility-weight": profile.fontWeights.utility,
	} as CSSProperties;
}

function DecorAnchorElement({
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
	title,
}: {
	readonly className: string;
	readonly image: BookletImage;
	readonly imageClassName?: string;
	readonly title: string;
}) {
	return (
		<figure className={className}>
			<img
				alt={`${title}の旅のイメージ`}
				className={imageClassName}
				decoding="async"
				height={image.height}
				loading="eager"
				src={image.contentUrl}
				width={image.width}
			/>
		</figure>
	);
}

function PlayfulRouteCover({
	booklet,
	measurement,
	titleSizePt,
	titleSizesPt,
}: {
	readonly booklet: EditorialBooklet;
	readonly measurement: boolean;
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

function transportLabel(unit: EditorialArrivalUnit): string | null {
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
}: {
	readonly heightMm?: number;
	readonly measurementKey?: string;
	readonly ordinal: number;
	readonly unit: EditorialArrivalUnit;
}) {
	const transport = transportLabel(unit);
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

function RouteDayHeader({
	booklet,
	day,
	page,
}: {
	readonly booklet: EditorialBooklet;
	readonly day: EditorialDay;
	readonly page: Extract<PlayfulRoutePagePlan, { readonly kind: "day" }>;
}) {
	const showImage = !page.continuation && page.layoutVariant === "selected";
	return (
		<header
			className={`playful-route-day-header${showImage ? " playful-route-day-header--image" : " playful-route-day-header--compact"}`}
			data-day-id={day.id}
		>
			<div className="playful-route-day-header__heading">
				<p data-booklet-text-role="day-label">
					Day {String(day.dayNumber).padStart(2, "0")}
					{page.continuation ? "・続き" : ""}
				</p>
				<h2 data-booklet-text-role="day-date">
					<time dateTime={day.date}>{formatBookletDate(day.date)}</time>
				</h2>
			</div>
			{showImage ? (
				<RoutePhoto
					className="playful-route-day-header__image"
					image={day.illustration ?? booklet.cover.image}
					title={booklet.cover.title}
				/>
			) : null}
		</header>
	);
}

function RouteDayPage({
	booklet,
	page,
}: {
	readonly booklet: EditorialBooklet;
	readonly page: Extract<PlayfulRoutePagePlan, { readonly kind: "day" }>;
}) {
	const day = booklet.days[page.dayIndex];
	if (!day) {
		return null;
	}
	return (
		<>
			<RouteDayHeader booklet={booklet} day={day} page={page} />
			<div
				className={`playful-route-blocks playful-route-blocks--${page.layoutVariant}${page.continuation ? " playful-route-blocks--continuation" : ""}`}
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
								ordinal={unitIndex + 1}
								unit={unit}
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

function PlayfulDecor({
	booklet,
	design,
	page,
	scope,
}: {
	readonly booklet: EditorialBooklet;
	readonly design: ResolvedBookletDesign;
	readonly page: PlayfulRoutePagePlan;
	readonly scope: "measurement" | "output";
}) {
	const decor = playfulRouteDecorFor(page, design, booklet);
	return (
		<FamilyDecorLayer
			decor={decor}
			layer="under-content"
			pageId={page.pageId}
			scope={scope}
		/>
	);
}

export function PlayfulRouteDocument({
	booklet,
	design,
	pagePlan,
	rootRef,
	titleSizePt,
}: {
	readonly booklet: EditorialBooklet;
	readonly design: ResolvedBookletDesign;
	readonly pagePlan: readonly PlayfulRoutePagePlan[];
	readonly rootRef: RefObject<HTMLElement | null>;
	readonly titleSizePt: number;
}) {
	return (
		<main
			aria-label="旅のしおり印刷プレビュー"
			className={`booklet-document booklet-theme playful-route playful-route--${design.compositionId}`}
			data-booklet-decor-variant={design.decorVariantId ?? undefined}
			data-booklet-design={design.requestedTheme.recipe.id}
			data-booklet-family="playful-route"
			data-booklet-photo-treatment={design.styleProfile?.photoTreatment}
			data-booklet-style-profile={design.styleProfileId ?? undefined}
			data-booklet-theme-key={design.renderKey}
			ref={rootRef}
			style={playfulRouteStyle(design)}
		>
			{pagePlan.map((page) => (
				<article
					className={`booklet-page playful-route-page playful-route-page--${page.kind}`}
					data-booklet-composition={
						page.kind === "day" && page.layoutVariant !== "selected"
							? page.layoutVariant
							: design.compositionId
					}
					data-booklet-page="true"
					data-booklet-theme-key={design.renderKey}
					data-day-id={
						page.kind === "day" ? booklet.days[page.dayIndex]?.id : undefined
					}
					data-layout-variant={
						page.kind === "day" ? page.layoutVariant : undefined
					}
					data-page-id={page.pageId}
					key={page.pageId}
				>
					<PlayfulDecor
						booklet={booklet}
						design={design}
						page={page}
						scope="output"
					/>
					<div className="booklet-page__content">
						{page.kind === "cover" ? (
							<PlayfulRouteCover
								booklet={booklet}
								measurement={false}
								titleSizePt={titleSizePt}
								titleSizesPt={titleSizeCandidates(design)}
							/>
						) : (
							<RouteDayPage booklet={booklet} page={page} />
						)}
					</div>
				</article>
			))}
		</main>
	);
}

function PlayfulRouteMeasurement({
	booklet,
	design,
	rootRef,
}: {
	readonly booklet: EditorialBooklet;
	readonly design: ResolvedBookletDesign;
	readonly rootRef: RefObject<HTMLDivElement | null>;
}) {
	return (
		<div
			aria-hidden="true"
			className={`booklet-measurement booklet-theme playful-route playful-route--${design.compositionId}`}
			data-booklet-decor-variant={design.decorVariantId ?? undefined}
			data-booklet-family="playful-route"
			data-booklet-photo-treatment={design.styleProfile?.photoTreatment}
			data-booklet-style-profile={design.styleProfileId ?? undefined}
			data-booklet-theme-key={design.renderKey}
			ref={rootRef}
			style={playfulRouteStyle(design)}
		>
			<article className="booklet-page playful-route-page playful-route-page--cover">
				<div className="booklet-page__content">
					<PlayfulRouteCover
						booklet={booklet}
						measurement
						titleSizePt={titleSizeCandidates(design)[0] ?? 22}
						titleSizesPt={titleSizeCandidates(design)}
					/>
				</div>
			</article>
			<div
				className="playful-route-measurement-body playful-route-measurement-body--first"
				data-playful-route-first-body="true"
			/>
			<div
				className="playful-route-measurement-body playful-route-measurement-body--continuation"
				data-playful-route-continuation-body="true"
			/>
			{booklet.days.flatMap((day, dayIndex) =>
				(["selected", "wide"] as const).map((width) => (
					<div
						className={`playful-route-measurement-blocks playful-route-measurement-blocks--${width}`}
						key={`${day.id}-${width}`}
					>
						{day.units.map((unit, unitIndex) => (
							<PlayfulRouteBlock
								key={unit.id}
								measurementKey={`${width}-${dayIndex}-${unitIndex}`}
								ordinal={unitIndex + 1}
								unit={unit}
							/>
						))}
					</div>
				)),
			)}
		</div>
	);
}

export function usePlayfulRoutePagePlan(
	model: BookletModel | null,
	design: ResolvedBookletDesign | null,
): FamilyPagePlanResult {
	const activeDesign = design?.familyId === "playful-route" ? design : null;
	const editorial = useMemo(
		() => (model && activeDesign ? projectBooklet(model, "route") : null),
		[activeDesign, model],
	);
	const activeTheme = useMemo(() => {
		if (!activeDesign) {
			return null;
		}
		const candidate = getThemeCandidates(activeDesign.requestedTheme)[0];
		return candidate
			? resolveBookletTheme(activeDesign.requestedTheme, candidate)
			: null;
	}, [activeDesign]);
	const measurementRef = useRef<HTMLDivElement>(null);
	const documentRef = useRef<HTMLElement>(null);
	const runIdRef = useRef(0);
	const [pagePlan, setPagePlan] = useState<
		readonly PlayfulRoutePagePlan[] | null
	>(null);
	const [coverTitleSizePt, setCoverTitleSizePt] = useState<number | null>(null);
	const [preparedModel, setPreparedModel] = useState<BookletModel | null>(null);
	const [preparedRenderKey, setPreparedRenderKey] = useState<string | null>(
		null,
	);
	const [error, setError] = useState<string | null>(null);
	const [status, setStatus] = useState<BookletPagePlanStatus>("idle");

	useEffect(() => {
		runIdRef.current += 1;
		setPagePlan(null);
		setCoverTitleSizePt(null);
		setPreparedModel(null);
		setPreparedRenderKey(null);
		setError(null);
		setStatus(model && activeDesign && activeTheme ? "measuring" : "idle");
	}, [activeDesign, activeTheme, model]);

	useEffect(() => {
		if (!model || !editorial || !activeDesign || !activeTheme) {
			return;
		}
		const runId = ++runIdRef.current;
		let cancelled = false;
		const run = async () => {
			try {
				setStatus("measuring");
				await waitForPlayfulRouteFonts(activeDesign);
				// A cover-only document never draws the day decor, so waiting for
				// the whole variant's artwork would block on an unused asset.
				await waitForMotifAssets(
					editorial.days.length === 0
						? playfulRouteDecorVariantFor(activeDesign.decorVariantId)
								.coverAssetIds
						: activeDesign.decorAssetIds,
				);
				const measurementRoot = measurementRef.current;
				if (!measurementRoot) {
					throw new BookletLayoutError(
						"dom-not-ready",
						"playful-routeの計測用DOMを準備できませんでした。",
					);
				}
				await waitForImages(measurementRoot);
				const measured =
					editorial.days.length === 0
						? null
						: collectMeasurement(
								measurementRoot,
								editorial,
								activeDesign.compositionId,
								titleSizeCandidates(activeDesign),
							);
				const nextPagePlan =
					measured === null
						? [
								{
									kind: "cover" as const,
									pageId: `playful-route-cover-${editorial.journeyId}`,
								},
							]
						: paginatePlayfulRoute(editorial, measured.measurement);
				if (cancelled || runId !== runIdRef.current) {
					return;
				}
				setCoverTitleSizePt(
					measured?.coverTitleSizePt ??
						measureCoverTitle(
							measurementRoot,
							titleSizeCandidates(activeDesign),
						),
				);
				setPagePlan(nextPagePlan);
				setStatus("checking");
				const output = await waitForOutput(
					() => documentRef.current,
					activeDesign.renderKey,
				);
				if (cancelled || runId !== runIdRef.current) {
					return;
				}
				if (!output) {
					throw new BookletLayoutError(
						"dom-not-ready",
						"playful-routeの印刷ページDOMを準備できませんでした。",
					);
				}
				await waitForImages(output);
				if (cancelled || runId !== runIdRef.current) {
					return;
				}
				ensureDocumentFits(output, nextPagePlan);
				ensurePlayfulRouteContent(output, editorial, nextPagePlan);
				prepareFamilyDecor(
					output,
					activeDesign,
					decorationsByPage(
						nextPagePlan,
						activeDesign.compositionId,
						activeDesign.decorVariantId,
						editorial,
					),
				);
				setPreparedModel(model);
				setPreparedRenderKey(activeDesign.renderKey);
				setStatus("ready");
			} catch (runError) {
				if (cancelled || runId !== runIdRef.current) {
					return;
				}
				setPagePlan(null);
				setCoverTitleSizePt(null);
				setPreparedModel(null);
				setPreparedRenderKey(null);
				setError(
					runError instanceof Error
						? runError.message
						: "playful-routeの印刷準備に失敗しました。",
				);
				setStatus("error");
			}
		};
		void run();
		return () => {
			cancelled = true;
		};
	}, [activeDesign, activeTheme, editorial, model]);

	const renderPagePlan: BookletRenderPagePlan | null =
		pagePlan && coverTitleSizePt !== null
			? {
					actualCompositionId:
						pagePlan.find(
							(page) =>
								page.kind === "day" && page.layoutVariant !== "selected",
						)?.layoutVariant ??
						activeDesign?.compositionId ??
						"",
					coverTitleSizePt,
					familyId: "playful-route",
					pagePlan,
				}
			: null;
	const coverVeilBounds: CoverVeilBounds | null = activeDesign
		? (() => {
				const { heightMm, widthMm, xMm, yMm } = playfulRouteCompositionFor(
					activeDesign.compositionId,
				).coverTitle;
				return { height: heightMm, width: widthMm, x: xMm, y: yMm };
			})()
		: null;
	const layoutVariant = pagePlan?.find(
		(page) => page.kind === "day",
	)?.layoutVariant;
	const fallbackLog =
		layoutVariant === "compact-header"
			? [
					"selected:unit-overflow:先頭の予定ブロックが140mmの本文領域に収まらないためcompact-headerへ退避しました。",
				]
			: layoutVariant === "wide-ribbon"
				? [
						"selected:unit-overflow:選択幅の予定ブロックが158mmの本文領域に収まりません。",
						"compact-header:unit-overflow:選択幅の予定ブロックが158mmの本文領域に収まらないためwide-ribbonへ退避しました。",
					]
				: [];

	return {
		activeTheme,
		coverVeilBounds: pagePlan ? coverVeilBounds : null,
		design: activeDesign,
		documentRef,
		error,
		fallbackLog,
		measurementRef,
		pagePlan,
		preparedModel,
		preparedRenderKey,
		renderPagePlan,
		resolvedTheme: status === "ready" ? activeTheme : null,
		status,
	};
}

export function PlayfulRouteRenderer({
	model,
	pagePlanResult,
}: {
	readonly model: BookletModel;
	readonly pagePlanResult: FamilyPagePlanResult;
}) {
	const { design, documentRef, measurementRef, renderPagePlan } =
		pagePlanResult;
	if (design?.familyId !== "playful-route") {
		return null;
	}
	const editorial = projectBooklet(model, "route");
	return (
		<>
			<PlayfulRouteMeasurement
				booklet={editorial}
				design={design}
				rootRef={measurementRef}
			/>
			{renderPagePlan?.familyId === "playful-route" ? (
				<PlayfulRouteDocument
					booklet={editorial}
					design={design}
					pagePlan={renderPagePlan.pagePlan}
					rootRef={documentRef}
					titleSizePt={renderPagePlan.coverTitleSizePt}
				/>
			) : null}
		</>
	);
}
