import type { BookletModel } from "../../../booklet/model";
import type { AssembledPage } from "../../../booklet/program/assemblePages";
import type { BookletProgram } from "../../../booklet/program/model";
import {
	type RenderedUnitMark,
	renderedCoverageIssues,
} from "../../../booklet/program/validateProgram";
import { artworkPlacementIssue } from "../../../theme/artwork/placement";
import { BookletLayoutError } from "../layoutError";
import { rectMmOf } from "./measureDom";
import type { PlannedScene } from "./moduleRegistry";
import { effectToken } from "./sceneParts";

/** One CSS px of rounding, as in the family checks. */
const LAYOUT_TOLERANCE_PX = 1;
const EFFECT_TOLERANCE_MM = 25.4 / 96;

function hidesText(style: CSSStyleDeclaration): boolean {
	const unsafe = new Set(["hidden", "clip", "scroll", "auto"]);
	const lineClamp = (
		style as CSSStyleDeclaration & { webkitLineClamp?: string }
	).webkitLineClamp;
	return (
		unsafe.has(style.overflow) ||
		unsafe.has(style.overflowX) ||
		unsafe.has(style.overflowY) ||
		style.whiteSpace === "nowrap" ||
		(style.textOverflow !== "" && style.textOverflow !== "clip") ||
		(lineClamp !== undefined && lineClamp !== "" && lineClamp !== "none") ||
		style.transform.includes("scale") ||
		style.visibility === "hidden" ||
		style.display === "none"
	);
}

function checkPages(
	root: HTMLElement,
	assembled: readonly AssembledPage[],
): readonly HTMLElement[] {
	const pages = Array.from(
		root.querySelectorAll<HTMLElement>("[data-booklet-page]"),
	);
	if (
		pages.length !== assembled.length ||
		pages.some(
			(page, index) => page.dataset.pageId !== assembled[index]?.pageId,
		)
	) {
		throw new BookletLayoutError(
			"dom-not-ready",
			"印刷ページがページ計画の順に描かれていません。",
		);
	}
	for (const page of pages) {
		if (page.scrollWidth > page.clientWidth + LAYOUT_TOLERANCE_PX)
			throw new BookletLayoutError(
				"page-inline-overflow",
				`ページ「${page.dataset.pageId}」が横方向にあふれています。`,
			);
		if (page.scrollHeight > page.clientHeight + LAYOUT_TOLERANCE_PX)
			throw new BookletLayoutError(
				"page-block-overflow",
				`ページ「${page.dataset.pageId}」が縦方向にあふれています。`,
			);
		for (const region of page.querySelectorAll<HTMLElement>(
			'[data-program-region="body"], [data-program-region="heading"], [data-program-region="title"], [data-program-region="period"], [data-program-region="memo"]',
		)) {
			if (region.scrollHeight > region.clientHeight + LAYOUT_TOLERANCE_PX)
				throw new BookletLayoutError(
					"text-block-overflow",
					`ページ「${page.dataset.pageId}」の${region.dataset.programRegion}領域から文字があふれています。`,
				);
			if (region.scrollWidth > region.clientWidth + LAYOUT_TOLERANCE_PX)
				throw new BookletLayoutError(
					"text-inline-overflow",
					`ページ「${page.dataset.pageId}」の${region.dataset.programRegion}領域から文字が横にあふれています。`,
				);
		}
	}
	return pages;
}

function checkText(root: HTMLElement): void {
	for (const text of root.querySelectorAll<HTMLElement>(
		"[data-booklet-text-role]",
	)) {
		if (hidesText(getComputedStyle(text)))
			throw new BookletLayoutError(
				"hidden-text",
				`${text.dataset.bookletTextRole ?? "文字"}を隠す表示設定を検出しました。`,
			);
		if (text.scrollWidth > text.clientWidth + LAYOUT_TOLERANCE_PX)
			throw new BookletLayoutError(
				"text-inline-overflow",
				`${text.dataset.bookletTextRole ?? "文字"}が横方向にあふれています。`,
			);
	}
}

