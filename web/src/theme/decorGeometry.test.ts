import { describe, expect, it } from "vitest";
import { DECORS } from "./bookletTheme";
import {
	decorContentInset,
	MIN_PAGE_MARGIN_MM,
	maximumRotatedDimensions,
	PAGE_HEIGHT_MM,
	PAGE_WIDTH_MM,
	panelRect,
	patternCoverage,
	resolveMotifPlacements,
} from "./decorGeometry";
import { MOTIFS } from "./motifs";
import type { DecorDefinition } from "./types";

function decor(id: DecorDefinition["id"]): DecorDefinition {
	const definition = DECORS.get(id);
	if (!definition) {
		throw new Error(`装飾「${id}」の定義がありません。`);
	}
	return definition;
}

const ZERO = { bottom: 0, left: 0, right: 0, top: 0 };

describe("装飾セットの幾何", () => {
	it("正常系: 17.4の7値は元の内側余白を導く", () => {
		expect(decorContentInset(decor("hairline-frame"), MOTIFS)).toEqual(ZERO);
		expect(decorContentInset(decor("dashed-ticket"), MOTIFS)).toEqual(ZERO);
		expect(decorContentInset(decor("dotted-grid"), MOTIFS)).toEqual(ZERO);
		expect(decorContentInset(decor("stripe-band"), MOTIFS)).toEqual({
			...ZERO,
			top: 6,
		});
		expect(decorContentInset(decor("route-dash"), MOTIFS)).toEqual(ZERO);
		expect(decorContentInset(decor("gallery-rule"), MOTIFS)).toEqual(ZERO);
		expect(decorContentInset(decor("none"), MOTIFS)).toEqual(ZERO);
	});

	it("正常系: 額縁・パネル・四隅の図形から各辺の内側余白を導く", () => {
		expect(decorContentInset(decor("bold-frame"), MOTIFS)).toEqual(ZERO);
		expect(decorContentInset(decor("photo-wash"), MOTIFS)).toEqual({
			bottom: 1,
			left: 1,
			right: 1,
			top: 1,
		});
		const confettiInset = decorContentInset(decor("confetti-corners"), MOTIFS);
		expect(confettiInset).toEqual({
			bottom: expect.closeTo(3.0710678118654755),
			left: expect.closeTo(2.8301270189221928),
			right: expect.closeTo(3.0710678118654755),
			top: expect.closeTo(2.4085638205578856),
		});
		expect(decorContentInset(decor("sheet-on-dots"), MOTIFS)).toEqual(ZERO);
	});

	it("正常系: パネルがあれば本文端に寄せた図形は内側余白に寄与しない", () => {
		const withPanel: DecorDefinition = {
			...decor("wave-margins"),
			motifs: decor("wave-margins").motifs.map((placement) => ({
				...placement,
				sizeMm: [14, 14],
			})),
			panel: { insetMm: 6, kind: "sheet", opacity: 0.94, radiusMm: 2 },
		};
		expect(decorContentInset(withPanel, MOTIFS)).toEqual(ZERO);
		expect(
			decorContentInset({ ...withPanel, panel: { kind: "none" } }, MOTIFS),
		).toEqual({ ...ZERO, bottom: 4, top: 4 });
	});

	it("正常系: 回転範囲の途中にある最大外接矩形を内側余白に使う", () => {
		const dimensions = maximumRotatedDimensions((4 / 196) * 30, 30, [45, 45]);
		expect(dimensions.widthMm).toBeCloseTo(21.646, 3);
		expect(dimensions.heightMm).toBeCloseTo(21.646, 3);

		const routeDash = decor("route-dash");
		const placement = routeDash.motifs[0];
		if (!placement) {
			throw new Error("route-dashの図形がありません。");
		}
		const rotatedRail: DecorDefinition = {
			...routeDash,
			motifs: [{ ...placement, rotateDeg: [45, 45], sizeMm: [30, 30] }],
		};
		expect(decorContentInset(rotatedRail, MOTIFS).left).toBeCloseTo(
			dimensions.widthMm - 4,
			3,
		);
	});

	it("正常系: 回転した本文端の帯も外接矩形の端で本文に接する", () => {
		const topBand = decor("wave-margins").motifs[0];
		if (!topBand) {
			throw new Error("wave-marginsの上帯がありません。");
		}
		const rotatedBand: DecorDefinition = {
			...decor("wave-margins"),
			motifs: [{ ...topBand, count: 1, rotateDeg: [45, 45], sizeMm: [4, 4] }],
		};
		const contentInset = decorContentInset(rotatedBand, MOTIFS);
		const [resolved] = resolveMotifPlacements(
			rotatedBand,
			MOTIFS,
			{ contentInset, pageMarginMm: MIN_PAGE_MARGIN_MM },
			"v2-00000000",
		);
		expect(
			resolved?.boundsMm.yMm + (resolved?.boundsMm.heightMm ?? 0),
		).toBeCloseTo(MIN_PAGE_MARGIN_MM + contentInset.top, 6);
	});

	it("正常系: 同じシードなら同じ配置になり、シードが違えば大きさと回転が変わる", () => {
		const geometry = { contentInset: ZERO, pageMarginMm: 12 };
		const first = resolveMotifPlacements(
			decor("confetti-corners"),
			MOTIFS,
			geometry,
			"v2-00000001",
		);
		const again = resolveMotifPlacements(
			decor("confetti-corners"),
			MOTIFS,
			geometry,
			"v2-00000001",
		);
		const other = resolveMotifPlacements(
			decor("confetti-corners"),
			MOTIFS,
			geometry,
			"v2-00000002",
		);
		expect(first).toEqual(again);
		expect(first).toHaveLength(4);
		expect(
			first.some(
				(motif, index) =>
					motif.heightMm !== other[index]?.heightMm ||
					motif.rotateDeg !== other[index]?.rotateDeg,
			),
		).toBe(true);
		for (const motif of first) {
			expect(motif.heightMm).toBeGreaterThanOrEqual(3);
			expect(motif.heightMm).toBeLessThanOrEqual(5);
		}
	});

	it("正常系: パネルのない装飾の図形は全密度で本文領域と交差しない", () => {
		for (const definition of DECORS.values()) {
			if (definition.panel.kind !== "none") {
				continue;
			}
			const contentInset = decorContentInset(definition, MOTIFS);
			for (const pageMarginMm of [MIN_PAGE_MARGIN_MM, 12, 14]) {
				const content = {
					bottom: PAGE_HEIGHT_MM - pageMarginMm - contentInset.bottom,
					left: pageMarginMm + contentInset.left,
					right: PAGE_WIDTH_MM - pageMarginMm - contentInset.right,
					top: pageMarginMm + contentInset.top,
				};
				for (const seedToken of ["v2-00000000", "v2-0000abcd"]) {
					for (const motif of resolveMotifPlacements(
						definition,
						MOTIFS,
						{ contentInset, pageMarginMm },
						seedToken,
					)) {
						const bounds = motif.boundsMm;
						const overlaps =
							bounds.xMm < content.right - 1e-6 &&
							bounds.xMm + bounds.widthMm > content.left + 1e-6 &&
							bounds.yMm < content.bottom - 1e-6 &&
							bounds.yMm + bounds.heightMm > content.top + 1e-6;
						expect(
							overlaps,
							`${definition.id} ${motif.slot} 余白${pageMarginMm}`,
						).toBe(false);
					}
				}
			}
		}
	});

	it("正常系: 旧route-dashとgallery-ruleの位置を再現する", () => {
		const geometry = { contentInset: ZERO, pageMarginMm: 12 };
		const [rail] = resolveMotifPlacements(
			decor("route-dash"),
			MOTIFS,
			geometry,
			"v2-00000000",
		);
		expect(rail?.heightMm).toBeCloseTo(196, 6);
		expect(rail?.widthMm).toBeCloseTo(4, 6);
		expect(rail?.xMm).toBeCloseTo(4, 6);
		expect(rail?.yMm).toBeCloseTo(7, 6);
		const [rule] = resolveMotifPlacements(
			decor("gallery-rule"),
			MOTIFS,
			geometry,
			"v2-00000000",
		);
		expect(rule?.heightMm).toBeCloseTo(3, 6);
		expect(rule?.widthMm).toBeCloseTo(128, 6);
		expect(rule?.xMm).toBeCloseTo(10, 6);
		expect(rule?.yMm).toBeCloseTo(198, 6);
	});

	it("正常系: パネルの矩形と柄の被覆率を定義から求める", () => {
		expect(panelRect(decor("sheet-on-dots"))).toEqual({
			heightMm: 198,
			opacity: 0.94,
			radiusMm: 2,
			widthMm: 136,
			xMm: 6,
			yMm: 6,
		});
		expect(panelRect(decor("route-dash"))).toBeNull();
		expect(patternCoverage(decor("dotted-grid"), MOTIFS)).toBeCloseTo(
			0.00785,
			4,
		);
		expect(patternCoverage(decor("route-dash"), MOTIFS)).toBe(0);
	});

	it("境界値系: 回転した図形の外接矩形は回転前より広がる", () => {
		const geometry = { contentInset: ZERO, pageMarginMm: 12 };
		const rotated = resolveMotifPlacements(
			{
				...decor("none"),
				motifs: [
					{
						anchor: "content-edge",
						color: "accent",
						count: 1,
						motif: "star",
						opacity: 1,
						rotateDeg: [45, 45],
						sizeMm: [4, 4],
						slot: "corner-nw",
					},
				],
			},
			MOTIFS,
			geometry,
			"v2-00000000",
		)[0];
		expect(rotated?.boundsMm.widthMm).toBeCloseTo(4 * Math.SQRT2, 5);
		expect(rotated?.boundsMm.xMm).toBeCloseTo(4 + 2 - 2 * Math.SQRT2, 5);
	});

	it("異常系: 未登録の図形を参照する装飾は配置を作れない", () => {
		expect(() =>
			resolveMotifPlacements(
				decor("route-dash"),
				new Map(),
				{ contentInset: ZERO, pageMarginMm: 12 },
				"v2-00000000",
			),
		).toThrow("未登録の図形");
	});
});
