import { useEffect } from "react";
import type { BookletModel } from "../../booklet/model";
import type { ArtworkAsset } from "../../theme/artwork/types";
import type { CompileResult } from "../../theme/composition/types";
import { ProgramBooklet } from "./program/ProgramBooklet";
import { type BookletWorkState, failedWorkState } from "./workState";

/** What to draw: the compiled program of the product entry. */
export type BookletWork = {
	/** Resolves frozen IDs in the catalog the program was compiled with. */
	readonly artworkById: (id: string) => ArtworkAsset;
	readonly result: CompileResult;
};

function CompileFailure({
	generation,
	message,
	onStateChange,
}: {
	readonly generation: number;
	readonly message: string;
	readonly onStateChange: (state: BookletWorkState) => void;
}) {
	useEffect(() => {
		onStateChange(failedWorkState(message, generation));
	}, [generation, message, onStateChange]);
	return null;
}

/** Hands the work to its host and reports one normalized state to the page. */
export function WorkRenderer({
	generation,
	model,
	onStateChange,
	work,
}: {
	readonly generation: number;
	readonly model: BookletModel;
	readonly onStateChange: (state: BookletWorkState) => void;
	readonly work: BookletWork;
}) {
	if (work.result.status === "failed")
		return (
			<CompileFailure
				generation={generation}
				message={work.result.message}
				onStateChange={onStateChange}
			/>
		);
	return (
		<ProgramBooklet
			artworkById={work.artworkById}
			generation={generation}
			model={model}
			onStateChange={onStateChange}
			program={work.result.program}
		/>
	);
}