export function readUnitMarks(root: HTMLElement): readonly RenderedUnitMark[] {
	return Array.from(
		root.querySelectorAll<HTMLElement>("[data-unit-id], [data-unit-ref]"),
		(element) => {
			const sceneId =
				element.closest<HTMLElement>("[data-scene-id]")?.dataset.sceneId ?? "";
			const owned = element.dataset.unitId;
			return owned !== undefined
				? { kind: "owned" as const, sceneId, unitId: owned }
				: {
						kind: "ref" as const,
						sceneId,
						unitId: element.dataset.unitRef ?? "",
					};
		},
	);
}

/** Every EffectClaim has to exist in the scene's pages at least at its size. */
function checkEffects(
	program: BookletProgram,
	pages: readonly HTMLElement[],
): void {
	for (const scene of program.scenes) {
		const own = pages.filter((page) => page.dataset.sceneId === scene.sceneId);
		for (const effect of scene.effects) {
			const token = effectToken(
				effect.regionId,
				effect.directionId,
				effect.kind,
			);
			const found = own.some((page) =>
				Array.from(
					page.querySelectorAll<HTMLElement>("[data-direction-effect]"),
				).some((element) => {
					if (
						!(element.dataset.directionEffect ?? "").split(" ").includes(token)
					)
						return false;
					const rect = rectMmOf(element, page);
					return (
						rect.widthMm + EFFECT_TOLERANCE_MM >= effect.minimumWidthMm &&
						rect.heightMm + EFFECT_TOLERANCE_MM >= effect.minimumHeightMm
					);
				}),
			);
			if (!found)
				throw new BookletLayoutError(
					"dom-not-ready",
					`方向「${effect.directionId}」の${effect.kind}がscene「${scene.sceneId}」の${effect.regionId}に${effect.minimumWidthMm}×${effect.minimumHeightMm}mm以上で描かれていません。`,
				);
		}
	}
}

/** SVG and WebP artwork keep the same 1mm text guard inside their slot. */
function checkArtwork(pages: readonly HTMLElement[]): void {
	for (const page of pages) {
		const texts = Array.from(
			page.querySelectorAll<HTMLElement>("[data-booklet-text-role]"),
			(element) => ({
				rect: rectMmOf(element, page),
				role: element.dataset.bookletTextRole ?? "文字",
			}),
		);
		for (const asset of page.querySelectorAll<HTMLElement>(
			"[data-artwork-slot]",
		)) {
			const slot = asset.closest<HTMLElement>("[data-program-region]");
			if (!slot)
				throw new BookletLayoutError(
					"dom-not-ready",
					"素材がslotの外に描かれています。",
				);
			const issue = artworkPlacementIssue({
				bounds: rectMmOf(asset, page),
				protectedTexts: texts,
				slotId: asset.dataset.artworkSlot ?? "",
				within: rectMmOf(slot, page),
			});
			if (issue) throw new BookletLayoutError("dom-not-ready", issue);
		}
	}
}

/**
 * The final document is printable only when every scene's pages are drawn
 * in plan order, fit A5 without hidden text, cover every unit exactly once,
 * show every claimed effect at size, and keep artwork clear of text.
 */
export function checkProgramOutput(input: {
	readonly assembled: readonly AssembledPage[];
	readonly model: BookletModel;
	readonly planned: ReadonlyMap<string, PlannedScene>;
	readonly program: BookletProgram;
	readonly root: HTMLElement;
}): void {
	const pages = checkPages(input.root, input.assembled);
	checkText(input.root);
	const coverage = renderedCoverageIssues(
		input.program,
		input.model,
		readUnitMarks(input.root),
	);
	if (coverage.length > 0)
		throw new BookletLayoutError("dom-not-ready", coverage.join(" / "));
	checkEffects(input.program, pages);
	checkArtwork(pages);
	for (const scene of input.program.scenes) {
		input.planned
			.get(scene.sceneId)
			?.validateOutput(
				pages.filter((page) => page.dataset.sceneId === scene.sceneId),
			);
	}
}
