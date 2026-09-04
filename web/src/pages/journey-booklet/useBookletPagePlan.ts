import { useEffect, useMemo, useRef, useState } from "react";
import type { BookletModel } from "../../booklet/model";
import {
	type BookletPageMeasurement,
	isRecoverableBookletFailure,
	paginateBooklet,
	type RecoverableBookletFailureCode,
} from "../../booklet/paginate";
import {
	getCoverLayoutDefinition,
	getFontPairFamilies,
	getThemeCandidates,
	resolveBookletTheme,
} from "../../theme/bookletTheme";
import type {
	BookletThemeCandidate,
	CoverVeilBounds,
	RequestedBookletTheme,
	ResolvedBookletTheme,
} from "../../theme/types";

export type BookletPagePlanStatus =
	| "idle"
	| "measuring"
	| "checking"
	| "ready"
	| "error";

export type BookletPagePlanResult = {
	readonly activeTheme: ResolvedBookletTheme | null;
	readonly coverVeilBounds: CoverVeilBounds | null;
	readonly documentRef: React.RefObject<HTMLElement | null>;
	readonly error: string | null;
	readonly measurementRef: React.RefObject<HTMLDivElement | null>;
	readonly pagePlan: ReturnType<typeof paginateBooklet> | null;
	readonly resolvedTheme: ResolvedBookletTheme | null;
	readonly status: BookletPagePlanStatus;
};

type LayoutFailureCode =
	| RecoverableBookletFailureCode
	| "cover-bounds-invalid"
	| "dom-not-ready"
	| "hidden-text";

const FONT_SAMPLE_TEXT = "東京の旅程・京都散策";
const LAYOUT_ROUNDING_TOLERANCE_PX = 1;

export class BookletLayoutError extends Error {
	readonly code: LayoutFailureCode;

	constructor(code: LayoutFailureCode, message: string) {
		super(message);
		this.code = code;
		this.name = "BookletLayoutError";
	}
}

function errorMessage(error: unknown, fallback: string): string {
	return error instanceof Error ? error.message : fallback;
}

function isRecoverableLayoutFailure(error: unknown): boolean {
	return (
		isRecoverableBookletFailure(error) ||
		(error instanceof BookletLayoutError &&
			error.code !== "cover-bounds-invalid" &&
			error.code !== "dom-not-ready" &&
			error.code !== "hidden-text")
	);
}

async function waitForImageDecode(image: HTMLImageElement): Promise<void> {
	if (typeof image.decode === "function") {
		try {
			await image.decode();
			return;
		} catch {
			throw new Error(`画像「${image.alt}」の読み込みに失敗しました。`);
		}
	}
	if (image.complete && image.naturalWidth > 0) {
		return;
	}
	await new Promise<void>((resolve, reject) => {
		const handleLoad = () => {
			cleanup();
			resolve();
		};
		const handleError = () => {
			cleanup();
			reject(new Error(`画像「${image.alt}」の読み込みに失敗しました。`));
		};
		const cleanup = () => {
			image.removeEventListener("load", handleLoad);
			image.removeEventListener("error", handleError);
		};
		image.addEventListener("load", handleLoad, { once: true });
		image.addEventListener("error", handleError, { once: true });
	});
}

export async function waitForFonts(
	theme: BookletThemeCandidate,
): Promise<void> {
	if (!document.fonts) {
		return;
	}
	await document.fonts.ready;
	for (const family of getFontPairFamilies(theme.fontPairId)) {
		for (const weight of [400, 700] as const) {
			const descriptor = `${weight} 10pt "${family}"`;
			await document.fonts.load(descriptor, FONT_SAMPLE_TEXT);
			if (!document.fonts.check(descriptor, FONT_SAMPLE_TEXT)) {
				throw new Error(
					`${family} ${weight} の読み込みを確認できませんでした。`,
				);
			}
		}
	}
}

function readNaturalHeight(element: HTMLElement, name: string): number {
	const height = Math.max(
		element.getBoundingClientRect().height,
		element.offsetHeight,
		element.scrollHeight,
	);
	if (!Number.isFinite(height) || height < 0) {
		throw new BookletLayoutError(
			"dom-not-ready",
			`${name}を計測できませんでした。`,
		);
	}
	return height;
}

function readOuterHeight(element: HTMLElement, name: string): number {
	const style = getComputedStyle(element);
	const marginTop = Number.parseFloat(style.marginTop) || 0;
	const marginBottom = Number.parseFloat(style.marginBottom) || 0;
	return readNaturalHeight(element, name) + marginTop + marginBottom;
}

function readContentHeight(element: HTMLElement): number {
	const height = Math.max(
		element.clientHeight,
		element.getBoundingClientRect().height,
	);
	if (!Number.isFinite(height) || height <= 0) {
		throw new BookletLayoutError(
			"dom-not-ready",
			"ページ本文高さを計測できませんでした。",
		);
	}
	return height;
}

