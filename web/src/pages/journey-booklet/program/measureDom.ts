import type { TitleMeasurement } from "../../../booklet/program/model";
import type { RectMm } from "../../../theme/artwork/placement";
import { PAGE_WIDTH_MM } from "../../../theme/decorGeometry";
import { BookletLayoutError } from "../layoutError";
import type { FontRequirement } from "./sceneStyle";

/** mm per CSS px of a 148mm page element, read from its real width. */
export function pageScaleOf(pageElement: Element): number {
	const width = pageElement.getBoundingClientRect().width;
	if (!Number.isFinite(width) || width <= 0) {
		throw new BookletLayoutError(
			"dom-not-ready",
			"ページの幅を計測できませんでした。",
		);
	}
	return PAGE_WIDTH_MM / width;
}

export function requireElement(
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

export function closestPage(element: Element): HTMLElement {
	const page = element.closest<HTMLElement>("[data-program-page]");
	if (!page) {
		throw new BookletLayoutError(
			"dom-not-ready",
			"計測対象のページがありません。",
		);
	}
	return page;
}

/** Rect in mm from the owning page's top-left corner. */
export function rectMmOf(
	element: Element,
	page = closestPage(element),
): RectMm {
	const scale = pageScaleOf(page);
	const pageRect = page.getBoundingClientRect();
	const rect = element.getBoundingClientRect();
	return {
		heightMm: rect.height * scale,
		widthMm: rect.width * scale,
		xMm: (rect.left - pageRect.left) * scale,
		yMm: (rect.top - pageRect.top) * scale,
	};
}

/** Rendered block height in mm, including scroll overflow of the block itself. */
export function heightMmOf(element: HTMLElement): number {
	const scale = pageScaleOf(closestPage(element));
	const px = Math.max(
		element.getBoundingClientRect().height,
		element.offsetHeight,
		element.scrollHeight,
	);
	return px * scale;
}

/**
 * A reserved region and the text inside it. The content may grow past the
 * region (overflow is visible in measurement), which the paginator rejects.
 */
export function titleMeasurementOf(
	region: HTMLElement,
	content: HTMLElement,
): TitleMeasurement {
	// The same reference as the final output check: the region's inner box
	// against everything drawn in it, including glyphs that spill out of the
	// text's own line box (which the text check reports on its own).
	const scale = pageScaleOf(closestPage(region));
	const ownOverflowWidth = Math.max(
		0,
		content.scrollWidth - content.clientWidth,
	);
	const ownOverflowHeight = Math.max(
		0,
		content.scrollHeight - content.clientHeight,
	);
	return {
		contentHeightMm:
			Math.max(region.scrollHeight, region.clientHeight + ownOverflowHeight) *
			scale,
		contentWidthMm:
			Math.max(region.scrollWidth, region.clientWidth + ownOverflowWidth) *
			scale,
		reservedHeightMm: region.clientHeight * scale,
		reservedWidthMm: region.clientWidth * scale,
	};
}

/**
 * Loads exactly the fonts and weights the scene uses, with the scene's own
 * characters. `document.fonts.ready` alone does not prove a face was used.
 */
export async function waitForSceneFonts(
	fonts: readonly FontRequirement[],
	sampleText: string,
): Promise<void> {
	if (!document.fonts) return;
	await document.fonts.ready;
	const text = sampleText.trim() === "" ? "旅のしおり" : sampleText;
	for (const font of fonts) {
		const descriptor = `${font.weight} 10pt "${font.family}"`;
		await document.fonts.load(descriptor, text);
		if (!document.fonts.check(descriptor, text)) {
			throw new Error(
				`${font.family} ${font.weight} の読み込みを確認できませんでした。`,
			);
		}
	}
}

/** Distinct characters of a subtree, so the font check covers what is drawn. */
export function sampleTextOf(root: HTMLElement): string {
	return [...new Set(Array.from(root.textContent ?? ""))]
		.filter((character) => character.trim() !== "")
		.join("")
		.slice(0, 512);
}

/** Every itinerary image of the subtree; a used image that fails is an error. */
export async function waitForImages(root: ParentNode): Promise<void> {
	await Promise.all(
		Array.from(root.querySelectorAll<HTMLImageElement>("img")).map(
			async (image) => {
				if (typeof image.decode !== "function") return;
				try {
					await image.decode();
				} catch {
					throw new Error(`画像「${image.alt}」の読み込みに失敗しました。`);
				}
			},
		),
	);
}

export function nextFrame(): Promise<void> {
	return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}
