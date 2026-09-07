import { describe, expect, it } from "vitest";
import { MOTIFS } from "./motifs";

describe("図形素材の語彙", () => {
	it("正常系: 12種の手続き図形を登録し、キーと定義IDが一致する", () => {
		expect(MOTIFS.size).toBe(12);
		for (const [id, motif] of MOTIFS) {
			expect(motif.id).toBe(id);
			expect(motif.kind).toBe("procedural");
			expect(motif.aspect).toBeGreaterThan(0);
			expect(motif.coverage).toBeGreaterThanOrEqual(0);
			expect(motif.coverage).toBeLessThanOrEqual(1);
		}
	});

	it("正常系: 手続き図形の座標は箱（幅aspect×高さ1）に収まる", () => {
		for (const motif of MOTIFS.values()) {
			if (motif.kind !== "procedural") {
				continue;
			}
			expect(motif.shapes.length).toBeGreaterThan(0);
			for (const shape of motif.shapes) {
				if (shape.kind === "circle") {
					expect(shape.cx - shape.r).toBeGreaterThanOrEqual(-1e-6);
					expect(shape.cx + shape.r).toBeLessThanOrEqual(motif.aspect + 1e-6);
					expect(shape.cy - shape.r).toBeGreaterThanOrEqual(-1e-6);
					expect(shape.cy + shape.r).toBeLessThanOrEqual(1 + 1e-6);
				} else if (shape.kind === "rect") {
					expect(shape.x).toBeGreaterThanOrEqual(0);
					expect(shape.x + shape.width).toBeLessThanOrEqual(
						motif.aspect + 1e-6,
					);
					expect(shape.y).toBeGreaterThanOrEqual(0);
					expect(shape.y + shape.height).toBeLessThanOrEqual(1 + 1e-6);
				} else {
					expect(shape.d).toMatch(/^M/);
				}
				expect(shape.fill === "color" || shape.stroke === "color").toBe(true);
			}
		}
	});

	it("境界値系: 帯用の細長い図形は幅が148mm・128mmに対応する", () => {
		expect(MOTIFS.get("stripe")?.aspect).toBeCloseTo(148 / 6, 6);
		expect(MOTIFS.get("rule-square")?.aspect).toBeCloseTo(128 / 3, 6);
		expect(MOTIFS.get("dash-rail")?.aspect).toBeCloseTo(4 / 196, 6);
	});
});
