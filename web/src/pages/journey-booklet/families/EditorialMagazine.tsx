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
	EDITORIAL_MAGAZINE_ARTICLE_START_Y_MM,
	EDITORIAL_MAGAZINE_CARD_GAP_MM,
	EDITORIAL_MAGAZINE_CONTINUATION_START_Y_MM,
	EDITORIAL_MAGAZINE_PAGE_BOTTOM_Y_MM,
	type EditorialMagazineMeasurements,
	type EditorialMagazinePagePlan,
	paginateEditorialMagazine,
} from "../../../booklet/families/editorialMagazine";
import type {
	BookletRenderPagePlan,
	ResolvedBookletDesign,
} from "../../../booklet/family";
import type { BookletModel } from "../../../booklet/model";
import { projectBooklet } from "../../../booklet/projectBooklet";
import {
	getThemeCandidates,
	resolveBookletTheme,
} from "../../../theme/bookletTheme";
import {
	editorialMagazineCompositionFor,
	editorialMagazinePaletteFor,
} from "../../../theme/families/editorialMagazine";
import { fontStack } from "../../../theme/families/styleProfiles";
import type { CoverVeilBounds } from "../../../theme/types";
import {
	BookletLayoutError,
	type BookletPagePlanStatus,
} from "../useBookletPagePlan";
import type { FamilyPagePlanResult } from "./useFamilyPagePlan";
import "./EditorialMagazine.css";

const COVER_BOUNDS: CoverVeilBounds = {
	height: 24,
	width: 128,
	x: 10,
	y: 10,
};
const LAYOUT_TOLERANCE_PX = 1;
const FONT_SAMPLE_TEXT = "東京の旅程・京都散策";

type MagazineStyle = CSSProperties & Record<`--${string}`, string>;

function profileFor(design: ResolvedBookletDesign) {
	if (
		design.familyId !== "editorial-magazine" ||
		design.styleProfile === null
	) {
		throw new Error("editorial-magazineの作風プロファイルがありません。");
	}
	return design.styleProfile;
}

export function editorialMagazineStyle(
	design: ResolvedBookletDesign,
): MagazineStyle {
	const profile = profileFor(design);
	const palette = editorialMagazinePaletteFor(design.paletteId);
	const composition = editorialMagazineCompositionFor(design.compositionId);
	const bold = profile.id.endsWith("bold-culture");
	const coverImage = bold
		? composition.boldCoverImage
		: composition.quietCoverImage;
	return {
		"--editorial-accent": palette.accent,
		"--editorial-body-family": fontStack(profile.fontFamilies.body),
		"--editorial-display-family": fontStack(profile.fontFamilies.display),
		"--editorial-ink": palette.ink,
		"--editorial-paper": palette.paper,
		"--editorial-title-size": `${profile.fontSizesPt.title}pt`,
		"--editorial-utility-family": fontStack(profile.fontFamilies.utility),
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
					? "editorial-magazine-day-header editorial-magazine-day-header--continuation"
					: "editorial-magazine-day-header"
			}
		>
			<div className="editorial-magazine-day-header__copy">
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
			</div>
			{!continuation && day.illustration ? (
				<img
					alt=""
					className="editorial-magazine-day-header__image"
					src={day.illustration.contentUrl}
				/>
			) : null}
		</header>
	);
}

