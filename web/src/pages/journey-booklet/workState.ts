import type { BookletModel } from "../../booklet/model";

export type BookletPagePlanStatus =
	| "idle"
	| "measuring"
	| "checking"
	| "ready"
	| "error";

/**
 * What any renderer of a work reports to the page (25.4). Only `ready`
 * carries prepared values; every other status nulls them so a stale
 * preparation can never be printed.
 */
export type BookletWorkState = {
	readonly error: string | null;
	/** The page's generation this state was reported for. */
	readonly generation: number;
	readonly pageCount: number | null;
	readonly preparedModel: BookletModel | null;
	readonly preparedRenderKey: string | null;
	readonly status: BookletPagePlanStatus;
};

export function pendingWorkState(
	status: Exclude<BookletPagePlanStatus, "ready" | "error">,
	generation: number,
): BookletWorkState {
	return {
		error: null,
		generation,
		pageCount: null,
		preparedModel: null,
		preparedRenderKey: null,
		status,
	};
}

export function failedWorkState(
	error: string,
	generation: number,
): BookletWorkState {
	return {
		error,
		generation,
		pageCount: null,
		preparedModel: null,
		preparedRenderKey: null,
		status: "error",
	};
}

export function readyWorkState(input: {
	readonly generation: number;
	readonly model: BookletModel;
	readonly pageCount: number;
	readonly renderKey: string;
}): BookletWorkState {
	return {
		error: null,
		generation: input.generation,
		pageCount: input.pageCount,
		preparedModel: input.model,
		preparedRenderKey: input.renderKey,
		status: "ready",
	};
}

/**
 * Printing is allowed only for a ready state of the current model (by
 * reference), render key and generation with at least one page.
 */
export function isPrintableWork(
	state: BookletWorkState,
	current: {
		readonly generation: number;
		readonly model: BookletModel | null;
		readonly renderKey: string | null;
	},
): boolean {
	return (
		state.status === "ready" &&
		current.model !== null &&
		current.renderKey !== null &&
		state.preparedModel === current.model &&
		state.preparedRenderKey === current.renderKey &&
		state.generation === current.generation &&
		state.pageCount !== null &&
		state.pageCount > 0
	);
}
