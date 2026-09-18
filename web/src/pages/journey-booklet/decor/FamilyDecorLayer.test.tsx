/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
	type DecorAnchor,
	type FamilyDecoration,
	type ResolvedFamilyDecor,
	resolveFamilyDecor,
} from "../../../theme/families/decorPlacement";
import { motifAssetsFor } from "../../../theme/motifAssets";
import { FamilyDecorLayer } from "./FamilyDecorLayer";

const ANCHORS: readonly DecorAnchor[] = [
	{
		id: "title-1",
		kind: "title",
		rect: { heightMm: 20, widthMm: 100, xMm: 14, yMm: 14 },
		reserveMm: 0,
	},
	{
		id: "illustration-1",
		kind: "illustration",
		rect: { heightMm: 40, widthMm: 60, xMm: 14, yMm: 40 },
		reserveMm: 4,
	},
	{
		id: "unit-1",
		kind: "unit",
		rect: { heightMm: 30, widthMm: 100, xMm: 14, yMm: 90 },
		reserveMm: 0,
	},
	{
		id: "unit-2",
		kind: "unit",
		rect: { heightMm: 30, widthMm: 100, xMm: 14, yMm: 128 },
		reserveMm: 0,
	},
];

const DECORATIONS: readonly FamilyDecoration[] = [
	{
		anchorId: "title-1",
		assetId: "atlas-compass",
		color: "accent",
		kind: "asset",
		layer: "under-content",
		offsetMm: [0, 0],
		rotateDeg: [-8, 8],
		sizeMm: 10,
	},
	{
		anchorId: "illustration-1",
		assetId: "paper-tape",
		color: "own",
		kind: "asset",
		layer: "over-image",
		offsetMm: [-2, -3],
		rotateDeg: [0, 0],
		sizeMm: 6,
	},
	{
		anchorId: "illustration-1",
		fill: "border",
		kind: "frame",
		notchMm: 1,
		radiusMm: 0,
		shape: "torn",
		stroke: "accent",
		widthMm: 2,
	},
	{
		color: "border",
		fromUnitId: "unit-1",
		kind: "connector",
		toUnitId: "unit-2",
		widthMm: 1,
	},
];

function decorOf(
	decorations: readonly FamilyDecoration[] = DECORATIONS,
): ResolvedFamilyDecor {
	return resolveFamilyDecor({
		anchors: ANCHORS,
		assets: motifAssetsFor(["atlas-compass", "paper-tape"]),
		decorations,
		familyId: "paper-collage",
		pageId: "page-2",
		protectedTexts: [],
		seedToken: "v2-0000002a",
	});
}

