import type { AtlasGridPagePlan } from "../../../booklet/families/atlasGrid";
import type { PaperCollagePagePlan } from "../../../booklet/families/paperCollage";
import type { PlayfulRoutePagePlan } from "../../../booklet/families/playfulRoute";
import type {
	BookletRenderPagePlan,
	ResolvedBookletDesign,
} from "../../../booklet/family";
import type { BookletModel } from "../../../booklet/model";
import { PAGE_WIDTH_MM } from "../../../theme/decorGeometry";
import {
	type DecorAnchor,
	type DecorAnchorKind,
	DecorPlacementError,
	type FamilyDecoration,
	formatDecorBounds,
	type ProtectedTextRect,
	type RectMm,
	type ResolvedFamilyDecor,
	resolveFamilyDecor,
} from "../../../theme/families/decorPlacement";
import { motifAssetsFor } from "../../../theme/motifAssets";
import {
	BookletLayoutError,
	type BookletPagePlanResult,
} from "../useBookletPagePlan";
import { useAtlasGridPagePlan } from "./AtlasGrid";
import { useLegacyFamilyPagePlan } from "./LegacyBookletRenderer";
import { usePaperCollagePagePlan } from "./PaperCollage";
import { usePlayfulRoutePagePlan } from "./PlayfulRoute";

export type FamilyPagePlanResult = Omit<BookletPagePlanResult, "pagePlan"> & {
	readonly design: ResolvedBookletDesign | null;
	readonly pagePlan:
		| BookletPagePlanResult["pagePlan"]
		| readonly AtlasGridPagePlan[]
		| readonly PaperCollagePagePlan[]
		| readonly PlayfulRoutePagePlan[];
	readonly renderPagePlan: BookletRenderPagePlan | null;
};

const DECOR_ANCHOR_KINDS: readonly DecorAnchorKind[] = [
	"title",
	"illustration",
	"section",
	"unit",
];

function rectMmOf(element: Element, pageRect: DOMRect, scale: number): RectMm {
	const rect = element.getBoundingClientRect();
	return {
		heightMm: rect.height * scale,
		widthMm: rect.width * scale,
		xMm: (rect.left - pageRect.left) * scale,
		yMm: (rect.top - pageRect.top) * scale,
	};
}

/** mm per px on a page element, taken from its real width and 148mm. */
function pageScale(pageElement: HTMLElement): number {
	const pageRect = pageElement.getBoundingClientRect();
	if (!Number.isFinite(pageRect.width) || pageRect.width <= 0) {
		throw new BookletLayoutError(
			"dom-not-ready",
			"装飾を配置するページの幅を計測できませんでした。",
		);
	}
	return PAGE_WIDTH_MM / pageRect.width;
}

/**
 * Anchors a family page publishes for decor, read after the composition has
 * reserved their space. The rect is in mm from the page's top-left corner.
 */
export function readDecorAnchors(
	pageElement: HTMLElement,
): readonly DecorAnchor[] {
	const pageRect = pageElement.getBoundingClientRect();
	const scale = pageScale(pageElement);
	return Array.from(
		pageElement.querySelectorAll<HTMLElement>("[data-booklet-anchor]"),
		(element) => {
			const id = element.dataset.bookletAnchor ?? "";
			const kind = element.dataset.bookletAnchorKind ?? "";
			if (id === "" || !DECOR_ANCHOR_KINDS.includes(kind as DecorAnchorKind)) {
				throw new DecorPlacementError(
					"decor-definition-invalid",
					`装飾の基準「${id || "(ID未指定)"}」の種類「${kind}」が不正です。`,
				);
			}
			const reserve = element.dataset.bookletAnchorReserve;
			return {
				id,
				kind: kind as DecorAnchorKind,
				rect: rectMmOf(element, pageRect, scale),
				reserveMm: reserve === undefined ? 0 : Number(reserve),
			};
		},
	);
}

/** Printed text rects decor must clear, from the shared text-role attribute. */
export function readProtectedTextRects(
	pageElement: HTMLElement,
): readonly ProtectedTextRect[] {
	const pageRect = pageElement.getBoundingClientRect();
	const scale = pageScale(pageElement);
	return Array.from(
		pageElement.querySelectorAll<HTMLElement>("[data-booklet-text-role]"),
		(element) => ({
			rect: rectMmOf(element, pageRect, scale),
			role: element.dataset.bookletTextRole ?? "文字",
		}),
	);
}

export type FamilyDecorPage = {
	readonly decor: ResolvedFamilyDecor;
	readonly pageId: string;
};

const DECOR_BOUNDS_TOLERANCE_MM = 0.05;

