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
	type AtlasGridDayMeasurement,
	type AtlasGridPagePlan,
	paginateAtlasGrid,
} from "../../../booklet/families/atlasGrid";
import type {
	BookletRenderPagePlan,
	ResolvedBookletDesign,
} from "../../../booklet/family";
import { formatTransportMode } from "../../../booklet/itineraryFormat";
import type { BookletModel } from "../../../booklet/model";
import { projectBooklet } from "../../../booklet/projectBooklet";
import {
	getThemeCandidates,
	resolveBookletTheme,
} from "../../../theme/bookletTheme";
import {
	ATLAS_GRID_FONT_FAMILIES,
	atlasGridCompositionFor,
	atlasGridPaletteFor,
} from "../../../theme/families/atlasGrid";
import {
	type DecorAnchor,
	type FamilyDecoration,
	resolveFamilyDecor,
} from "../../../theme/families/decorPlacement";
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
import "./AtlasGrid.css";

const COVER_TITLE_SIZES_PT = [40, 34, 28, 22] as const;
const COVER_BOUNDS: CoverVeilBounds = { height: 44, width: 128, x: 10, y: 10 };
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

async function waitForAtlasFonts(): Promise<void> {
	if (!document.fonts) {
		return;
	}
	await document.fonts.ready;
	for (const family of ATLAS_GRID_FONT_FAMILIES) {
		for (const weight of [400, 700] as const) {
			const descriptor = `${weight} 10pt "${family}"`;
			await document.fonts.load(descriptor, "東京の旅程・京都散策");
			if (!document.fonts.check(descriptor, "東京の旅程・京都散策")) {
				throw new Error(
					`${family} ${weight} の読み込みを確認できませんでした。`,
				);
			}
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

function measureCoverTitle(root: HTMLElement): number {
	for (const sizePt of COVER_TITLE_SIZES_PT) {
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
		"表紙の都市名が22ptでも予約領域に収まりません。",
	);
}

function collectMeasurement(root: HTMLElement, editorial: EditorialBooklet) {
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
	return {
		coverTitleSizePt: measureCoverTitle(root),
		measurement: { bodyHeight: body.clientHeight, days },
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
	const lineClamp = (
		style as CSSStyleDeclaration & { webkitLineClamp?: string }
	).webkitLineClamp;
	return (
		unsafe.has(style.overflow) ||
		unsafe.has(style.overflowX) ||
		unsafe.has(style.overflowY) ||
		style.whiteSpace === "nowrap" ||
		(style.textOverflow !== "" && style.textOverflow !== "clip") ||
		(lineClamp !== undefined && lineClamp !== "" && lineClamp !== "none") ||
		style.transform.includes("scale")
	);
}

function ensureDocumentFits(
	root: HTMLElement,
	pagePlan: readonly AtlasGridPagePlan[],
): void {
	const pages = Array.from(
		root.querySelectorAll<HTMLElement>("[data-booklet-page]"),
	);
	if (pages.length !== pagePlan.length) {
		throw new BookletLayoutError(
			"dom-not-ready",
			"atlas-gridのページ数がページ計画と一致しません。",
		);
	}
	for (const page of pages) {
		if (page.scrollWidth > page.clientWidth + LAYOUT_TOLERANCE_PX) {
			throw new BookletLayoutError(
				"page-inline-overflow",
				"atlas-gridの紙面が横方向にあふれています。",
			);
		}
		if (page.scrollHeight > page.clientHeight + LAYOUT_TOLERANCE_PX) {
			throw new BookletLayoutError(
				"page-block-overflow",
				"atlas-gridの紙面が縦方向にあふれています。",
			);
		}
	}
	for (const text of root.querySelectorAll<HTMLElement>(
		"[data-booklet-text-role]",
	)) {
		if (hidesText(getComputedStyle(text))) {
			throw new BookletLayoutError(
				"hidden-text",
				"atlas-gridで文字を隠す表示設定を検出しました。",
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

function atlasDecorFor(page: AtlasGridPagePlan, design: ResolvedBookletDesign) {
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

function decorationsByPage(
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

function atlasStyle(design: ResolvedBookletDesign): CSSProperties {
	const palette = atlasGridPaletteFor(design.paletteId);
	const composition = atlasGridCompositionFor(design.compositionId);
	return {
		"--atlas-accent": palette.accent,
		"--atlas-column-transport": `${composition.columnWidthsMm[2]}mm`,
		"--atlas-column-place": `${composition.columnWidthsMm[1]}mm`,
		"--atlas-column-time": `${composition.columnWidthsMm[0]}mm`,
		"--atlas-ink": palette.ink,
		"--atlas-paper": palette.paper,
		"--atlas-secondary": palette.secondary,
		"--atlas-soft": palette.soft,
		"--atlas-time-size": `${composition.timeFontSizePt}pt`,
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
			className={`atlas-grid-anchor atlas-grid-anchor--${id}`}
			data-booklet-anchor={id}
			data-booklet-anchor-kind={kind}
			data-booklet-anchor-reserve={reserveMm}
		/>
	);
}

function AtlasCover({
	booklet,
	compositionId,
	measurement,
	titleSizePt,
}: {
	readonly booklet: EditorialBooklet;
	readonly compositionId: string;
	readonly measurement: boolean;
	readonly titleSizePt: number;
}) {
	const titleSizes = measurement ? COVER_TITLE_SIZES_PT : [titleSizePt];
	return (
		<div className="atlas-grid-cover">
			{titleSizes.map((sizePt) => (
				<h1
					className={`atlas-grid-cover__title${measurement ? " atlas-grid-cover__title--measurement" : ""}`}
					data-atlas-cover-title-size={sizePt}
					data-booklet-text-role="cover-destination"
					key={sizePt}
					style={{ fontSize: `${sizePt}pt` }}
				>
					{booklet.cover.title}
				</h1>
			))}
			<figure className="atlas-grid-cover__image">
				<img
					className="booklet-cover__image"
					alt={`${booklet.cover.title}の表紙画像`}
					decoding="async"
					height={booklet.cover.image.height}
					loading="eager"
					src={booklet.cover.image.contentUrl}
					width={booklet.cover.image.width}
				/>
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

function AtlasDayBand({
	continuation,
	day,
}: {
	readonly continuation: boolean;
	readonly day: EditorialDay;
}) {
	return (
		<tr className="atlas-grid-day-band" data-atlas-grid-day-band="true">
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

function AtlasEmptyRow({
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

function AtlasColumnHeadings() {
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

function AtlasTableHeader({
	continuation,
}: {
	readonly continuation: boolean;
}) {
	return (
		<>
			<header className="atlas-grid-table__header">
				<p data-booklet-text-role="utility-label">ITINERARY / ATLAS</p>
				<h2 data-booklet-text-role="page-title">
					旅程一覧{continuation ? "・続き" : ""}
				</h2>
			</header>
			<DecorAnchorElement id="table-compass" kind="section" />
		</>
	);
}

function AtlasTablePage({
	booklet,
	page,
}: {
	readonly booklet: EditorialBooklet;
	readonly page: Extract<AtlasGridPagePlan, { readonly kind: "table" }>;
}) {
	return (
		<>
			<AtlasTableHeader
				continuation={page.sections[0]?.continuation ?? false}
			/>
			<table className="atlas-grid-table">
				<AtlasColumnHeadings />
				<tbody className="atlas-grid-table__body">
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

function AtlasDecor({
	design,
	page,
	scope,
}: {
	readonly design: ResolvedBookletDesign;
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

export function AtlasGridDocument({
	booklet,
	design,
	pagePlan,
	rootRef,
	titleSizePt,
}: {
	readonly booklet: EditorialBooklet;
	readonly design: ResolvedBookletDesign;
	readonly pagePlan: readonly AtlasGridPagePlan[];
	readonly rootRef: RefObject<HTMLElement | null>;
	readonly titleSizePt: number;
}) {
	return (
		<main
			aria-label="旅のしおり印刷プレビュー"
			className={`booklet-document booklet-theme atlas-grid atlas-grid--${design.compositionId}`}
			data-booklet-design={design.requestedTheme.recipe.id}
			data-booklet-family="atlas-grid"
			data-booklet-theme-key={design.renderKey}
			ref={rootRef}
			style={atlasStyle(design)}
		>
			{pagePlan.map((page) => (
				<article
					className={`booklet-page atlas-grid-page atlas-grid-page--${page.kind}`}
					data-booklet-composition={design.compositionId}
					data-booklet-page="true"
					data-booklet-theme-key={design.renderKey}
					data-page-id={page.pageId}
					key={page.pageId}
				>
					<AtlasDecor design={design} page={page} scope="output" />
					<div className="booklet-page__content">
						{page.kind === "cover" ? (
							<AtlasCover
								booklet={booklet}
								compositionId={design.compositionId}
								measurement={false}
								titleSizePt={titleSizePt}
							/>
						) : (
							<AtlasTablePage booklet={booklet} page={page} />
						)}
					</div>
				</article>
			))}
		</main>
	);
}

function AtlasGridMeasurement({
	booklet,
	design,
	rootRef,
}: {
	readonly booklet: EditorialBooklet;
	readonly design: ResolvedBookletDesign;
	readonly rootRef: RefObject<HTMLDivElement | null>;
}) {
	const coverPlan: AtlasGridPagePlan = {
		kind: "cover",
		pageId: `atlas-cover-${booklet.journeyId}`,
	};
	return (
		<div
			aria-hidden="true"
			className={`booklet-measurement booklet-theme atlas-grid atlas-grid--${design.compositionId}`}
			data-booklet-family="atlas-grid"
			data-booklet-theme-key={design.renderKey}
			ref={rootRef}
			style={atlasStyle(design)}
		>
			<article className="booklet-page atlas-grid-page atlas-grid-page--cover">
				<AtlasDecor design={design} page={coverPlan} scope="measurement" />
				<div className="booklet-page__content">
					<AtlasCover
						booklet={booklet}
						compositionId={design.compositionId}
						measurement
						titleSizePt={COVER_TITLE_SIZES_PT[0]}
					/>
				</div>
			</article>
			{booklet.days.map((day, dayIndex) => (
				<article
					className="booklet-page atlas-grid-page atlas-grid-page--table"
					data-atlas-grid-measurement-day={dayIndex}
					key={day.id}
				>
					<div className="booklet-page__content">
						<AtlasTableHeader continuation={false} />
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
					</div>
				</article>
			))}
		</div>
	);
}

export function useAtlasGridPagePlan(
	model: BookletModel | null,
	design: ResolvedBookletDesign | null,
): FamilyPagePlanResult {
	const activeDesign = design?.familyId === "atlas-grid" ? design : null;
	const editorial = useMemo(
		() => (model && activeDesign ? projectBooklet(model, "timetable") : null),
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
	const [pagePlan, setPagePlan] = useState<readonly AtlasGridPagePlan[] | null>(
		null,
	);
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
				await waitForAtlasFonts();
				await waitForMotifAssets(activeDesign.decorAssetIds);
				const measurementRoot = measurementRef.current;
				if (!measurementRoot) {
					throw new BookletLayoutError(
						"dom-not-ready",
						"atlas-gridの計測用DOMを準備できませんでした。",
					);
				}
				await waitForImages(measurementRoot);
				const measured = collectMeasurement(measurementRoot, editorial);
				const nextPagePlan = paginateAtlasGrid(editorial, measured.measurement);
				if (cancelled || runId !== runIdRef.current) {
					return;
				}
				setCoverTitleSizePt(measured.coverTitleSizePt);
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
						"atlas-gridの印刷ページDOMを準備できませんでした。",
					);
				}
				ensureDocumentFits(output, nextPagePlan);
				prepareFamilyDecor(
					output,
					activeDesign,
					decorationsByPage(nextPagePlan, activeDesign.compositionId),
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
						: "atlas-gridの印刷準備に失敗しました。",
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
					coverTitleSizePt,
					familyId: "atlas-grid",
					pagePlan,
				}
			: null;

	return {
		activeTheme,
		coverVeilBounds: pagePlan ? COVER_BOUNDS : null,
		design: activeDesign,
		documentRef,
		error,
		fallbackLog: [],
		measurementRef,
		pagePlan,
		preparedModel,
		preparedRenderKey,
		renderPagePlan,
		resolvedTheme: status === "ready" ? activeTheme : null,
		status,
	};
}

export function AtlasGridRenderer({
	model,
	pagePlanResult,
}: {
	readonly model: BookletModel;
	readonly pagePlanResult: FamilyPagePlanResult;
}) {
	const { design, documentRef, measurementRef, renderPagePlan } =
		pagePlanResult;
	if (design?.familyId !== "atlas-grid") {
		return null;
	}
	const editorial = projectBooklet(model, "timetable");
	return (
		<>
			<AtlasGridMeasurement
				booklet={editorial}
				design={design}
				rootRef={measurementRef}
			/>
			{renderPagePlan?.familyId === "atlas-grid" ? (
				<AtlasGridDocument
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
