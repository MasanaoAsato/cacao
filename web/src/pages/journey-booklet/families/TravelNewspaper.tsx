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
	paginateTravelNewspaper,
	TRAVEL_NEWSPAPER_ARTICLE_GAP_MM,
	TRAVEL_NEWSPAPER_ARTICLE_START_Y_MM,
	TRAVEL_NEWSPAPER_COLUMN_GAP_MM,
	TRAVEL_NEWSPAPER_CONTINUATION_START_Y_MM,
	TRAVEL_NEWSPAPER_PAGE_BOTTOM_Y_MM,
	type TravelNewspaperMeasurements,
	type TravelNewspaperPagePlan,
} from "../../../booklet/families/travelNewspaper";
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
import { fontStack } from "../../../theme/families/styleProfiles";
import {
	travelNewspaperCompositionFor,
	travelNewspaperPaletteFor,
} from "../../../theme/families/travelNewspaper";
import type { CoverVeilBounds } from "../../../theme/types";
import {
	BookletLayoutError,
	type BookletPagePlanStatus,
} from "../useBookletPagePlan";
import type { FamilyPagePlanResult } from "./useFamilyPagePlan";
import "./TravelNewspaper.css";

const COVER_BOUNDS: CoverVeilBounds = {
	height: 24,
	width: 128,
	x: 10,
	y: 10,
};
const LAYOUT_TOLERANCE_PX = 1;
const FONT_SAMPLE_TEXT = "旅の通信・東京の街歩き";

type NewspaperStyle = CSSProperties & Record<`--${string}`, string>;

function profileFor(design: ResolvedBookletDesign) {
	if (design.familyId !== "travel-newspaper" || design.styleProfile === null) {
		throw new Error("travel-newspaperの作風プロファイルがありません。");
	}
	return design.styleProfile;
}