function readContentWidth(element: HTMLElement): number {
	const width = Math.max(
		element.clientWidth,
		element.getBoundingClientRect().width,
	);
	if (!Number.isFinite(width) || width <= 0) {
		throw new BookletLayoutError(
			"dom-not-ready",
			"ページ本文幅を計測できませんでした。",
		);
	}
	return width;
}

function queryRequired(
	root: ParentNode,
	selector: string,
	name: string,
): HTMLElement {
	const element = root.querySelector<HTMLElement>(selector);
	if (!element) {
		throw new BookletLayoutError(
			"dom-not-ready",
			`${name}を準備できませんでした。`,
		);
	}
	return element;
}

const COVER_VIEWBOX_WIDTH = 148;
const COVER_VIEWBOX_HEIGHT = 210;

function validRect(rect: DOMRect): boolean {
	return (
		[rect.left, rect.top, rect.width, rect.height].every(Number.isFinite) &&
		rect.width > 0 &&
		rect.height > 0
	);
}

export function measureCoverVeilBounds(
	root: HTMLDivElement,
	theme: BookletThemeCandidate,
): CoverVeilBounds {
	const cover = queryRequired(root, ".booklet-cover-content", "表紙");
	const text = queryRequired(root, "[data-booklet-cover-copy]", "表紙文字領域");
	if (text.scrollWidth > text.clientWidth) {
		throw new BookletLayoutError(
			"cover-inline-overflow",
			"表紙の横方向の文字が収まりません。",
		);
	}
	if (text.scrollHeight > text.clientHeight) {
		throw new BookletLayoutError(
			"cover-block-overflow",
			"表紙の縦方向の文字が収まりません。",
		);
	}

	const coverRect = cover.getBoundingClientRect();
	const textRect = text.getBoundingClientRect();
	if (!validRect(coverRect) || !validRect(textRect)) {
		throw new BookletLayoutError(
			"cover-bounds-invalid",
			"表紙文字の位置を計測できませんでした。",
		);
	}

	const scaleX = COVER_VIEWBOX_WIDTH / coverRect.width;
	const scaleY = COVER_VIEWBOX_HEIGHT / coverRect.height;
	const bounds = {
		height: textRect.height * scaleY,
		width: textRect.width * scaleX,
		x: (textRect.left - coverRect.left) * scaleX,
		y: (textRect.top - coverRect.top) * scaleY,
	};
	if (
		![bounds.x, bounds.y, bounds.width, bounds.height].every(Number.isFinite) ||
		bounds.width <= 0 ||
		bounds.height <= 0
	) {
		throw new BookletLayoutError(
			"cover-bounds-invalid",
			"表紙文字の位置を計測できませんでした。",
		);
	}

	const safeArea = getCoverLayoutDefinition(theme.coverLayoutId).safeArea;
	const tolerance = 0.1;
	if (
		bounds.x < safeArea.xMm - tolerance ||
		bounds.y < safeArea.yMm - tolerance ||
		bounds.x + bounds.width > safeArea.xMm + safeArea.widthMm + tolerance ||
		bounds.y + bounds.height > safeArea.yMm + safeArea.heightMm + tolerance
	) {
		throw new BookletLayoutError(
			"cover-bounds-invalid",
			"表紙文字が安全領域をはみ出しました。",
		);
	}

	return Object.freeze(bounds);
}

type CollectedMeasurement = {
	readonly coverVeilBounds: CoverVeilBounds;
	readonly pageMeasurement: BookletPageMeasurement;
};

