/** @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MOTIFS } from "../../../theme/motifs";
import { MotifShapes } from "./MotifShapes";

describe("MotifShapes", () => {
	it("正常系: recolor可能なSVG素材をマスクと色付き矩形で描画する", () => {
		const definition = MOTIFS.get("atlas-compass");
		if (definition?.kind !== "asset") {
			throw new Error("atlas-compass が未登録です。");
		}
		const { container } = render(
			<svg aria-label="装飾素材の描画領域">
				<MotifShapes
					color="var(--accent)"
					definition={definition}
					maskId="compass-mask"
				/>
			</svg>,
		);
		expect(container.querySelector("mask#compass-mask image")).toHaveAttribute(
			"href",
			definition.src,
		);
		expect(container.querySelector("rect")).toHaveAttribute(
			"mask",
			"url(#compass-mask)",
		);
	});

	it("正常系: 固有色を選ぶ素材は元SVGを直接描画する", () => {
		const asset = MOTIFS.get("paper-tape");
		if (asset?.kind !== "asset") {
			throw new Error("paper-tape が未登録です。");
		}
		const { container } = render(
			<svg aria-label="装飾素材の描画領域">
				<MotifShapes color={null} definition={asset} maskId="tape-mask" />
			</svg>,
		);
		expect(container.querySelector("image")).toHaveAttribute("href", asset.src);
		expect(container.querySelector("mask")).not.toBeInTheDocument();
	});

	it("境界値系: 手続き図形は既存の図形要素を描画する", () => {
		const definition = MOTIFS.get("dot");
		if (!definition) {
			throw new Error("dot が未登録です。");
		}
		const { container } = render(
			<svg aria-label="装飾素材の描画領域">
				<MotifShapes color="black" definition={definition} maskId="dot-mask" />
			</svg>,
		);
		expect(container.querySelector("circle")).toBeInTheDocument();
	});
});