function decorBoundsMatch(actual: string | null, expected: string): boolean {
	if (actual === null) {
		return false;
	}
	const actualValues = actual.split(",").map(Number);
	const expectedValues = expected.split(",").map(Number);
	return (
		actualValues.length === expectedValues.length &&
		actualValues.every((value, index) => {
			const expectedValue = expectedValues[index];
			return (
				expectedValue !== undefined &&
				Number.isFinite(value) &&
				Math.abs(value - expectedValue) <= DECOR_BOUNDS_TOLERANCE_MM
			);
		})
	);
}

/**
 * Reads every page's anchors and text rects, resolves the family's decor
 * against them, and confirms the drawn layers match. Placement failures are
 * raised so the family's readiness turns to `error` instead of printing a page
 * whose decor was silently dropped (20.6).
 */
export function prepareFamilyDecor(
	documentRoot: HTMLElement,
	design: ResolvedBookletDesign,
	decorationsByPage: ReadonlyMap<string, readonly FamilyDecoration[]>,
): readonly FamilyDecorPage[] {
	const assets = motifAssetsFor(design.decorAssetIds);
	const pages: FamilyDecorPage[] = [];
	for (const pageElement of documentRoot.querySelectorAll<HTMLElement>(
		"[data-booklet-page]",
	)) {
		const pageId = pageElement.dataset.pageId;
		if (pageId === undefined) {
			throw new BookletLayoutError(
				"dom-not-ready",
				"印刷ページのIDを読み取れませんでした。",
			);
		}
		const decorations = decorationsByPage.get(pageId) ?? [];
		const decor = resolveFamilyDecor({
			anchors: readDecorAnchors(pageElement),
			assets,
			decorations,
			familyId: design.familyId,
			pageId,
			protectedTexts: readProtectedTextRects(pageElement),
			seedToken: design.seedToken,
		});
		ensureDecorDrawn(pageElement, pageId, decor);
		pages.push({ decor, pageId });
	}
	// Decor named for a page that is not in the document would otherwise be
	// dropped without a trace, which is the one outcome this module forbids.
	const drawnPageIds = new Set(pages.map((page) => page.pageId));
	for (const pageId of decorationsByPage.keys()) {
		if (!drawnPageIds.has(pageId)) {
			throw new BookletLayoutError(
				"dom-not-ready",
				`装飾を指定したページ「${pageId}」が紙面にありません。`,
			);
		}
	}
	return pages;
}

/** Every resolved shape has to exist in the page with the bounds we validated. */
function ensureDecorDrawn(
	pageElement: HTMLElement,
	pageId: string,
	decor: ResolvedFamilyDecor,
): void {
	const drawn = Array.from(
		pageElement.querySelectorAll<Element>("[data-booklet-decor-bounds]"),
		(element) => ({
			bounds: element.getAttribute("data-booklet-decor-bounds"),
			layer:
				element
					.closest("[data-booklet-decor-layer]")
					?.getAttribute("data-booklet-decor-layer") ?? null,
		}),
	);
	if (drawn.length !== decor.items.length) {
		throw new BookletLayoutError(
			"dom-not-ready",
			`ページ「${pageId}」の装飾の描画数が配置と一致しません。`,
		);
	}
	for (const item of decor.items) {
		const bounds = formatDecorBounds(
			item.kind === "frame" ? item.rectMm : item.boundsMm,
		);
		const index = drawn.findIndex(
			(candidate) =>
				decorBoundsMatch(candidate.bounds, bounds) &&
				candidate.layer === item.layer,
		);
		if (index === -1) {
			throw new BookletLayoutError(
				"dom-not-ready",
				`ページ「${pageId}」の装飾「${bounds}」が${item.layer}に描かれていません。`,
			);
		}
		drawn.splice(index, 1);
	}
}

export function isCurrentFamilyPagePlan(
	result: Pick<FamilyPagePlanResult, "preparedModel" | "preparedRenderKey">,
	model: BookletModel | null,
	design: ResolvedBookletDesign | null,
): boolean {
	return (
		model !== null &&
		design !== null &&
		result.preparedModel === model &&
		result.preparedRenderKey === design.renderKey
	);
}

/**
 * Runs each registered family hook in a stable order, then selects the result.
 * React hooks cannot be selected dynamically when a request changes family.
 */
export function useFamilyPagePlan(
	model: BookletModel | null,
	design: ResolvedBookletDesign | null,
): FamilyPagePlanResult {
	const legacyResult = useLegacyFamilyPagePlan(model, design);
	const atlasGridResult = useAtlasGridPagePlan(model, design);
	const paperCollageResult = usePaperCollagePagePlan(model, design);
	const playfulRouteResult = usePlayfulRoutePagePlan(model, design);
	if (design?.familyId === "atlas-grid") {
		return atlasGridResult;
	}
	if (design?.familyId === "paper-collage") {
		return paperCollageResult;
	}
	return design?.familyId === "playful-route"
		? playfulRouteResult
		: legacyResult;
}