function UnitCard({
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

function EmptyDayLabel() {
	return (
		<p
			className="editorial-magazine-empty-day"
			data-booklet-text-role="empty-day"
		>
			予定はありません
		</p>
	);
}

function MagazinePage({
	booklet,
	design,
	page,
}: {
	readonly booklet: EditorialBooklet;
	readonly design: ResolvedBookletDesign;
	readonly page: EditorialMagazinePagePlan;
}) {
	const style = editorialMagazineStyle(design);
	const pageClass =
		page.kind === "cover"
			? "editorial-magazine-page editorial-magazine-page--cover"
			: `editorial-magazine-page editorial-magazine-page--${page.kind}`;
	if (page.kind === "cover") {
		return (
			<article
				className={pageClass}
				data-booklet-composition={design.compositionId}
				data-booklet-family="editorial-magazine"
				data-booklet-page="true"
				data-page-id={page.pageId}
				style={style}
			>
				<div className="editorial-magazine-page__content">
					<div aria-hidden="true" className="editorial-magazine-page__rule" />
					<h1
						className="editorial-magazine-cover__title"
						data-booklet-text-role="cover-title"
					>
						{booklet.cover.title}
					</h1>
					<p
						className="editorial-magazine-cover__period"
						data-booklet-text-role="cover-period"
					>
						{formatDate(booklet.cover.period.start_date)} —{" "}
						{formatDate(booklet.cover.period.end_date)}
					</p>
					<img
						alt={booklet.cover.title}
						className="editorial-magazine-cover__image"
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
			data-booklet-family="editorial-magazine"
			data-booklet-page="true"
			data-page-id={page.pageId}
			data-day-id={day.id}
			style={style}
		>
			<div className="editorial-magazine-page__content">
				<div aria-hidden="true" className="editorial-magazine-page__rule" />
				<DayHeader continuation={page.kind === "continuation"} day={day} />
				<div className="editorial-magazine-article-cards">
					{units.length > 0 ? (
						units.map((unit) => <UnitCard key={unit.id} unit={unit} />)
					) : (
						<EmptyDayLabel />
					)}
				</div>
			</div>
		</article>
	);
}

function MagazineMeasurementPage({
	design,
	day,
}: {
	readonly design: ResolvedBookletDesign;
	readonly day: EditorialDay;
}) {
	return (
		<article
			className="editorial-magazine-page editorial-magazine-page--article"
			data-editorial-magazine-measurement-day={day.id}
			style={editorialMagazineStyle(design)}
		>
			<div className="editorial-magazine-page__content">
				<DayHeader continuation={false} day={day} />
				<DayHeader continuation day={day} />
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
		</article>
	);
}

export function EditorialMagazineMeasurement({
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
			className={`editorial-magazine editorial-magazine-measurement ${design.styleProfileId?.endsWith("bold-culture") ? "editorial-magazine--bold-culture" : ""}`}
			data-booklet-family="editorial-magazine"
			data-booklet-theme-key={design.renderKey}
			ref={rootRef}
			style={editorialMagazineStyle(design)}
		>
			<article
				className="editorial-magazine-page editorial-magazine-page--cover"
				style={editorialMagazineStyle(design)}
			>
				<div className="editorial-magazine-page__content">
					<h1
						className="editorial-magazine-cover__title"
						data-editorial-magazine-cover-title
					>
						{booklet.cover.title}
					</h1>
					<p className="editorial-magazine-cover__period">
						{formatDate(booklet.cover.period.start_date)} —{" "}
						{formatDate(booklet.cover.period.end_date)}
					</p>
					<img
						alt={booklet.cover.title}
						className="editorial-magazine-cover__image"
						src={booklet.cover.image.contentUrl}
					/>
				</div>
			</article>
			{booklet.days.map((day) => (
				<MagazineMeasurementPage day={day} design={design} key={day.id} />
			))}
		</div>
	);
}

function collectMeasurement(
	root: HTMLElement,
	booklet: EditorialBooklet,
	design: ResolvedBookletDesign,
): EditorialMagazineMeasurements {
	const coverTitle = requiredElement(
		root,
		"[data-editorial-magazine-cover-title]",
		"表紙題名",
	);
	const firstPage = root.querySelector<HTMLElement>(
		"[data-editorial-magazine-measurement-day]",
	);
	if (!firstPage && booklet.days.length > 0) {
		throw new BookletLayoutError(
			"dom-not-ready",
			"editorial-magazineの日別計測用DOMがありません。",
		);
	}
	const pageForScale =
		firstPage ??
		requiredElement(root, ".editorial-magazine-page", "計測用紙面");
	const scale = pageScale(pageForScale);
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
		coverTitleHeightMm: heightMm(coverTitle, scale, "表紙題名"),
		pageBottomYmm: EDITORIAL_MAGAZINE_PAGE_BOTTOM_Y_MM,
		styleProfileId: profileFor(design).id,
		unitHeightsMm,
	};
}

function ensureDocumentFits(
	root: HTMLElement,
	pagePlan: readonly EditorialMagazinePagePlan[],
): void {
	const pages = Array.from(
		root.querySelectorAll<HTMLElement>("[data-booklet-page]"),
	);
	if (pages.length !== pagePlan.length) {
		throw new BookletLayoutError(
			"dom-not-ready",
			"editorial-magazineのページ数がページ計画と一致しません。",
		);
	}
	for (const page of pages) {
		if (page.scrollWidth > page.clientWidth + LAYOUT_TOLERANCE_PX) {
			throw new BookletLayoutError(
				"page-inline-overflow",
				"editorial-magazineの紙面が横方向にあふれています。",
			);
		}
		if (page.scrollHeight > page.clientHeight + LAYOUT_TOLERANCE_PX) {
			throw new BookletLayoutError(
				"page-block-overflow",
				"editorial-magazineの紙面が縦方向にあふれています。",
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
			text.scrollHeight > text.clientHeight + LAYOUT_TOLERANCE_PX
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

export function EditorialMagazineDocument({
	booklet,
	design,
	pagePlan,
	rootRef,
}: {
	readonly booklet: EditorialBooklet;
	readonly design: ResolvedBookletDesign;
	readonly pagePlan: readonly EditorialMagazinePagePlan[];
	readonly rootRef: RefObject<HTMLElement | null>;
}) {
	const profile = profileFor(design);
	const style = editorialMagazineStyle(design);
	const familyClass = profile.id.endsWith("bold-culture")
		? "editorial-magazine--bold-culture"
		: "editorial-magazine--quiet-photo";
	return (
		<main
			aria-label="旅のしおり印刷プレビュー"
			className={`booklet-document booklet-theme editorial-magazine ${familyClass}`}
			data-booklet-design={design.requestedTheme.recipe.id}
			data-booklet-comparison-key={design.comparisonKey}
			data-booklet-composition={design.compositionId}
			data-booklet-family="editorial-magazine"
			data-booklet-photo-treatment={design.styleProfile?.photoTreatment}
			data-booklet-resolved-composition="magazine-feature"
			data-booklet-style-profile={design.styleProfileId ?? undefined}
			data-booklet-theme-key={design.renderKey}
			ref={rootRef}
			style={style}
		>
			{pagePlan.map((page) => (
				<MagazinePage
					booklet={booklet}
					design={design}
					key={page.pageId}
					page={page}
				/>
			))}
		</main>
	);
}

export function useEditorialMagazinePagePlan(
	model: BookletModel | null,
	design: ResolvedBookletDesign | null,
): FamilyPagePlanResult {
	const activeDesign =
		design?.familyId === "editorial-magazine" ? design : null;
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
		readonly EditorialMagazinePagePlan[] | null
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
		if (!model || !editorial || !activeDesign || !activeTheme) {
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
						"editorial-magazineの計測用DOMを準備できませんでした。",
					);
				}
				await waitForImages(measurementRoot);
				const measurement = collectMeasurement(
					measurementRoot,
					editorial,
					activeDesign,
				);
				const nextPagePlan = paginateEditorialMagazine(
					editorial,
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
						"editorial-magazineの印刷ページDOMを準備できませんでした。",
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
						: "editorial-magazineの印刷準備に失敗しました。",
				);
				setStatus("error");
			}
		};
		void run();
		return () => {
			cancelled = true;
		};
	}, [activeDesign, activeTheme, editorial, model]);

	const renderPagePlan: BookletRenderPagePlan | null = pagePlan
		? {
				actualCompositionId: "magazine-feature",
				familyId: "editorial-magazine",
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

export function EditorialMagazineRenderer({
	model,
	pagePlanResult,
}: {
	readonly model: BookletModel;
	readonly pagePlanResult: FamilyPagePlanResult;
}) {
	const { design, documentRef, measurementRef, renderPagePlan } =
		pagePlanResult;
	if (design?.familyId !== "editorial-magazine") {
		return null;
	}
	const editorial = projectBooklet(model, "captions");
	return (
		<>
			<EditorialMagazineMeasurement
				booklet={editorial}
				design={design}
				rootRef={measurementRef}
			/>
			{renderPagePlan?.familyId === "editorial-magazine" ? (
				<EditorialMagazineDocument
					booklet={editorial}
					design={design}
					pagePlan={renderPagePlan.pagePlan}
					rootRef={documentRef}
				/>
			) : null}
		</>
	);
}
