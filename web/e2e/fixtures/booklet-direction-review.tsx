import "@fontsource/dela-gothic-one/400.css";
import "@fontsource/kaisei-decol/400.css";
import "@fontsource/kaisei-decol/700.css";
import "@fontsource/m-plus-rounded-1c/400.css";
import "@fontsource/m-plus-rounded-1c/700.css";
import "@fontsource/noto-sans-jp/400.css";
import "@fontsource/noto-sans-jp/700.css";
import "@fontsource/noto-serif-jp/400.css";
import "@fontsource/noto-serif-jp/700.css";
import "@fontsource/rocknroll-one/400.css";
import "@fontsource/shippori-mincho/400.css";
import "@fontsource/shippori-mincho/700.css";
import "@fontsource/zen-kaku-gothic-new/400.css";
import "@fontsource/zen-kaku-gothic-new/700.css";
import "@fontsource/zen-kurenaido/400.css";
import "../../src/print.css";
import "../../src/theme/bookletTheme.css";
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { WorkRenderer } from "../../src/pages/journey-booklet/WorkRenderer";
import {
	type BookletWorkState,
	pendingWorkState,
} from "../../src/pages/journey-booklet/workState";
import { compileBooklet } from "../../src/theme/composition/compileBooklet";
import { DIRECTION_REGISTRY } from "../../src/theme/directions/registry";
import {
	DIRECTION_IDS,
	type DirectionId,
} from "../../src/theme/directions/types";
import {
	previewArtworkById,
	previewCatalogFor,
} from "./booklet-direction-review-catalog";
import { REVIEW_MODEL } from "./booklet-direction-review-model";
import "./booklet-direction-review.css";

function selectedDirection(): DirectionId {
	const requested = new URLSearchParams(window.location.search).get(
		"direction",
	);
	return DIRECTION_IDS.find((id) => id === requested) ?? "vintage-journal";
}

function reviewUrl(id: DirectionId): string {
	return `?direction=${encodeURIComponent(id)}`;
}

const id = selectedDirection();
const index = DIRECTION_IDS.indexOf(id);
const result = compileBooklet(
	REVIEW_MODEL,
	{ seed: { value: 6, version: "v2" } },
	previewCatalogFor(id),
);

const previewSvgIds =
	result.status === "compiled"
		? [
				...new Set(
					result.program.scenes.flatMap((scene) =>
						scene.config.bindings
							.filter(
								(binding) =>
									previewArtworkById(binding.assetId).format === "svg",
							)
							.map((binding) => binding.assetId),
					),
				),
			]
		: [];

function DirectionReview() {
	const [state, setState] = useState<BookletWorkState>(() =>
		pendingWorkState("idle", 1),
	);
	return (
		<div
			className="booklet-shell review-shell"
			data-booklet-print-state={state.status}
			data-review-direction={id}
			data-review-error={state.error ?? undefined}
			data-review-status={state.status}
		>
			<header className="review-controls" data-review-controls>
				<h1>52方向の単独冊子・視覚審査前プレビュー</h1>
				<p>
					<strong>視覚審査前の診断プレビュー</strong>
					：既存baselineを使って描画します。方向固有の構図や素材表現が不足するテーマがあり、採否判定にはまだ使えません。SVG素材IDの確認には使えます。
				</p>
				<p>
					<strong>draft</strong>
					：未審査素材を仮使用しています。この強制作例は製品の抽選結果・208作例に算入しません。
					<span className="review-artwork-summary" data-review-svg-count={previewSvgIds.length}>
						<strong>この冊子で使うSVG素材: {previewSvgIds.length}点</strong>
						{previewSvgIds.length > 0
							? ` (${previewSvgIds.join(", ")})`
							: "。この方向の構図ではSVG素材を使用していません。"}
					</span>
				</p>
				<div className="review-controls__actions">
					<a href={reviewUrl(DIRECTION_IDS[(index + 51) % 52])}>前の方向</a>
					<label htmlFor="review-direction">方向 {index + 1}/52</label>
					<select
						id="review-direction"
						onChange={(event) => {
							window.location.href = reviewUrl(
								event.target.value as DirectionId,
							);
						}}
						value={id}
					>
						{DIRECTION_IDS.map((directionId, number) => (
							<option key={directionId} value={directionId}>
								{number + 1}.{" "}
								{
									DIRECTION_REGISTRY.get(directionId)?.baseline().signature
										.label
								}{" "}
								({directionId})
							</option>
						))}
					</select>
					<a href={reviewUrl(DIRECTION_IDS[(index + 1) % 52])}>次の方向</a>
					<button
						disabled={state.status !== "ready"}
						onClick={() => window.print()}
						type="button"
					>
						PDFに印刷
					</button>
				</div>
				<p role="status">
					{state.error ??
						(state.status === "ready"
							? `${state.pageCount}ページ・A5印刷可能`
							: `準備中: ${state.status}`)}
				</p>
			</header>
			<WorkRenderer
				generation={1}
				model={REVIEW_MODEL}
				onStateChange={setState}
				work={{ artworkById: previewArtworkById, result }}
			/>
		</div>
	);
}

const root = document.querySelector("#root");
if (!root) throw new Error("審査プレビューの描画先がありません。");
createRoot(root).render(<DirectionReview />);
