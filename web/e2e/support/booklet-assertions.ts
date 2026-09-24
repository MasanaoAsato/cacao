import { expect, type Page } from "@playwright/test";

export const LAYOUT_ROUNDING_TOLERANCE_PX = 1;

export function seedToken(seed: number): string {
	return `v2-${seed.toString(16).padStart(8, "0")}`;
}

export async function expectBookletPrintReady(page: Page): Promise<void> {
	await expect(page.locator(".booklet-shell")).toHaveAttribute(
		"data-booklet-print-state",
		"ready",
	);
}

/** No printed text is clipped, cut with an ellipsis, forced to one line or scaled. */
export async function expectNoHiddenText(page: Page): Promise<void> {
	const problems = await page
		.locator(".booklet-document [data-booklet-text-role]")
		.evaluateAll(
			(elements, tolerance) =>
				elements.flatMap((element) => {
					const htmlElement = element as HTMLElement;
					const style = getComputedStyle(htmlElement);
					const hidden =
						["hidden", "clip", "scroll", "auto"].includes(style.overflow) ||
						style.whiteSpace === "nowrap" ||
						(style.textOverflow !== "" && style.textOverflow !== "clip") ||
						style.transform.includes("scale");
					return htmlElement.scrollWidth >
						htmlElement.clientWidth + tolerance ||
						htmlElement.scrollHeight > htmlElement.clientHeight + tolerance ||
						hidden
						? [
								`${htmlElement.dataset.bookletTextRole}: scroll=${htmlElement.scrollWidth}x${htmlElement.scrollHeight} client=${htmlElement.clientWidth}x${htmlElement.clientHeight} overflow=${style.overflow}/${style.overflowX}/${style.overflowY} white-space=${style.whiteSpace} text-overflow=${style.textOverflow} transform=${style.transform}`,
							]
						: [];
				}),
			LAYOUT_ROUNDING_TOLERANCE_PX,
		);
	expect(problems).toEqual([]);
}

/**
 * Every printed page keeps its box (no scroll overflow) and every text
 * element inside it stays within the A5 page.
 */
export async function expectContentInsidePages(page: Page): Promise<void> {
	const outside = await page
		.locator(".booklet-document [data-booklet-page]")
		.evaluateAll(
			(pages, tolerance) =>
				pages.flatMap((pageElement) => {
					const pageId = pageElement.getAttribute("data-page-id") ?? "page";
					const pageRect = pageElement.getBoundingClientRect();
					const problems =
						pageElement.scrollHeight > pageElement.clientHeight + tolerance ||
						pageElement.scrollWidth > pageElement.clientWidth + tolerance
							? [`${pageId}: page overflow`]
							: [];
					for (const text of pageElement.querySelectorAll<HTMLElement>(
						"[data-booklet-text-role]",
					)) {
						const rect = text.getBoundingClientRect();
						if (
							rect.left < pageRect.left - tolerance ||
							rect.top < pageRect.top - tolerance ||
							rect.right > pageRect.right + tolerance ||
							rect.bottom > pageRect.bottom + tolerance
						)
							problems.push(`${pageId}: ${text.dataset.bookletTextRole}`);
					}
					return problems;
				}),
			LAYOUT_ROUNDING_TOLERANCE_PX,
		);
	expect(outside).toEqual([]);
}

/** Drawn artwork never covers printed text on the same page. */
export async function expectArtworkClearOfText(page: Page): Promise<void> {
	const collisions = await page
		.locator(".booklet-document [data-booklet-page]")
		.evaluateAll(
			(pages, tolerance) =>
				pages.flatMap((pageElement) => {
					const pageId = pageElement.getAttribute("data-page-id") ?? "page";
					const texts = Array.from(
						pageElement.querySelectorAll<HTMLElement>(
							"[data-booklet-text-role]",
						),
						(text) => ({
							rect: text.getBoundingClientRect(),
							role: text.dataset.bookletTextRole ?? "text",
						}),
					).filter(({ rect }) => rect.width > 0 && rect.height > 0);
					return Array.from(
						pageElement.querySelectorAll(".program-art__asset"),
						(art) => art.getBoundingClientRect(),
					).flatMap((art) =>
						texts
							.filter(
								({ rect }) =>
									rect.left < art.right - tolerance &&
									art.left < rect.right - tolerance &&
									rect.top < art.bottom - tolerance &&
									art.top < rect.bottom - tolerance,
							)
							.map(({ role }) => `${pageId}: artwork over ${role}`),
					);
				}),
			LAYOUT_ROUNDING_TOLERANCE_PX,
		);
	expect(collisions).toEqual([]);
}