export function travelNewspaperStyle(
	design: ResolvedBookletDesign,
): NewspaperStyle {
	const profile = profileFor(design);
	const palette = travelNewspaperPaletteFor(design.paletteId);
	const composition = travelNewspaperCompositionFor(design.compositionId);
	const cityWalk = profile.id.endsWith("city-walk");
	const imageX = cityWalk
		? composition.coverImage.cityXmm
		: composition.coverImage.classicXmm;
	return {
		"--newspaper-accent": palette.accent,
		"--newspaper-body-family": fontStack(profile.fontFamilies.body),
		"--newspaper-column-gap": `${composition.columnGapMm}mm`,
		"--newspaper-display-family": fontStack(profile.fontFamilies.display),
		"--newspaper-ink": palette.ink,
		"--newspaper-paper": palette.paper,
		"--newspaper-soft": palette.soft,
		"--newspaper-title-size": `${profile.fontSizesPt.title}pt`,
		"--newspaper-utility-family": fontStack(profile.fontFamilies.utility),
		"--newspaper-cover-left": `${imageX}mm`,
		"--newspaper-cover-width": `${composition.coverImage.widthMm}mm`,
		"--newspaper-cover-height": `${composition.coverImage.heightMm}mm`,
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
			"travel-newspaperのページ幅を計測できません。",
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

function waitForFrame(): Promise<void> {
	return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

async function waitForFonts(design: ResolvedBookletDesign): Promise<void> {
	if (!document.fonts) {
		return;
	}
	await document.fonts.ready;
	const profile = profileFor(design);
	const requiredFonts = new Map([
		[profile.fontFamilies.display, profile.fontWeights.display],
		[profile.fontFamilies.body, profile.fontWeights.body],
		[profile.fontFamilies.utility, profile.fontWeights.utility],
	]);
	for (const [family, weight] of requiredFonts) {
		const descriptor = `${weight} 10pt "${family}"`;
		await document.fonts.load(descriptor, FONT_SAMPLE_TEXT);
		if (!document.fonts.check(descriptor, FONT_SAMPLE_TEXT)) {
			throw new Error(`${family} ${weight} の読み込みを確認できませんでした。`);
		}
	}
}

async function waitForImages(root: ParentNode): Promise<void> {
	await Promise.all(
		Array.from(root.querySelectorAll<HTMLImageElement>("img")).map(
			async (image) => {
				if (typeof image.decode === "function") {
					try {
						await image.decode();
						return;
					} catch {
						throw new Error(`画像「${image.alt}」の読み込みに失敗しました。`);
					}
				}
				if (!image.complete || image.naturalWidth <= 0) {
					throw new Error(`画像「${image.alt}」の読み込みに失敗しました。`);
				}
			},
		),
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

function DayHeader({
	continuation,
	day,
}: {
	readonly continuation: boolean;
	readonly day: EditorialDay;
}) {
	return (
		<header
			className={
				continuation
					? "travel-newspaper-day-header travel-newspaper-day-header--continuation"
					: "travel-newspaper-day-header"
			}
		>
			<div className="travel-newspaper-day-header__copy">
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
				<div aria-hidden="true" className="travel-newspaper-day-header__rule" />
			</div>
			{!continuation && day.illustration ? (
				<img
					alt=""
					className="travel-newspaper-day-header__image"
					src={day.illustration.contentUrl}
				/>
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

function NewspaperPage({
	booklet,
	design,
	page,
}: {
	readonly booklet: EditorialBooklet;
	readonly design: ResolvedBookletDesign;
	readonly page: TravelNewspaperPagePlan;
}) {
	const style = travelNewspaperStyle(design);
	const pageClass =
		page.kind === "cover"
			? "travel-newspaper-page travel-newspaper-page--cover"
			: `travel-newspaper-page travel-newspaper-page--${page.kind}`;
	if (page.kind === "cover") {
		return (
			<article
				className={pageClass}
				data-booklet-composition={design.compositionId}
				data-booklet-family="travel-newspaper"
				data-booklet-page="true"
				data-booklet-theme-key={design.renderKey}
				data-page-id={page.pageId}
				style={style}
			>
				<div className="travel-newspaper-page__content">
					<p
						className="travel-newspaper-cover__masthead"
						data-booklet-text-role="masthead"
					>
						旅の通信
					</p>
					<h1
						className="travel-newspaper-cover__title"
						data-booklet-text-role="cover-title"
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
					<img
						alt={booklet.cover.title}
						className="travel-newspaper-cover__image booklet-cover__image"
						src={booklet.cover.image.contentUrl}
					/>
				</div>
			</article>
		);
	}

	const day = booklet.days[page.dayIndex];
	if (!day) {
		return null;
	}
	const units = page.unitIndexes
		.map((unitIndex) => day.units[unitIndex])
		.filter((unit): unit is EditorialArrivalUnit => unit !== undefined);
	return (
		<article
			className={pageClass}
			data-booklet-composition={design.compositionId}
			data-booklet-family="travel-newspaper"
			data-booklet-page="true"
			data-booklet-theme-key={design.renderKey}
			data-day-id={day.id}
			data-page-id={page.pageId}
			style={style}
		>
			<div className="travel-newspaper-page__content">
				<DayHeader continuation={page.kind === "continuation"} day={day} />
				<div className="travel-newspaper-articles">
					{units.length > 0 ? (
						units.map((unit) => <UnitArticle key={unit.id} unit={unit} />)
					) : (
						<EmptyDayLabel />
					)}
				</div>
			</div>
		</article>
	);
}

function MeasurementPage({
	day,
	design,
}: {
	readonly day: EditorialDay;
	readonly design: ResolvedBookletDesign;
}) {
	return (
		<article
			className="travel-newspaper-page travel-newspaper-page--articles"
			data-travel-newspaper-measurement-day={day.id}
			style={travelNewspaperStyle(design)}
		>
			<div className="travel-newspaper-page__content">
				<DayHeader continuation={false} day={day} />
				<DayHeader continuation day={day} />
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
			</div>
		</article>
	);
}

export function TravelNewspaperMeasurement({
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
			className="travel-newspaper travel-newspaper-measurement"
			data-booklet-family="travel-newspaper"
			data-booklet-theme-key={design.renderKey}
			ref={rootRef}
			style={travelNewspaperStyle(design)}
		>
			<article
				className="travel-newspaper-page travel-newspaper-page--cover"
				style={travelNewspaperStyle(design)}
			>
				<div className="travel-newspaper-page__content">
					<h1
						className="travel-newspaper-cover__title"
						data-travel-newspaper-cover-title
					>
						{booklet.cover.title}
					</h1>
					<img
						alt={booklet.cover.title}
						className="travel-newspaper-cover__image"
						src={booklet.cover.image.contentUrl}
					/>
				</div>
			</article>
			{booklet.days.map((day) => (
				<MeasurementPage day={day} design={design} key={day.id} />
			))}
		</div>
	);
}

function collectMeasurement(
	root: HTMLElement,
	booklet: EditorialBooklet,
	design: ResolvedBookletDesign,
): TravelNewspaperMeasurements {
	const coverTitle = requiredElement(
		root,
		"[data-travel-newspaper-cover-title]",
		"表紙題名",
	);
	const firstPage = root.querySelector<HTMLElement>(
		"[data-travel-newspaper-measurement-day]",
	);
	if (!firstPage && booklet.days.length > 0) {
		throw new BookletLayoutError(
			"dom-not-ready",
			"travel-newspaperの日別計測用DOMがありません。",
		);
	}
	const pageForScale =
		firstPage ?? requiredElement(root, ".travel-newspaper-page", "計測用紙面");
	const scale = pageScale(pageForScale);
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
		articleGapMm: TRAVEL_NEWSPAPER_ARTICLE_GAP_MM,
		articleStartYmm: TRAVEL_NEWSPAPER_ARTICLE_START_Y_MM,
		columnGapMm: TRAVEL_NEWSPAPER_COLUMN_GAP_MM,
		continuationHeaderHeightMm: maxOrZero(continuationHeaderHeights),
		continuationStartYmm: TRAVEL_NEWSPAPER_CONTINUATION_START_Y_MM,
		coverTitleHeightMm: heightMm(coverTitle, scale, "表紙題名"),
		dayHeaderHeightMm: maxOrZero(dayHeaderHeights),
		pageBottomYmm: TRAVEL_NEWSPAPER_PAGE_BOTTOM_Y_MM,
		styleProfileId: profileFor(design).id,
		unitHeightsMm,
	};
}

function ensureDocumentFits(
	root: HTMLElement,
	pagePlan: readonly TravelNewspaperPagePlan[],
): void {
	const pages = Array.from(
		root.querySelectorAll<HTMLElement>("[data-booklet-page]"),
	);
	if (pages.length !== pagePlan.length) {
		throw new BookletLayoutError(
			"dom-not-ready",
			"travel-newspaperのページ数がページ計画と一致しません。",
		);
	}
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
	for (const text of root.querySelectorAll<HTMLElement>(
		"[data-booklet-text-role]",
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

async function waitForOutput(
	getRoot: () => HTMLElement | null,
	renderKey: string,
): Promise<HTMLElement | null> {
	await waitForFrame();
	for (let attempt = 0; attempt < 12; attempt += 1) {
		const root = getRoot();
		if (root?.dataset.bookletThemeKey === renderKey) {
			return root;
		}
		await waitForFrame();
	}
	return null;
}

export function TravelNewspaperDocument({
	booklet,
	design,
	pagePlan,
	rootRef,
}: {
	readonly booklet: EditorialBooklet;
	readonly design: ResolvedBookletDesign;
	readonly pagePlan: readonly TravelNewspaperPagePlan[];
	readonly rootRef: RefObject<HTMLElement | null>;
}) {
	const profile = profileFor(design);
	const style = travelNewspaperStyle(design);
	return (
		<main
			aria-label="旅のしおり印刷プレビュー"
			className={`booklet-document booklet-theme travel-newspaper ${profile.id.endsWith("city-walk") ? "travel-newspaper--city-walk" : "travel-newspaper--classic-travel"}`}
			data-booklet-comparison-key={design.comparisonKey}
			data-booklet-composition={design.compositionId}
			data-booklet-design={design.requestedTheme.recipe.id}
			data-booklet-family="travel-newspaper"
			data-booklet-photo-treatment={profile.photoTreatment}
			data-booklet-resolved-composition="newspaper-columns"
			data-booklet-style-profile={design.styleProfileId ?? undefined}
			data-booklet-theme-key={design.renderKey}
			ref={rootRef}
			style={style}
		>
			{pagePlan.map((page) => (
				<NewspaperPage
					booklet={booklet}
					design={design}
					key={page.pageId}
					page={page}
				/>
			))}
		</main>
	);
}

export function useTravelNewspaperPagePlan(
	model: BookletModel | null,
	design: ResolvedBookletDesign | null,
): FamilyPagePlanResult {
	const activeDesign = design?.familyId === "travel-newspaper" ? design : null;
	const newspaper = useMemo(
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
	const [pagePlan, setPagePlan] = useState<
		readonly TravelNewspaperPagePlan[] | null
	>(null);
	const [preparedModel, setPreparedModel] = useState<BookletModel | null>(null);
	const [preparedRenderKey, setPreparedRenderKey] = useState<string | null>(
		null,
	);
	const [error, setError] = useState<string | null>(null);
	const [status, setStatus] = useState<BookletPagePlanStatus>("idle");

	useEffect(() => {
		runIdRef.current += 1;
		setPagePlan(null);
		setPreparedModel(null);
		setPreparedRenderKey(null);
		setError(null);
		setStatus(model && activeDesign && activeTheme ? "measuring" : "idle");
	}, [activeDesign, activeTheme, model]);

	useEffect(() => {
		if (!model || !newspaper || !activeDesign || !activeTheme) {
			return;
		}
		const runId = ++runIdRef.current;
		let cancelled = false;
		const run = async () => {
			try {
				setStatus("measuring");
				await waitForFonts(activeDesign);
				const measurementRoot = measurementRef.current;
				if (!measurementRoot) {
					throw new BookletLayoutError(
						"dom-not-ready",
						"travel-newspaperの計測用DOMを準備できませんでした。",
					);
				}
				await waitForImages(measurementRoot);
				const measurement = collectMeasurement(
					measurementRoot,
					newspaper,
					activeDesign,
				);
				const nextPagePlan = paginateTravelNewspaper(
					newspaper,
					measurement,
					profileFor(activeDesign),
				);
				if (cancelled || runId !== runIdRef.current) {
					return;
				}
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
						"travel-newspaperの印刷ページDOMを準備できませんでした。",
					);
				}
				await waitForImages(output);
				ensureDocumentFits(output, nextPagePlan);
				setPreparedModel(model);
				setPreparedRenderKey(activeDesign.renderKey);
				setStatus("ready");
			} catch (runError) {
				if (cancelled || runId !== runIdRef.current) {
					return;
				}
				setPagePlan(null);
				setPreparedModel(null);
				setPreparedRenderKey(null);
				setError(
					runError instanceof Error
						? runError.message
						: "travel-newspaperの印刷準備に失敗しました。",
				);
				setStatus("error");
			}
		};
		void run();
		return () => {
			cancelled = true;
		};
	}, [activeDesign, activeTheme, model, newspaper]);

	const renderPagePlan: BookletRenderPagePlan | null = pagePlan
		? {
				actualCompositionId: "newspaper-columns",
				familyId: "travel-newspaper",
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

export function TravelNewspaperRenderer({
	model,
	pagePlanResult,
}: {
	readonly model: BookletModel;
	readonly pagePlanResult: FamilyPagePlanResult;
}) {
	const { design, documentRef, measurementRef, renderPagePlan } =
		pagePlanResult;
	if (design?.familyId !== "travel-newspaper") {
		return null;
	}
	const newspaper = projectBooklet(model, "timetable");
	return (
		<>
			<TravelNewspaperMeasurement
				booklet={newspaper}
				design={design}
				rootRef={measurementRef}
			/>
			{renderPagePlan?.familyId === "travel-newspaper" ? (
				<TravelNewspaperDocument
					booklet={newspaper}
					design={design}
					pagePlan={renderPagePlan.pagePlan}
					rootRef={documentRef}
				/>
			) : null}
		</>
	);
}
