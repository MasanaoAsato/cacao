import { useEffect, useMemo, useRef, useState } from "react";
import type { BookletModel } from "../../booklet/model";
import {
	type BookletPageMeasurement,
	isRecoverableBookletFailure,
	paginateBooklet,
	type RecoverableBookletFailureCode,
} from "../../booklet/paginate";
import {
	getThemeCandidates,
	resolveBookletTheme,
} from "../../theme/bookletTheme";
import type {
	BookletThemeCandidate,
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
	readonly documentRef: React.RefObject<HTMLElement | null>;
	readonly error: string | null;
	readonly measurementRef: React.RefObject<HTMLDivElement | null>;
	readonly pagePlan: ReturnType<typeof paginateBooklet> | null;
	readonly resolvedTheme: ResolvedBookletTheme | null;
	readonly status: BookletPagePlanStatus;
};

type LayoutFailureCode =
	| RecoverableBookletFailureCode
	| "dom-not-ready"
	| "hidden-text";

const FONT_SAMPLE_TEXT = "東京の旅程・京都散策";

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

function fontFamiliesFor(theme: BookletThemeCandidate): readonly string[] {
	switch (theme.fontPairId) {
		case "classic":
			return ["Noto Serif JP"];
		case "literary":
			return ["Shippori Mincho", "Noto Sans JP"];
		case "wayfinding":
			return ["Zen Kaku Gothic New", "Noto Sans JP"];
		case "modern":
			return ["Noto Sans JP"];
		case "round-trip":
			return ["M PLUS Rounded 1c", "Noto Sans JP"];
	}
}

async function waitForFonts(theme: BookletThemeCandidate): Promise<void> {
	if (!document.fonts) {
		return;
	}
	await document.fonts.ready;
	for (const family of fontFamiliesFor(theme)) {
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

function ensureCoverTextFits(root: HTMLDivElement): void {
	const text = queryRequired(root, "[data-booklet-cover-text]", "表紙文字領域");
	const panel = root.querySelector<SVGRectElement>(
		".booklet-cover__panel-shape",
	);
	if (!panel) {
		throw new BookletLayoutError(
			"dom-not-ready",
			"表紙文字パネルを準備できませんでした。",
		);
	}
	if (text.scrollWidth > text.clientWidth) {
		throw new BookletLayoutError(
			"cover-inline-overflow",
			"表紙の横方向の文字が収まりません。",
		);
	}
	const textRect = text.getBoundingClientRect();
	const panelRect = panel.getBoundingClientRect();
	if (textRect.left < panelRect.left || textRect.right > panelRect.right) {
		throw new BookletLayoutError(
			"cover-inline-overflow",
			"表紙文字が安全領域をはみ出しました。",
		);
	}
	if (textRect.top < panelRect.top || textRect.bottom > panelRect.bottom) {
		throw new BookletLayoutError(
			"cover-block-overflow",
			"表紙文字が安全領域をはみ出しました。",
		);
	}
}

function collectMeasurement(
	model: BookletModel,
	root: HTMLDivElement,
): BookletPageMeasurement {
	ensureCoverTextFits(root);
	const coverText = queryRequired(
		root,
		"[data-booklet-cover-text]",
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
			const headers = page.querySelectorAll<HTMLElement>(".booklet-day-header");
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
				headerHeight: readOuterHeight(header, `Day ${dayIndex + 1}のヘッダー`),
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
	for (const page of pages) {
		if (page.dataset.bookletThemeKey !== theme.resolvedThemeKey) {
			throw new BookletLayoutError(
				"dom-not-ready",
				"実ページと計測テーマが一致しません。",
			);
		}
		if (page.scrollWidth > page.clientWidth) {
			throw new BookletLayoutError(
				"page-inline-overflow",
				"印刷ページが横方向にあふれています。",
			);
		}
		if (page.scrollHeight > page.clientHeight) {
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
		if (text.scrollWidth > text.clientWidth) {
			throw new BookletLayoutError(
				"text-inline-overflow",
				`${text.dataset.bookletTextRole ?? "文字"}が横方向にあふれています。`,
			);
		}
		if (text.scrollHeight > text.clientHeight) {
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
				const measuredPlan = paginateBooklet(
					model,
					collectMeasurement(model, measurementRoot),
				);
				if (cancelled || runId !== runIdRef.current) {
					return;
				}
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
				ensurePagesFit(documentRoot, measuredPlan, activeTheme);
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
		documentRef,
		error,
		measurementRef,
		pagePlan,
		resolvedTheme,
		status,
	};
}
