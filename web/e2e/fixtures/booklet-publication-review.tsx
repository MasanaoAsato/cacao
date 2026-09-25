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
import type { DirectionId } from "../../src/theme/directions/types";
import { parseThemeSeed } from "../../src/theme/seed";
import { COMPARISON_BOOKLET_MODEL } from "./booklet-diversity";
import { plannedPublicationCatalog } from "./booklet-publication-catalog";
import plan from "./booklet-publication-plan.json";
import "./booklet-direction-review.css";

const requested = (() => {
	const parsed = parseThemeSeed(
		new URLSearchParams(window.location.search).get("seed"),
	);
	if (parsed.kind !== "valid")
		throw new Error("正式比較には有効なseedを指定してください。");
	return parsed;
})();
const catalog = plannedPublicationCatalog({
	directionIds: plan.directionIds as DirectionId[],
	artworkIds: plan.artworkIds,
});
const assets = new Map(catalog.artwork.map((asset) => [asset.id, asset]));
const result = compileBooklet(
	COMPARISON_BOOKLET_MODEL,
	{ seed: requested.seed },
	catalog,
);

function PlannedPublicationReview() {
	const [state, setState] = useState<BookletWorkState>(() =>
		pendingWorkState("idle", 1),
	);
	return (
		<div
			className="booklet-shell review-shell"
			data-booklet-catalog-revision={catalog.revision}
			data-booklet-direction-id={
				result.status === "compiled" ? result.trace.baseDirectionId : undefined
			}
			data-booklet-print-state={state.status}
		>
			<header className="review-controls" data-review-controls>
				<h1>公開予定カタログの正式比較</h1>
				<p>
					seed {requested.token}、公開予定 {catalog.directions.length}{" "}
					方向。素材はreviewedまたはactiveの記録と一致するものだけを使用します。
				</p>
				<p role="status">
					{state.error ??
						(state.status === "ready"
							? "A5冊子の準備ができました。"
							: "冊子を準備しています…")}
				</p>
			</header>
			<WorkRenderer
				generation={1}
				model={COMPARISON_BOOKLET_MODEL}
				onStateChange={setState}
				work={{
					artworkById: (id) => {
						const asset = assets.get(id);
						if (!asset) throw new Error(`公開予定素材がありません: ${id}`);
						return asset;
					},
					result,
				}}
			/>
		</div>
	);
}

const root = document.getElementById("root");
if (!root) throw new Error("公開予定カタログの描画先がありません。");
createRoot(root).render(<PlannedPublicationReview />);
