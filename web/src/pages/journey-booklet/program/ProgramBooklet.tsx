import { useEffect, useMemo, useRef } from "react";
import type { BookletModel } from "../../../booklet/model";
import {
	type AssembledPage,
	assemblePages,
} from "../../../booklet/program/assemblePages";
import { deriveFacts } from "../../../booklet/program/deriveFacts";
import type {
	AnyScenePlan,
	BookletProgram,
} from "../../../booklet/program/model";
import { programRenderKey } from "../../../booklet/program/programKeys";
import { buildSceneSpecs } from "../../../booklet/program/sceneSpec";
import { programIssues } from "../../../booklet/program/validateProgram";
import type { ArtworkAsset } from "../../../theme/artwork/types";
import {
	type BookletWorkState,
	failedWorkState,
	pendingWorkState,
	readyWorkState,
} from "../workState";
import { nextFrame, waitForImages } from "./measureDom";
import {
	type BoundScene,
	bindScene,
	type ModuleRegistry,
} from "./moduleRegistry";
import { checkProgramOutput } from "./outputChecks";
import { PROGRAM_MODULES } from "./programModules";
import { SceneSession } from "./SceneSession";
import type { SceneRenderContext } from "./sceneParts";
import { resolveSceneStyle } from "./sceneStyle";
import { useProgramReadiness } from "./useProgramReadiness";
import "./ProgramBooklet.css";

function errorMessage(error: unknown, fallback: string): string {
	return error instanceof Error ? error.message : fallback;
}

type Preparation =
	| { readonly bound: readonly BoundScene[]; readonly error: null }
	| { readonly bound: readonly []; readonly error: string };

/** Validates the program and binds every scene to its module before measuring. */
function prepare(
	program: BookletProgram,
	model: BookletModel,
	registry: ModuleRegistry,
): Preparation {
	const issues = programIssues(program, model);
	if (issues.length > 0)
		return {
			bound: [],
			error: `冊子プログラムが不正です: ${issues.join(" / ")}`,
		};
	try {
		return {
			bound: buildSceneSpecs(program, model).map((spec) =>
				bindScene(spec, registry),
			),
			error: null,
		};
	} catch (error) {
		return {
			bound: [],
			error: errorMessage(error, "冊子プログラムを準備できませんでした。"),
		};
	}
}

type Assembly =
	| { readonly error: null; readonly pages: readonly AssembledPage[] }
	| { readonly error: string; readonly pages: null };

/**
 * Draws a compiled program (25.4): each scene is measured in its own
 * session, the local plans are concatenated into one `.booklet-document`,
 * and the whole document is checked before anything may print.
 */
