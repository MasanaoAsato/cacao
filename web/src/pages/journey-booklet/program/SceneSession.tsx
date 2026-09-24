import { useEffect, useRef } from "react";
import { waitForArtworkAssets } from "../decor/artworkReadiness";
import {
	nextFrame,
	sampleTextOf,
	waitForImages,
	waitForSceneFonts,
} from "./measureDom";
import type { BoundScene, PlannedScene } from "./moduleRegistry";
import type { SceneRenderContext } from "./sceneParts";

function failureMessage(error: unknown, sceneId: string): string {
	const detail = error instanceof Error ? error.message : "不明なエラー";
	return `scene「${sceneId}」の印刷準備に失敗しました: ${detail}`;
}

/**
 * Mounts one scene's measurement DOM. It waits for the scene's own fonts
 * (family, weight and characters), its itinerary images and its frozen
 * artwork, then measures and paginates. Results carry the run ID so the host
 * can drop anything from an older run.
 */
export function SceneSession({
	bound,
	context,
	onFailed,
	onPlanned,
	runId,
}: {
	readonly bound: BoundScene;
	readonly context: SceneRenderContext;
	readonly onFailed: (runId: number, error: string) => void;
	readonly onPlanned: (
		runId: number,
		sceneId: string,
		planned: PlannedScene,
	) => void;
	readonly runId: number;
}) {
	const rootRef = useRef<HTMLDivElement>(null);
	const sceneId = bound.spec.scene.sceneId;

	useEffect(() => {
		let cancelled = false;
		const run = async () => {
			try {
				const root = rootRef.current;
				if (!root) throw new Error("計測用DOMを準備できませんでした。");
				const resources = bound.resources(context);
				await waitForSceneFonts(resources.fonts, sampleTextOf(root));
				await waitForImages(root);
				await waitForArtworkAssets(resources.artworkIds, context.artworkById);
				await nextFrame();
				if (cancelled) return;
				const planned = bound.measureAndPlan(root, context);
				if (!cancelled) onPlanned(runId, sceneId, planned);
			} catch (error) {
				if (!cancelled) onFailed(runId, failureMessage(error, sceneId));
			}
		};
		void run();
		return () => {
			cancelled = true;
		};
	}, [bound, context, onFailed, onPlanned, runId, sceneId]);

	return (
		<div
			className="program-measurement__scene"
			data-scene-measurement={sceneId}
			ref={rootRef}
		>
			{bound.renderMeasure(context)}
		</div>
	);
}
