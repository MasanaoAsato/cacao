/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	type AssembledPage,
	assemblePages,
} from "../../../booklet/program/assemblePages";
import type {
	AnyScenePlan,
	BookletProgram,
} from "../../../booklet/program/model";
import { testModel } from "../../../theme/composition/compositionTestKit";
import { checkProgramOutput } from "./outputChecks";

const model = testModel({
	days: [
		{
			date: "2026-04-01T00:00:00+09:00",
			dayNumber: 1,
			id: "d1",
			illustration: null,
			units: testModel().days[0]?.units.slice(0, 2) ?? [],
		},
	],
});
const [unitA, unitB] = model.days[0]?.units ?? [];

const PX = 560 / 148;
const rects = new WeakMap<Element, DOMRect>();
const original = Object.getOwnPropertyDescriptor(
	HTMLElement.prototype,
	"getBoundingClientRect",
);

function rectMm(x: number, y: number, w: number, h: number): DOMRect {
	return {
		bottom: (y + h) * PX,
		height: h * PX,
		left: x * PX,
		right: (x + w) * PX,
		top: y * PX,
		width: w * PX,
		x: x * PX,
		y: y * PX,
		toJSON: () => ({}),
	} as DOMRect;
}

function program(effects = true): BookletProgram {
	const scene = (kind: "cover" | "day") => ({
		config: {
			bindings: [],
			compositionId: "folio",
			contentStructure: null,
			heading: {
				directionId: "wa-modern" as const,
				orientation: "horizontal" as const,
				styleBundleId: "quiet" as const,
				system: null,
			},
			imageTreatment: null,
			minimalDecoration: false,
			numberedEntries: false,
			surface: {
				directionId: "wa-modern" as const,
				localePackId: null,
				styleBundleId: "quiet" as const,
				touch: "woodcut" as const,
			},
		},
		effects: effects
			? [
					{
						directionId: "wa-modern" as const,
						kind: "heading" as const,
						minimumHeightMm: 6.35,
						minimumWidthMm: 6.35,
						regionId: "heading",
						sceneId: kind === "cover" ? "cover" : "day:d1",
					},
				]
			: [],
		moduleId: "woodcut-folio" as const,
	});
	return {
		baseDirectionId: "wa-modern",
		catalogRevision: "r",
		scenes: [
			{ ...scene("cover"), kind: "cover", sceneId: "cover" },
			{
				...scene("day"),
				dayId: "d1",
				kind: "day",
				sceneId: "day:d1",
				section: null,
				showIllustration: true,
				unitIds: [unitA?.id ?? "", unitB?.id ?? ""],
			},
		],
		seed: "v2-00000001",
	};
}

function assembled(target: BookletProgram): readonly AssembledPage[] {
	const plans = new Map<string, AnyScenePlan>([
		[
			"cover",
			{
				moduleId: "woodcut-folio",
				pages: [
					{
						compositionId: "folio",
						kind: "cover",
						localPageId: "cover",
						titleSizePt: null,
						unitIds: [],
						unitRefs: [],
					},
				],
				sceneId: "cover",
			},
		],
		[
			"day:d1",
			{
				moduleId: "woodcut-folio",
				pages: [
					{
						columns: [[unitA?.id ?? "", unitB?.id ?? ""]],
						compositionId: "folio",
						firstUnitNumber: 1,
						kind: "first",
						layoutVariant: null,
						localPageId: "p1",
						unitHeightsMm: null,
						unitIds: [unitA?.id ?? "", unitB?.id ?? ""],
						unitRefs: [],
					},
				],
				sceneId: "day:d1",
			},
		],
	]);
	return assemblePages(target, plans);
}

/** Two pages; each has a 128×28mm heading proving the heading claim. */
function drawDocument(
	options: { unitIds?: readonly string[]; artOverText?: boolean } = {},
) {
	const root = document.createElement("main");
	const page = (pageId: string, sceneId: string, units: readonly string[]) => {
		const article = document.createElement("article");
		article.dataset.bookletPage = "true";
		article.dataset.programPage = "true";
		article.dataset.pageId = pageId;
		article.dataset.sceneId = sceneId;
		rects.set(article, rectMm(0, 0, 148, 210));
		const heading = document.createElement("div");
		heading.dataset.directionEffect = "heading/wa-modern:heading";
		rects.set(heading, rectMm(10, 10, 128, 28));
		article.append(heading);
		for (const id of units) {
			const unit = document.createElement("div");
			unit.dataset.unitId = id;
			const name = document.createElement("strong");
			name.dataset.bookletTextRole = "spot-name";
			name.textContent = id;
			rects.set(name, rectMm(10, 100, 100, 6));
			unit.append(name);
			article.append(unit);
		}
		if (options.artOverText && sceneId !== "cover") {
			const slot = document.createElement("div");
			slot.dataset.programRegion = "art-day-art";
			rects.set(slot, rectMm(10, 90, 128, 30));
			const art = document.createElement("span");
			art.dataset.artworkSlot = "day-art";
			rects.set(art, rectMm(10, 95, 40, 20));
			slot.append(art);
			article.append(slot);
		}
		root.append(article);
	};
	page("cover/cover", "cover", []);
	page(
		"day:d1/p1",
		"day:d1",
		options.unitIds ?? [unitA?.id ?? "", unitB?.id ?? ""],
	);
	document.body.append(root);
	return root;
}

describe("checkProgramOutput", () => {
	beforeEach(() => {
		Object.defineProperty(HTMLElement.prototype, "getBoundingClientRect", {
			configurable: true,
			value(this: HTMLElement) {
				return rects.get(this) ?? rectMm(0, 0, 0, 0);
			},
		});
	});
	afterEach(() => {
		document.body.innerHTML = "";
		if (original)
			Object.defineProperty(
				HTMLElement.prototype,
				"getBoundingClientRect",
				original,
			);
	});

	const run = (root: HTMLElement, target = program()) =>
		checkProgramOutput({
			assembled: assembled(target),
			model,
			planned: new Map(),
			program: target,
			root,
		});

	it("正常系: 計画順の頁・全unit一回・寄与の実寸がそろえば通る", () => {
		expect(() => run(drawDocument())).not.toThrow();
	});

	it("異常系: unitの欠落・二重描画はcoverage違反", () => {
		expect(() => run(drawDocument({ unitIds: [unitA?.id ?? ""] }))).toThrow(
			/一回ずつ/,
		);
		document.body.innerHTML = "";
		expect(() =>
			run(
				drawDocument({
					unitIds: [unitA?.id ?? "", unitA?.id ?? "", unitB?.id ?? ""],
				}),
			),
		).toThrow(/一回ずつ/);
	});

	it("異常系: 寄与の要素が下限より小さい・存在しなければ印刷しない", () => {
		const root = drawDocument();
		const heading = root.querySelector<HTMLElement>(
			'[data-page-id="day:d1/p1"] [data-direction-effect]',
		);
		if (!heading) throw new Error("heading");
		rects.set(heading, rectMm(10, 10, 128, 5));
		expect(() => run(root)).toThrow(/heading/);
	});

	it("境界値系: 寄与がなければ寸法検査はなく、頁の順序違いはdom-not-ready", () => {
		const root = drawDocument();
		expect(() => run(root, program(false))).not.toThrow();
		const pages = root.querySelectorAll("[data-booklet-page]");
		const first = pages[0];
		if (first) root.append(first);
		expect(() => run(root)).toThrow(/ページ計画の順/);
	});

	it("異常系: 素材が文字から1mm離れていなければ印刷しない", () => {
		expect(() => run(drawDocument({ artOverText: true }))).toThrow(/1mm/);
	});
});
