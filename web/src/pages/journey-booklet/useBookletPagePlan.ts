import { useEffect, useRef, useState } from "react";
import type { BookletModel } from "../../booklet/model";
import {
	type BookletPageMeasurement,
	paginateBooklet,
} from "../../booklet/paginate";

export type BookletPagePlanStatus =
	| "idle"
	| "measuring"
	| "checking"
	| "ready"
	| "error";

export type BookletPagePlanResult = {
	readonly documentRef: React.RefObject<HTMLElement | null>;
	readonly error: string | null;
	readonly measurementRef: React.RefObject<HTMLDivElement | null>;
	readonly pagePlan: ReturnType<typeof paginateBooklet> | null;
	readonly status: BookletPagePlanStatus;
};

function errorMessage(error: unknown, fallback: string): string {
	return error instanceof Error ? error.message : fallback;
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

	if (image.complete) {
		if (image.naturalWidth > 0) {
			return;
		}

		throw new Error(`画像「${image.alt}」の読み込みに失敗しました。`);
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

async function waitForFonts(): Promise<void> {
	if (!document.fonts) {
		return;
	}

	await document.fonts.ready;
	if (
		!document.fonts.check('400 16px "Noto Serif JP"') ||
		!document.fonts.check('700 16px "Noto Serif JP"')
	) {
		throw new Error("Noto Serif JP の読み込みを確認できませんでした。");
	}
}

function readNaturalHeight(element: HTMLElement, name: string): number {
	const height = Math.max(
		element.getBoundingClientRect().height,
		element.offsetHeight,
		element.scrollHeight,
	);
	if (!Number.isFinite(height) || height <= 0) {
		throw new Error(`${name}の高さを計測できませんでした。`);
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
		throw new Error("A5ページの本文高さを計測できませんでした。");
	}

	return height;
}

function queryRequired(
	root: ParentNode,
	selector: string,
	name: string,
): HTMLElement {
	const element = root.querySelector<HTMLElement>(selector);
	if (!element) {
		throw new Error(`${name}を準備できませんでした。`);
	}

	return element;
}

function collectMeasurement(
	model: BookletModel,
	root: HTMLDivElement,
): BookletPageMeasurement {
	const contentElements = root.querySelectorAll<HTMLElement>(
		"[data-booklet-measurement-content]",
	);
	const contentElement = contentElements[0];
	if (!contentElement) {
		throw new Error("ページ計測用の本文を準備できませんでした。");
	}

	const days = model.days.map((day, dayIndex) => {
		const dayRoot = root.querySelector<HTMLElement>(
			`.booklet-page--measurement:nth-of-type(${dayIndex + 2})`,
		);
		if (!dayRoot) {
			throw new Error(
				`Day ${dayIndex + 1}の計測ページを準備できませんでした。`,
			);
		}

		const headers = dayRoot.querySelectorAll<HTMLElement>(
			".booklet-day-header",
		);
		if (headers.length < 2) {
			throw new Error(`Day ${dayIndex + 1}のヘッダーを計測できませんでした。`);
		}

		const unitHeights = day.units.map((_, unitIndex) => {
			const unit = queryRequired(
				dayRoot,
				`[data-booklet-measurement-unit="${dayIndex}-${unitIndex}"]`,
				`Day ${dayIndex + 1}のSpot ${unitIndex + 1}`,
			);
			return readOuterHeight(
				unit,
				`Day ${dayIndex + 1}のSpot ${unitIndex + 1}`,
			);
		});

		return {
			continuationHeaderHeight: readOuterHeight(
				headers[1],
				`Day ${dayIndex + 1}の継続ヘッダー`,
			),
			headerHeight: readOuterHeight(
				headers[0],
				`Day ${dayIndex + 1}のヘッダー`,
			),
			unitHeights,
		};
	});

	const coverBody = queryRequired(
		root,
		"[data-booklet-measurement-cover-body]",
		"表紙",
	);

	return {
		contentHeight: readContentHeight(contentElement),
		coverHeight: readNaturalHeight(coverBody, "表紙"),
		days,
	};
}

function ensurePagesFit(root: HTMLElement): void {
	const pages = Array.from(
		root.querySelectorAll<HTMLElement>("[data-booklet-page]"),
	);
	const overflowingPageIndex = pages.findIndex(
		(page) =>
			page.scrollHeight > page.clientHeight ||
			page.scrollWidth > page.clientWidth,
	);
	if (overflowingPageIndex !== -1) {
		throw new Error(
			`${overflowingPageIndex + 1}ページ目の内容がA5ページに収まりません。`,
		);
	}
}

export function useBookletPagePlan(
	model: BookletModel | null,
): BookletPagePlanResult {
	const measurementRef = useRef<HTMLDivElement>(null);
	const documentRef = useRef<HTMLElement>(null);
	const runIdRef = useRef(0);
	const [state, setState] = useState<{
		readonly error: string | null;
		readonly pagePlan: ReturnType<typeof paginateBooklet> | null;
		readonly status: BookletPagePlanStatus;
	}>({ error: null, pagePlan: null, status: "idle" });

	useEffect(() => {
		const runId = runIdRef.current + 1;
		runIdRef.current = runId;
		if (!model) {
			setState({ error: null, pagePlan: null, status: "idle" });
			return;
		}

		let cancelled = false;
		setState({ error: null, pagePlan: null, status: "measuring" });

		const runMeasurement = async () => {
			try {
				const root = measurementRef.current;
				if (!root) {
					throw new Error("ページ計測用DOMを準備できませんでした。");
				}

				await Promise.all(
					Array.from(root.querySelectorAll<HTMLImageElement>("img")).map(
						waitForImageDecode,
					),
				);
				await waitForFonts();
				if (cancelled || runId !== runIdRef.current) {
					return;
				}

				const pagePlan = paginateBooklet(
					model,
					collectMeasurement(model, root),
				);
				setState({ error: null, pagePlan, status: "checking" });
			} catch (error) {
				if (!cancelled && runId === runIdRef.current) {
					setState({
						error: errorMessage(error, "印刷前の計測に失敗しました。"),
						pagePlan: null,
						status: "error",
					});
				}
			}
		};

		void runMeasurement();
		return () => {
			cancelled = true;
		};
	}, [model]);

	useEffect(() => {
		if (state.status !== "checking" || !state.pagePlan) {
			return;
		}

		let cancelled = false;
		const timer = window.setTimeout(() => {
			try {
				const root = documentRef.current;
				if (!root) {
					throw new Error("印刷ページを準備できませんでした。");
				}
				const pages = root.querySelectorAll("[data-booklet-page]");
				if (pages.length !== state.pagePlan?.length) {
					throw new Error("印刷ページの描画が完了しませんでした。");
				}
				ensurePagesFit(root);
				if (!cancelled) {
					setState((current) =>
						current.pagePlan === state.pagePlan
							? { ...current, status: "ready" }
							: current,
					);
				}
			} catch (error) {
				if (!cancelled) {
					setState((current) =>
						current.pagePlan === state.pagePlan
							? {
									...current,
									error: errorMessage(
										error,
										"印刷ページの検査に失敗しました。",
									),
									status: "error",
								}
							: current,
					);
				}
			}
		}, 0);

		return () => {
			cancelled = true;
			window.clearTimeout(timer);
		};
	}, [state.pagePlan, state.status]);

	return {
		documentRef,
		error: state.error,
		measurementRef,
		pagePlan: state.pagePlan,
		status: state.status,
	};
}