function collectMeasurement(
	model: BookletModel,
	root: HTMLDivElement,
	theme: BookletThemeCandidate,
): CollectedMeasurement {
	const coverVeilBounds = measureCoverVeilBounds(root, theme);
	const coverText = queryRequired(
		root,
		"[data-booklet-cover-copy]",
		"表紙文字領域",
	);
	const dayPages = Array.from(
		root.querySelectorAll<HTMLElement>(".booklet-page--measurement"),
	);
	const firstDayPage = dayPages[0];
	if (!firstDayPage && model.days.length > 0) {
		throw new BookletLayoutError(
			"dom-not-ready",
			"日別ページ計測用DOMを準備できませんでした。",
		);
	}
	const content = firstDayPage
		? queryRequired(
				firstDayPage,
				"[data-booklet-measurement-content]",
				"本文領域",
			)
		: queryRequired(root, "[data-booklet-measurement-content]", "本文領域");
	if (dayPages.length !== model.days.length) {
		throw new BookletLayoutError(
			"dom-not-ready",
			"日別ページ計測用DOMの件数が一致しません。",
		);
	}

	return {
		coverVeilBounds,
		pageMeasurement: {
			contentHeight: readContentHeight(content),
			contentWidth: readContentWidth(content),
			coverHeight: coverText.scrollHeight,
			coverWidth: coverText.scrollWidth,
			days: model.days.map((day, dayIndex) => {
				const page = dayPages[dayIndex];
				if (!page) {
					throw new BookletLayoutError(
						"dom-not-ready",
						`Day ${dayIndex + 1}を計測できませんでした。`,
					);
				}
				const headers = page.querySelectorAll<HTMLElement>(
					".booklet-day-header",
				);
				const header = headers[0];
				const continuationHeader = headers[1];
				if (!header || !continuationHeader) {
					throw new BookletLayoutError(
						"dom-not-ready",
						`Day ${dayIndex + 1}のヘッダーを計測できませんでした。`,
					);
				}
				return {
					continuationHeaderHeight: readOuterHeight(
						continuationHeader,
						`Day ${dayIndex + 1}の継続ヘッダー`,
					),
					headerHeight: readOuterHeight(
						header,
						`Day ${dayIndex + 1}のヘッダー`,
					),
					unitHeights: day.units.map((_unit, unitIndex) =>
						readOuterHeight(
							queryRequired(
								page,
								`[data-booklet-measurement-unit="${dayIndex}-${unitIndex}"]`,
								`Day ${dayIndex + 1}のSpot ${unitIndex + 1}`,
							),
							`Day ${dayIndex + 1}のSpot ${unitIndex + 1}`,
						),
					),
				};
			}),
		},
	};
}

function hidesText(style: CSSStyleDeclaration): boolean {
	const unsafeOverflow = new Set(["hidden", "clip", "scroll", "auto"]);
	const lineClamp = (
		style as CSSStyleDeclaration & { webkitLineClamp?: string }
	).webkitLineClamp;
	return (
		unsafeOverflow.has(style.overflow) ||
		unsafeOverflow.has(style.overflowX) ||
		unsafeOverflow.has(style.overflowY) ||
		style.whiteSpace === "nowrap" ||
		(style.textOverflow !== "" && style.textOverflow !== "clip") ||
		(lineClamp !== undefined && lineClamp !== "" && lineClamp !== "none") ||
		style.transform.includes("scale")
	);
}

function ensurePagesFit(
	root: HTMLElement,
	pagePlan: ReturnType<typeof paginateBooklet>,
	theme: ResolvedBookletTheme,
	coverVeilBounds: CoverVeilBounds,
): void {
	const pages = Array.from(
		root.querySelectorAll<HTMLElement>("[data-booklet-page]"),
	);
	if (pages.length !== pagePlan.length) {
		throw new BookletLayoutError(
			"dom-not-ready",
			"印刷ページ数がページ計画と一致しません。",
		);
	}
	if (getCoverLayoutDefinition(theme.coverLayoutId).veil !== "none") {
		const veil = root.querySelector<SVGSVGElement>("svg.booklet-cover__veil");
		const expectedVeilBounds = `${coverVeilBounds.x},${coverVeilBounds.y},${coverVeilBounds.width},${coverVeilBounds.height}`;
		if (!veil || veil.dataset.bookletCoverVeil !== expectedVeilBounds) {
			throw new BookletLayoutError(
				"cover-bounds-invalid",
				"表紙ベールと計測した文字位置が一致しません。",
			);
		}
	}
	for (const page of pages) {
		if (page.dataset.bookletThemeKey !== theme.resolvedThemeKey) {
			throw new BookletLayoutError(
				"dom-not-ready",
				"実ページと計測テーマが一致しません。",
			);
		}
		if (page.scrollWidth > page.clientWidth + LAYOUT_ROUNDING_TOLERANCE_PX) {
			throw new BookletLayoutError(
				"page-inline-overflow",
				"印刷ページが横方向にあふれています。",
			);
		}
		if (page.scrollHeight > page.clientHeight + LAYOUT_ROUNDING_TOLERANCE_PX) {
			throw new BookletLayoutError(
				"page-block-overflow",
				"印刷ページが縦方向にあふれています。",
			);
		}
	}
	for (const text of root.querySelectorAll<HTMLElement>(
		"[data-booklet-text-role]",
	)) {
		if (hidesText(getComputedStyle(text))) {
			throw new BookletLayoutError(
				"hidden-text",
				"文字を隠す表示設定を検出しました。",
			);
		}
		if (text.scrollWidth > text.clientWidth + LAYOUT_ROUNDING_TOLERANCE_PX) {
			throw new BookletLayoutError(
				"text-inline-overflow",
				`${text.dataset.bookletTextRole ?? "文字"}が横方向にあふれています。`,
			);
		}
		if (text.scrollHeight > text.clientHeight + LAYOUT_ROUNDING_TOLERANCE_PX) {
			throw new BookletLayoutError(
				"text-block-overflow",
				`${text.dataset.bookletTextRole ?? "文字"}が縦方向にあふれています。`,
			);
		}
	}
}

