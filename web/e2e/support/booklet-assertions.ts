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

export async function expectSelectedCandidate(page: Page): Promise<void> {
	await expect(page.locator(".booklet-shell")).not.toHaveAttribute(
		"data-booklet-fallback-log",
		/.+/,
	);
}

export async function expectNoHiddenText(page: Page): Promise<void> {
	const problems = await page.locator("[data-booklet-text-role]").evaluateAll(
		(elements, tolerance) =>
			elements.flatMap((element) => {
				const htmlElement = element as HTMLElement;
				const style = getComputedStyle(htmlElement);
				const hidden =
					["hidden", "clip", "scroll", "auto"].includes(style.overflow) ||
					style.whiteSpace === "nowrap" ||
					(style.textOverflow !== "" && style.textOverflow !== "clip") ||
					style.transform.includes("scale");
				return htmlElement.scrollWidth > htmlElement.clientWidth + tolerance ||
					htmlElement.scrollHeight > htmlElement.clientHeight + tolerance ||
					hidden
					? [htmlElement.dataset.bookletTextRole]
					: [];
			}),
		LAYOUT_ROUNDING_TOLERANCE_PX,
	);
	expect(problems).toEqual([]);
}

export async function expectContentInsidePages(page: Page): Promise<void> {
	const outside = await page
		.locator(".booklet-document .booklet-page--day")
		.evaluateAll(
			(pages, tolerance) =>
				pages.flatMap((pageElement) => {
					const pageRect = pageElement.getBoundingClientRect();
					const content = pageElement.querySelector(".booklet-page__content");
					if (!content) {
						return ["missing-content"];
					}
					const rect = content.getBoundingClientRect();
					return rect.left < pageRect.left - tolerance ||
						rect.top < pageRect.top - tolerance ||
						rect.right > pageRect.right + tolerance ||
						rect.bottom > pageRect.bottom + tolerance ||
						pageElement.scrollHeight > pageElement.clientHeight + tolerance ||
						pageElement.scrollWidth > pageElement.clientWidth + tolerance
						? [pageElement.getAttribute("data-page-id") ?? "page"]
						: [];
				}),
			LAYOUT_ROUNDING_TOLERANCE_PX,
		);
	expect(outside).toEqual([]);
}