export function ProgramBooklet({
	artworkById,
	generation,
	model,
	onStateChange,
	program,
	registry = PROGRAM_MODULES,
}: {
	/** Frozen IDs are resolved in the catalog the program was compiled with. */
	readonly artworkById: (id: string) => ArtworkAsset;
	readonly generation: number;
	readonly model: BookletModel;
	readonly onStateChange: (state: BookletWorkState) => void;
	readonly program: BookletProgram;
	readonly registry?: ModuleRegistry;
}) {
	const preparation = useMemo(
		() => prepare(program, model, registry),
		[model, program, registry],
	);
	const renderKey = useMemo(() => programRenderKey(program), [program]);
	const facts = useMemo(() => deriveFacts(model), [model]);
	const contexts = useMemo(
		() =>
			new Map<string, SceneRenderContext>(
				preparation.bound.map((bound) => [
					bound.spec.scene.sceneId,
					{
						artworkById,
						facts,
						seedToken: program.seed,
						style: resolveSceneStyle(bound.spec.scene),
					},
				]),
			),
		[artworkById, facts, preparation, program.seed],
	);
	const readiness = useProgramReadiness(
		program,
		model,
		preparation.bound.length,
	);
	const { reportChecked, reportFailed, reportPlanned, runId, status } =
		readiness;

	const assembly = useMemo((): Assembly | null => {
		if (status !== "checking" && status !== "ready") return null;
		try {
			const plans = new Map<string, AnyScenePlan>(
				[...readiness.plans].map(([sceneId, planned]) => [
					sceneId,
					planned.plan,
				]),
			);
			return { error: null, pages: assemblePages(program, plans) };
		} catch (error) {
			return {
				error: errorMessage(error, "ページを連結できませんでした。"),
				pages: null,
			};
		}
	}, [program, readiness.plans, status]);

	useEffect(() => {
		if (preparation.error) reportFailed(runId, preparation.error);
	}, [preparation, reportFailed, runId]);

	useEffect(() => {
		if (assembly?.error) reportFailed(runId, assembly.error);
	}, [assembly, reportFailed, runId]);

	const documentRef = useRef<HTMLElement>(null);
	useEffect(() => {
		if (status !== "checking" || !assembly?.pages) return;
		const pages = assembly.pages;
		let cancelled = false;
		const check = async () => {
			try {
				await nextFrame();
				const root = documentRef.current;
				if (!root || root.dataset.bookletRenderKey !== renderKey)
					throw new Error("印刷ページDOMを準備できませんでした。");
				await waitForImages(root);
				if (cancelled) return;
				checkProgramOutput({
					assembled: pages,
					model,
					planned: readiness.plans,
					program,
					root,
				});
				reportChecked(runId, pages.length);
			} catch (error) {
				if (!cancelled)
					reportFailed(
						runId,
						errorMessage(error, "印刷ページの確認に失敗しました。"),
					);
			}
		};
		void check();
		return () => {
			cancelled = true;
		};
	}, [
		assembly,
		model,
		program,
		readiness.plans,
		renderKey,
		reportChecked,
		reportFailed,
		runId,
		status,
	]);

	useEffect(() => {
		if (status === "ready" && readiness.pageCount !== null) {
			onStateChange(
				readyWorkState({
					generation,
					model,
					pageCount: readiness.pageCount,
					renderKey,
				}),
			);
			return;
		}
		if (status === "error") {
			onStateChange(
				failedWorkState(
					readiness.error ?? "印刷前の準備に失敗しました。",
					generation,
				),
			);
			return;
		}
		// A ready run without its page count is still being confirmed.
		onStateChange(
			pendingWorkState(status === "ready" ? "checking" : status, generation),
		);
	}, [
		generation,
		model,
		onStateChange,
		readiness.error,
		readiness.pageCount,
		renderKey,
		status,
	]);

	const pagesByScene = useMemo(() => {
		const map = new Map<string, AssembledPage[]>();
		for (const page of assembly?.pages ?? []) {
			const list = map.get(page.scene.sceneId) ?? [];
			list.push(page);
			map.set(page.scene.sceneId, list);
		}
		return map;
	}, [assembly]);

	return (
		<>
			<div
				aria-hidden="true"
				className="booklet-measurement program-measurement"
				data-program-measurement="true"
			>
				{status === "error"
					? null
					: preparation.bound.map((bound) => {
							const context = contexts.get(bound.spec.scene.sceneId);
							return context ? (
								<SceneSession
									bound={bound}
									context={context}
									key={`${runId}:${bound.spec.scene.sceneId}`}
									onFailed={reportFailed}
									onPlanned={reportPlanned}
									runId={runId}
								/>
							) : null;
						})}
			</div>
			{assembly?.pages && status !== "error" ? (
				<main
					aria-label="旅のしおり印刷プレビュー"
					className="booklet-document program-document"
					data-booklet-render-key={renderKey}
					ref={documentRef}
				>
					{program.scenes.map((scene) => {
						const planned = readiness.plans.get(scene.sceneId);
						const context = contexts.get(scene.sceneId);
						return planned && context
							? planned.render(pagesByScene.get(scene.sceneId) ?? [], context)
							: null;
					})}
				</main>
			) : null}
		</>
	);
}
