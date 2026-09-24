/** @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MOTIF_ASSETS } from "../../../theme/motifAssets";
import { MotifShapes } from "./MotifShapes";

describe("MotifShapes", () => {
	it("正常系: recolor可能なSVG素材をマスクと色付き矩形で描画する", () => {
		const definition = MOTIF_ASSETS.find(
			(asset) => asset.id === "atlas-compass",
		);
		if (!definition) {
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
		const asset = MOTIF_ASSETS.find((asset) => asset.id === "paper-tape");
		if (!asset) {
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

	it("境界値系: 色の指定がなければ recolor 可能な素材もマスクせず描画する", () => {
		const definition = MOTIF_ASSETS.find(
			(asset) => asset.id === "atlas-compass",
		);
		if (!definition) {
			throw new Error("atlas-compass が未登録です。");
		}
		const { container } = render(
			<svg aria-label="装飾素材の描画領域">
				<MotifShapes color={null} definition={definition} maskId="plain-mask" />
			</svg>,
		);
		expect(container.querySelector("image")).toHaveAttribute(
			"href",
			definition.src,
		);
		expect(container.querySelector("mask")).not.toBeInTheDocument();
	});
});
