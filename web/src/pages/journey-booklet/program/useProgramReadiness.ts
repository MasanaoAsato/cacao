import { useCallback, useEffect, useRef, useState } from "react";
import type { BookletModel } from "../../../booklet/model";
import type { BookletProgram } from "../../../booklet/program/model";
import type { BookletPagePlanStatus } from "../workState";
import type { PlannedScene } from "./moduleRegistry";

export type ProgramReadinessState = {
	readonly error: string | null;
	readonly model: BookletModel | null;
	/** Units printed after the final check; null until then. */
	readonly pageCount: number | null;
	readonly plans: ReadonlyMap<string, PlannedScene>;
	readonly program: BookletProgram | null;
	/** Increases whenever the model or the program changes. */
	readonly runId: number;
	readonly status: BookletPagePlanStatus;
};

function initialState(
	program: BookletProgram | null,
	model: BookletModel | null,
	runId: number,
): ProgramReadinessState {
	return {
		error: null,
		model,
		pageCount: null,
		plans: new Map(),
		program,
		runId,
		status: program && model ? "measuring" : "idle",
	};
}

export type ProgramReadiness = ProgramReadinessState & {
	readonly reportChecked: (runId: number, pageCount: number) => void;
	readonly reportFailed: (runId: number, error: string) => void;
	readonly reportPlanned: (
		runId: number,
		sceneId: string,
		planned: PlannedScene,
	) => void;
};

/**
 * `idle → measuring → checking → ready`, any failure → `error`. A model or
 * program change starts a new run and drops every scene result; callbacks of
 * an older run, or arriving after unmount, change nothing. One ready scene
 * never makes the booklet ready.
 */
export function useProgramReadiness(
	program: BookletProgram | null,
	model: BookletModel | null,
	sceneCount: number,
): ProgramReadiness {
	const [state, setState] = useState(() => initialState(program, model, 1));
	let current = state;
	if (state.program !== program || state.model !== model) {
		current = initialState(program, model, state.runId + 1);
		setState(current);
	}
	const mountedRef = useRef(true);
	useEffect(() => {
		mountedRef.current = true;
		return () => {
			mountedRef.current = false;
		};
	}, []);

	const update = useCallback(
		(
			runId: number,
			next: (state: ProgramReadinessState) => ProgramReadinessState,
		) => {
			if (!mountedRef.current) return;
			setState((previous) =>
				previous.runId !== runId || previous.status === "error"
					? previous
					: next(previous),
			);
		},
		[],
	);

	const reportPlanned = useCallback(
		(runId: number, sceneId: string, planned: PlannedScene) =>
			update(runId, (previous) => {
				if (previous.status !== "measuring") return previous;
				const plans = new Map(previous.plans);
				plans.set(sceneId, planned);
				return {
					...previous,
					plans,
					status: plans.size === sceneCount ? "checking" : "measuring",
				};
			}),
		[sceneCount, update],
	);
	const reportFailed = useCallback(
		(runId: number, error: string) =>
			update(runId, (previous) => ({
				...previous,
				error,
				pageCount: null,
				status: "error",
			})),
		[update],
	);
	const reportChecked = useCallback(
		(runId: number, pageCount: number) =>
			update(runId, (previous) =>
				previous.status === "checking"
					? { ...previous, pageCount, status: "ready" }
					: previous,
			),
		[update],
	);

	return { ...current, reportChecked, reportFailed, reportPlanned };
}
