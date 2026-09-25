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
import { canonicalArtworkTouchId } from "../../src/theme/artwork/types";
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
import {
	REVIEW_MODEL,
	reviewModelForMonth,
	SEASON_REVIEW_MONTHS,
	type SeasonReviewMonth,
} from "./booklet-direction-review-model";
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

function seasonMonth(): SeasonReviewMonth {
	const requested = new URLSearchParams(window.location.search).get("month");
	return SEASON_REVIEW_MONTHS.find((month) => month === requested) ?? "08";
}

const id = selectedDirection();
const index = DIRECTION_IDS.indexOf(id);
const month = seasonMonth();
const reviewModel = id === "season" ? reviewModelForMonth(month) : REVIEW_MODEL;
const baseline = (() => {
	const found = DIRECTION_REGISTRY.get(id)?.baseline();
	if (!found) throw new Error(`審査対象の方向がありません: ${id}`);
	return found;
})();
const result = compileBooklet(
	reviewModel,
	{ seed: { value: 6, version: "v2" } },
	previewCatalogFor(id),
);

const previewArtworkIds =
	result.status === "compiled"
		? [
				...new Set(
					result.program.scenes.flatMap((scene) =>
						scene.config.bindings.flatMap((binding) => {
							const assetId = binding.assetId;
							return assetId === null ? [] : [assetId];
						}),
					),
				),
			]
		: [];
const previewSvgIds = previewArtworkIds.filter(
	(assetId) => previewArtworkById(assetId).format === "svg",
);
const previewWebpIds = previewArtworkIds.filter(
	(assetId) => previewArtworkById(assetId).format === "webp",
);

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
				<h1>52方向の単独冊子・デザイン審査</h1>
				<p>
					<strong>{baseline.signature.label}</strong>：
					{baseline.signature.description}
					。表紙と日別ページを同じ旅程で比べられます。
				</p>
				<p>
					<strong>draft</strong>
					：未審査素材を仮使用しています。この強制作例は製品の抽選結果・208作例に算入しません。
					<span
						className="review-artwork-summary"
						data-review-artwork-count={previewArtworkIds.length}
						data-review-svg-count={previewSvgIds.length}
						data-review-webp-count={previewWebpIds.length}
					>
						<strong>
							使用素材 {previewArtworkIds.length}点（SVG {previewSvgIds.length}
							点・WebP {previewWebpIds.length}点）
						</strong>
						{previewArtworkIds.length > 0
							? `：${previewArtworkIds.join(", ")}`
							: canonicalArtworkTouchId(baseline.touch) === null
								? "：装飾素材を使わない方向です。"
								: "：必要な素材がありません。"}
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
					{id === "season" ? (
						<label>
							季節
							<select
								aria-label="季節の見本"
								data-review-season-month={month}
								value={month}
								onChange={(event) => {
									window.location.href = `${reviewUrl(id)}&month=${event.target.value}`;
								}}
							>
								<option value="03">春・3月</option>
								<option value="08">夏・8月</option>
								<option value="09">秋・9月</option>
								<option value="12">冬・12月</option>
							</select>
						</label>
					) : null}
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
				model={reviewModel}
				onStateChange={setState}
				work={{ artworkById: previewArtworkById, result }}
			/>
		</div>
	);
}

const root = document.querySelector("#root");
if (!root) throw new Error("審査プレビューの描画先がありません。");
createRoot(root).render(<DirectionReview />);
