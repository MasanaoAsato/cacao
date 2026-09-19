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
	type PaperCollageDayMeasurement,
	type PaperCollagePagePlan,
	paginatePaperCollage,
} from "../../../booklet/families/paperCollage";
import type {
	BookletRenderPagePlan,
	ResolvedBookletDesign,
} from "../../../booklet/family";
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
	PAPER_COLLAGE_FONT_FAMILIES,
	paperCollageCompositionFor,
	paperCollagePaletteFor,
} from "../../../theme/families/paperCollage";
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
import "./PaperCollage.css";

const COVER_TITLE_SIZES_PT = [36, 30, 26, 22] as const;
const COVER_BOUNDS: CoverVeilBounds = { height: 42, width: 128, x: 10, y: 10 };
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

async function waitForPaperCollageFonts(): Promise<void> {
	if (!document.fonts) {
		return;
	}
	await document.fonts.ready;
	for (const family of PAPER_COLLAGE_FONT_FAMILIES) {
		const descriptor = `400 10pt "${family}"`;
		await document.fonts.load(descriptor, "東京の旅程・京都散策");
		if (!document.fonts.check(descriptor, "東京の旅程・京都散策")) {
			throw new Error(`${family} 400 の読み込みを確認できませんでした。`);
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
		"表紙の都市名が22ptでも予約領域に収まりません。",
	);
}

function collectMeasurement(root: HTMLElement, booklet: EditorialBooklet) {
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
		coverTitleSizePt: measureCoverTitle(root),
		measurement: {
			cardGap,
			continuationBodyHeight: continuationBody.clientHeight,
			days,
			firstBodyHeight: firstBody.clientHeight,
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

function ensureDocumentFits(
	root: HTMLElement,
	pagePlan: readonly PaperCollagePagePlan[],
): void {
	const pages = Array.from(
		root.querySelectorAll<HTMLElement>("[data-booklet-page]"),
	);
	if (pages.length !== pagePlan.length) {
		throw new BookletLayoutError(
			"dom-not-ready",
			"paper-collageのページ数がページ計画と一致しません。",
		);
	}
	for (const page of pages) {
		if (page.scrollWidth > page.clientWidth + LAYOUT_TOLERANCE_PX) {
			throw new BookletLayoutError(
				"page-inline-overflow",
				"paper-collageの紙面が横方向にあふれています。",
			);
		}
		if (page.scrollHeight > page.clientHeight + LAYOUT_TOLERANCE_PX) {
			throw new BookletLayoutError(
				"page-block-overflow",
				"paper-collageの紙面が縦方向にあふれています。",
			);
		}
	}
	for (const text of root.querySelectorAll<HTMLElement>(
		"[data-booklet-text-role]",
	)) {
		if (hidesText(getComputedStyle(text))) {
			throw new BookletLayoutError(
				"hidden-text",
				"paper-collageで文字を隠す表示設定を検出しました。",
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
	design: ResolvedBookletDesign,
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

function decorationsByPage(
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

function paperCollageStyle(design: ResolvedBookletDesign): CSSProperties {
	const palette = paperCollagePaletteFor(design.paletteId);
	return {
		"--paper-collage-accent": palette.accent,
		"--paper-collage-ink": palette.ink,
		"--paper-collage-paper": palette.paper,
		"--paper-collage-secondary": palette.secondary,
		"--paper-collage-soft": palette.soft,
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

function PaperCollageCover({
	booklet,
	measurement,
	titleSizePt,
}: {
	readonly booklet: EditorialBooklet;
	readonly measurement: boolean;
	readonly titleSizePt: number;
}) {
	const titleSizes = measurement ? COVER_TITLE_SIZES_PT : [titleSizePt];
	return (
		<div className="paper-collage-cover">
			{titleSizes.map((sizePt) => (
				<h1
					className={`paper-collage-cover__title${measurement ? " paper-collage-cover__title--measurement" : ""}`}
					data-booklet-text-role="cover-destination"
					data-paper-collage-cover-title-size={sizePt}
					key={sizePt}
					style={{ fontSize: `${sizePt}pt` }}
				>
					{booklet.cover.title}
				</h1>
			))}
			<PaperPhoto
				className="paper-collage-cover__image"
				image={booklet.cover.image}
				imageClassName="booklet-cover__image"
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

export function PaperCollageCard({
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

function PaperDayHeader({
	booklet,
	day,
	page,
}: {
	readonly booklet: EditorialBooklet;
	readonly day: EditorialDay;
	readonly page: Extract<PaperCollagePagePlan, { readonly kind: "day" }>;
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
						title={booklet.cover.title}
					/>
					<DecorAnchorElement
						id="paper-day-image"
						kind="illustration"
						reserveMm={4}
					/>
				</>
			) : null}
			<div className="paper-collage-day-header__heading">
				<p data-booklet-text-role="day-label">
					Day {String(day.dayNumber).padStart(2, "0")}
					{page.continuation ? "・続き" : ""}
				</p>
				<h2 data-booklet-text-role="day-date">
					<time dateTime={day.date}>{formatBookletDate(day.date)}</time>
				</h2>
			</div>
		</header>
	);
}

function PaperDayPage({
	booklet,
	page,
}: {
	readonly booklet: EditorialBooklet;
	readonly page: Extract<PaperCollagePagePlan, { readonly kind: "day" }>;
}) {
	const day = booklet.days[page.dayIndex];
	if (!day) {
		return null;
	}
	return (
		<>
			<PaperDayHeader booklet={booklet} day={day} page={page} />
			<div
				className={`paper-collage-columns paper-collage-columns--${page.layoutVariant}${page.continuation ? " paper-collage-columns--continuation" : ""}`}
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

function PaperDecor({
	design,
	page,
	scope,
}: {
	readonly design: ResolvedBookletDesign;
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

export function PaperCollageDocument({
	booklet,
	design,
	pagePlan,
	rootRef,
	titleSizePt,
}: {
	readonly booklet: EditorialBooklet;
	readonly design: ResolvedBookletDesign;
	readonly pagePlan: readonly PaperCollagePagePlan[];
	readonly rootRef: RefObject<HTMLElement | null>;
	readonly titleSizePt: number;
}) {
	return (
		<main
			aria-label="旅のしおり印刷プレビュー"
			className={`booklet-document booklet-theme paper-collage paper-collage--${design.compositionId}`}
			data-booklet-design={design.requestedTheme.recipe.id}
			data-booklet-family="paper-collage"
			data-booklet-theme-key={design.renderKey}
			ref={rootRef}
			style={paperCollageStyle(design)}
		>
			{pagePlan.map((page) => (
				<article
					className={`booklet-page paper-collage-page paper-collage-page--${page.kind}`}
					data-booklet-composition={design.compositionId}
					data-booklet-page="true"
					data-booklet-theme-key={design.renderKey}
					data-page-id={page.pageId}
					key={page.pageId}
				>
					<PaperDecor design={design} page={page} scope="output" />
					<div className="booklet-page__content">
						{page.kind === "cover" ? (
							<PaperCollageCover
								booklet={booklet}
								measurement={false}
								titleSizePt={titleSizePt}
							/>
						) : (
							<PaperDayPage booklet={booklet} page={page} />
						)}
					</div>
				</article>
			))}
		</main>
	);
}

function PaperCollageMeasurement({
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
			className={`booklet-measurement booklet-theme paper-collage paper-collage--${design.compositionId}`}
			data-booklet-family="paper-collage"
			data-booklet-theme-key={design.renderKey}
			ref={rootRef}
			style={paperCollageStyle(design)}
		>
			<article className="booklet-page paper-collage-page paper-collage-page--cover">
				<div className="booklet-page__content">
					<PaperCollageCover
						booklet={booklet}
						measurement
						titleSizePt={COVER_TITLE_SIZES_PT[0]}
					/>
				</div>
			</article>
			<div
				className="paper-collage-measurement-body paper-collage-measurement-body--first"
				data-paper-collage-first-body="true"
			/>
			<div
				className="paper-collage-measurement-body paper-collage-measurement-body--continuation"
				data-paper-collage-continuation-body="true"
			/>
			{booklet.days.flatMap((day, dayIndex) =>
				(["narrow", "wide"] as const).map((width) => (
					<div
						className={`paper-collage-measurement-cards paper-collage-measurement-cards--${width}`}
						key={`${day.id}-${width}`}
					>
						{day.units.map((unit, unitIndex) => (
							<PaperCollageCard
								key={unit.id}
								measurementKey={`${width}-${dayIndex}-${unitIndex}`}
								unit={unit}
							/>
						))}
					</div>
				)),
			)}
		</div>
	);
}

export function usePaperCollagePagePlan(
	model: BookletModel | null,
	design: ResolvedBookletDesign | null,
): FamilyPagePlanResult {
	const activeDesign = design?.familyId === "paper-collage" ? design : null;
	const editorial = useMemo(
		() => (model && activeDesign ? projectBooklet(model, "captions") : null),
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
		readonly PaperCollagePagePlan[] | null
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
				await waitForPaperCollageFonts();
				await waitForMotifAssets(activeDesign.decorAssetIds);
				const measurementRoot = measurementRef.current;
				if (!measurementRoot) {
					throw new BookletLayoutError(
						"dom-not-ready",
						"paper-collageの計測用DOMを準備できませんでした。",
					);
				}
				await waitForImages(measurementRoot);
				const measured =
					editorial.days.length === 0
						? null
						: collectMeasurement(measurementRoot, editorial);
				const nextPagePlan =
					measured === null
						? [
								{
									kind: "cover" as const,
									pageId: `paper-collage-cover-${editorial.journeyId}`,
								},
							]
						: paginatePaperCollage(editorial, measured.measurement);
				if (cancelled || runId !== runIdRef.current) {
					return;
				}
				setCoverTitleSizePt(
					measured?.coverTitleSizePt ?? measureCoverTitle(measurementRoot),
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
						"paper-collageの印刷ページDOMを準備できませんでした。",
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
						: "paper-collageの印刷準備に失敗しました。",
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
					familyId: "paper-collage",
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

export function PaperCollageRenderer({
	model,
	pagePlanResult,
}: {
	readonly model: BookletModel;
	readonly pagePlanResult: FamilyPagePlanResult;
}) {
	const { design, documentRef, measurementRef, renderPagePlan } =
		pagePlanResult;
	if (design?.familyId !== "paper-collage") {
		return null;
	}
	const editorial = projectBooklet(model, "captions");
	return (
		<>
			<PaperCollageMeasurement
				booklet={editorial}
				design={design}
				rootRef={measurementRef}
			/>
			{renderPagePlan?.familyId === "paper-collage" ? (
				<PaperCollageDocument
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