function nextFrame(): Promise<void> {
	return new Promise((resolve) => {
		if (typeof requestAnimationFrame === "function") {
			requestAnimationFrame(() => resolve());
			return;
		}
		setTimeout(resolve, 0);
	});
}

export function useBookletPagePlan(
	model: BookletModel | null,
	requestedTheme: RequestedBookletTheme | null,
): BookletPagePlanResult {
	const measurementRef = useRef<HTMLDivElement>(null);
	const documentRef = useRef<HTMLElement>(null);
	const runIdRef = useRef(0);
	const [candidateIndex, setCandidateIndex] = useState(0);
	const [coverVeilBounds, setCoverVeilBounds] =
		useState<CoverVeilBounds | null>(null);
	const [pagePlan, setPagePlan] = useState<ReturnType<
		typeof paginateBooklet
	> | null>(null);
	const [resolvedTheme, setResolvedTheme] =
		useState<ResolvedBookletTheme | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [status, setStatus] = useState<BookletPagePlanStatus>("idle");

	const candidateResult = useMemo(() => {
		if (!requestedTheme) {
			return {
				candidates: [] as readonly BookletThemeCandidate[],
				error: null,
			};
		}
		try {
			return { candidates: getThemeCandidates(requestedTheme), error: null };
		} catch (candidateError) {
			return {
				candidates: [] as readonly BookletThemeCandidate[],
				error: errorMessage(
					candidateError,
					"しおりのデザイン定義を読み込めませんでした。",
				),
			};
		}
	}, [requestedTheme]);

	const candidate = candidateResult.candidates[candidateIndex] ?? null;
	const activeTheme = useMemo(
		() =>
			requestedTheme && candidate
				? resolveBookletTheme(requestedTheme, candidate)
				: null,
		[candidate, requestedTheme],
	);

	useEffect(() => {
		runIdRef.current += 1;
		setCandidateIndex(0);
		setCoverVeilBounds(null);
		setPagePlan(null);
		setResolvedTheme(null);
		setError(candidateResult.error);
		setStatus(
			model && requestedTheme && !candidateResult.error
				? "measuring"
				: candidateResult.error
					? "error"
					: "idle",
		);
	}, [candidateResult.error, model, requestedTheme]);

	useEffect(() => {
		if (!model || !requestedTheme || !activeTheme || candidateResult.error) {
			return;
		}
		const runId = ++runIdRef.current;
		let cancelled = false;
		const run = async () => {
			try {
				setPagePlan(null);
				setCoverVeilBounds(null);
				setResolvedTheme(null);
				setError(null);
				setStatus("measuring");
				await waitForFonts(activeTheme);
				const measurementRoot = measurementRef.current;
				if (!measurementRoot) {
					throw new BookletLayoutError(
						"dom-not-ready",
						"ページ計測用DOMを準備できませんでした。",
					);
				}
				await Promise.all(
					Array.from(measurementRoot.querySelectorAll("img")).map((image) =>
						waitForImageDecode(image),
					),
				);
				const collected = collectMeasurement(
					model,
					measurementRoot,
					activeTheme,
				);
				const measuredPlan = paginateBooklet(model, collected.pageMeasurement);
				if (cancelled || runId !== runIdRef.current) {
					return;
				}
				setCoverVeilBounds(collected.coverVeilBounds);
				setPagePlan(measuredPlan);
				setStatus("checking");
				await nextFrame();
				await nextFrame();
				if (cancelled || runId !== runIdRef.current) {
					return;
				}
				const documentRoot = documentRef.current;
				if (!documentRoot) {
					throw new BookletLayoutError(
						"dom-not-ready",
						"印刷ページDOMを準備できませんでした。",
					);
				}
				ensurePagesFit(
					documentRoot,
					measuredPlan,
					activeTheme,
					collected.coverVeilBounds,
				);
				setResolvedTheme(activeTheme);
				setStatus("ready");
			} catch (runError) {
				if (cancelled || runId !== runIdRef.current) {
					return;
				}
				if (
					isRecoverableLayoutFailure(runError) &&
					candidateIndex + 1 < candidateResult.candidates.length
				) {
					setCandidateIndex(candidateIndex + 1);
					return;
				}
				setPagePlan(null);
				setCoverVeilBounds(null);
				setResolvedTheme(null);
				setError(errorMessage(runError, "印刷前の収まり確認に失敗しました。"));
				setStatus("error");
			}
		};
		void run();
		return () => {
			cancelled = true;
		};
	}, [activeTheme, candidateIndex, candidateResult, model, requestedTheme]);

	return {
		activeTheme,
		coverVeilBounds,
		documentRef,
		error,
		measurementRef,
		pagePlan,
		resolvedTheme,
		status,
	};
}