describe("系統装飾の描画層", () => {
	it("正常系: under-contentに素材と接続線を描き、over-imageを分ける", () => {
		const decor = decorOf();
		const under = render(
			<FamilyDecorLayer
				decor={decor}
				layer="under-content"
				pageId="page-2"
				scope="output"
			/>,
		);
		const underLayer = under.container.querySelector(
			"[data-booklet-decor-layer='under-content']",
		);
		expect(underLayer).toHaveAttribute("viewBox", "0 0 148 210");
		expect(underLayer).toHaveClass("booklet-family-decor");
		expect(
			underLayer?.querySelectorAll("[data-booklet-decor-asset]"),
		).toHaveLength(1);
		expect(
			underLayer?.querySelector("[data-booklet-decor-asset]"),
		).toHaveAttribute("data-booklet-decor-anchor", "title-1");
		expect(
			underLayer?.querySelector("[data-booklet-decor-connector]"),
		).toHaveAttribute("data-booklet-decor-connector", "unit-1>unit-2");
		expect(underLayer?.querySelector("[data-booklet-decor-frame]")).toBeNull();

		const over = render(
			<FamilyDecorLayer
				decor={decor}
				layer="over-image"
				pageId="page-2"
				scope="output"
			/>,
		);
		const overLayer = over.container.querySelector(
			"[data-booklet-decor-layer='over-image']",
		);
		expect(
			overLayer?.querySelector("[data-booklet-decor-asset]"),
		).toHaveAttribute("data-booklet-decor-asset", "paper-tape");
		// A photo frame reads on top of its image, so it belongs to over-image.
		expect(
			overLayer?.querySelector("[data-booklet-decor-frame]"),
		).toHaveAttribute("data-booklet-decor-frame", "torn");
	});

	it("正常系: 解決した実寸・回転・境界を属性として残す", () => {
		const view = render(
			<FamilyDecorLayer
				decor={decorOf()}
				layer="under-content"
				pageId="page-2"
				scope="output"
			/>,
		);
		const asset = view.container.querySelector("[data-booklet-decor-asset]");
		const rotation = Number(
			asset?.getAttribute("data-booklet-decor-rotation") ?? "",
		);
		expect(rotation).toBeGreaterThanOrEqual(-8);
		expect(rotation).toBeLessThanOrEqual(8);
		expect(asset?.getAttribute("transform")).toContain(
			`rotate(${rotation.toFixed(2)})`,
		);
		expect(asset).toHaveAttribute("data-booklet-decor-index", "0");
		expect(
			asset?.getAttribute("data-booklet-decor-bounds")?.split(","),
		).toHaveLength(4);
		expect(asset).not.toHaveAttribute("data-booklet-decor-rotation-fallback");
	});

	it("正常系: mask IDに計測・出力の区別とページ・anchor・番号を含める", () => {
		const decor = decorOf();
		const measurement = render(
			<FamilyDecorLayer
				decor={decor}
				layer="under-content"
				pageId="page-2"
				scope="measurement"
			/>,
		);
		const output = render(
			<FamilyDecorLayer
				decor={decor}
				layer="under-content"
				pageId="page-2"
				scope="output"
			/>,
		);
		const maskIdOf = (view: ReturnType<typeof render>) =>
			view.container.querySelector("mask")?.getAttribute("id");
		expect(maskIdOf(measurement)).toBe(
			"booklet-family-decor-measurement-page-2-title-1-0-mask",
		);
		expect(maskIdOf(output)).toBe(
			"booklet-family-decor-output-page-2-title-1-0-mask",
		);
		expect(
			output.container.querySelector("rect[mask]")?.getAttribute("mask"),
		).toBe("url(#booklet-family-decor-output-page-2-title-1-0-mask)");
	});

	const FRAME = {
		fill: "border",
		kind: "frame",
		notchMm: 1,
		radiusMm: 2,
		stroke: "accent",
		widthMm: 2,
	} as const;

	function framePathsOf(
		decorations: readonly FamilyDecoration[],
		layer: "under-content" | "over-image",
	): readonly string[] {
		const view = render(
			<FamilyDecorLayer
				decor={decorOf(decorations)}
				layer={layer}
				pageId="page-2"
				scope="output"
			/>,
		);
		const frame = view.container.querySelector("[data-booklet-decor-frame]");
		return Array.from(
			frame?.querySelectorAll("path") ?? [],
			(path) => path.getAttribute("d") ?? "",
		);
	}

	/**
	 * Every coordinate a frame path touches, as [x, y] pairs. Arc parameters
	 * before the end point are skipped so radii are not read as coordinates.
	 */
	function pointsOf(path: string): readonly (readonly [number, number])[] {
		const pattern =
			/[ML](-?[\d.]+) (-?[\d.]+)|A(?:-?[\d.]+ ){5}(-?[\d.]+) (-?[\d.]+)/g;
		return Array.from(path.matchAll(pattern), (match) => {
			const [xMm, yMm] =
				match[1] !== undefined ? [match[1], match[2]] : [match[3], match[4]];
			return [Number(xMm), Number(yMm)] as const;
		});
	}

	it("正常系: 写真の枠は面を帯に限定し、写真が見える", () => {
		const [face, outline] = framePathsOf(
			[{ ...FRAME, anchorId: "illustration-1", shape: "rounded" }],
			"over-image",
		);
		if (face === undefined || outline === undefined) {
			throw new Error("枠の面と輪郭がありません。");
		}
		// Two subpaths with evenodd leave the image visible inside the band.
		expect(face.match(/Z/g)).toHaveLength(2);
		expect(
			render(
				<FamilyDecorLayer
					decor={decorOf([
						{ ...FRAME, anchorId: "illustration-1", shape: "rounded" },
					])}
					layer="over-image"
					pageId="page-2"
					scope="output"
				/>,
			).container.querySelector("[data-booklet-decor-frame] path"),
		).toHaveAttribute("fill-rule", "evenodd");
		expect(outline.match(/Z/g)).toHaveLength(1);
	});

	it("正常系: カードの枠は面が基準の矩形全体を覆う", () => {
		const [face] = framePathsOf(
			[{ ...FRAME, anchorId: "unit-1", shape: "rounded" }],
			"under-content",
		);
		if (face === undefined) {
			throw new Error("枠の面がありません。");
		}
		// One subpath, so the body text always sits on an opaque face.
		expect(face.match(/Z/g)).toHaveLength(1);
		const xs = pointsOf(face).map(([x]) => x);
		const ys = pointsOf(face).map(([, y]) => y);
		expect(Math.min(...xs)).toBeCloseTo(14, 3);
		expect(Math.max(...xs)).toBeCloseTo(114, 3);
		expect(Math.min(...ys)).toBeCloseTo(90, 3);
		expect(Math.max(...ys)).toBeCloseTo(120, 3);
	});

	it("境界値系: 形ごとのインクが文字を許した領域へ入らない", () => {
		// 60×40mm photo anchor at (14,40), 2mm border and 1mm cut-in.
		for (const shape of ["circle", "rounded", "torn"] as const) {
			const decoration = { ...FRAME, anchorId: "illustration-1", shape };
			const resolved = decorOf([decoration]).items[0];
			if (resolved?.kind !== "frame") {
				throw new Error("枠がありません。");
			}
			const safe = resolved.textSafeRectMm;
			for (const path of framePathsOf([decoration], "over-image")) {
				for (const [x, y] of pointsOf(path)) {
					// A point may sit on the safe edge but never inside it.
					const insideSafe =
						x > safe.xMm + 1e-6 &&
						x < safe.xMm + safe.widthMm - 1e-6 &&
						y > safe.yMm + 1e-6 &&
						y < safe.yMm + safe.heightMm - 1e-6;
					expect(insideSafe).toBe(false);
				}
			}
			if (shape === "circle") {
				// Inner ink edge is 20 - (2 + 1) = 17mm, so the safe square is smaller.
				expect(safe.widthMm).toBeCloseTo((2 * 17) / Math.SQRT2, 6);
			}
		}
	});

	it("境界値系: 同じanchorの枠を2件描いても取りこぼさない", () => {
		const view = render(
			<FamilyDecorLayer
				decor={decorOf([
					{ ...FRAME, anchorId: "illustration-1", shape: "rounded" },
					{ ...FRAME, anchorId: "illustration-1", shape: "circle" },
				])}
				layer="over-image"
				pageId="page-2"
				scope="output"
			/>,
		);
		expect(
			view.container.querySelectorAll("[data-booklet-decor-frame]"),
		).toHaveLength(2);
	});

	it("正常系: 0度への退避を属性に残す", () => {
		const view = render(
			<FamilyDecorLayer
				decor={resolveFamilyDecor({
					anchors: [
						{
							id: "title-1",
							kind: "title",
							rect: { heightMm: 30, widthMm: 148, xMm: 0, yMm: 0 },
							reserveMm: 0,
						},
					],
					assets: motifAssetsFor(["atlas-route-mark"]),
					decorations: [
						{
							anchorId: "title-1",
							assetId: "atlas-route-mark",
							color: "accent",
							kind: "asset",
							layer: "under-content",
							offsetMm: [0, 0],
							rotateDeg: [45, 45],
							sizeMm: 20,
						},
					],
					familyId: "atlas-grid",
					pageId: "page-1",
					protectedTexts: [],
					seedToken: "v2-0000002a",
				})}
				layer="under-content"
				pageId="page-1"
				scope="output"
			/>,
		);
		const asset = view.container.querySelector("[data-booklet-decor-asset]");
		expect(asset).toHaveAttribute("data-booklet-decor-rotation", "0.00");
		expect(asset).toHaveAttribute(
			"data-booklet-decor-rotation-fallback",
			"true",
		);
		expect(asset).toHaveAttribute(
			"data-booklet-decor-bounds",
			"0.00,0.00,40.00,20.00",
		);
	});

	it("境界値系: その層に装飾がなければSVGを描かない", () => {
		const view = render(
			<FamilyDecorLayer
				decor={decorOf([
					{
						color: "border",
						fromUnitId: "unit-1",
						kind: "connector",
						toUnitId: "unit-2",
						widthMm: 1,
					},
				])}
				layer="over-image"
				pageId="page-2"
				scope="output"
			/>,
		);
		expect(view.container.querySelector("svg")).toBeNull();
	});
});
