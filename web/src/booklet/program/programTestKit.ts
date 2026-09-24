/**
 * Test-only builders for program tests. Production code never imports this
 * file; it compiles real programs with reviewed test artwork.
 */
import { compileBooklet } from "../../theme/composition/compileBooklet";
import {
	scriptedRandom,
	testCatalog,
	testModel,
} from "../../theme/composition/compositionTestKit";
import type { AxisRandom } from "../../theme/composition/types";
import type {
	DirectionId,
	DirectionModuleId,
} from "../../theme/directions/types";
import type { BookletModel } from "../model";
import type {
	AnySceneSpec,
	BodyMeasurement,
	BookletProgram,
	CoverMeasurement,
	ExtraMeasurement,
	SceneSpec,
	TitleMeasurement,
} from "./model";
import { isSpecOfModule } from "./model";
import { buildSceneSpecs } from "./sceneSpec";

export function compiledProgram(
	directionIds: readonly DirectionId[],
	model: BookletModel = testModel(),
	random: AxisRandom = scriptedRandom({ steps: 0 }),
): BookletProgram {
	const result = compileBooklet(
		model,
		{ seed: { value: 1, version: "v2" } },
		testCatalog(directionIds),
		{ random },
	);
	if (result.status !== "compiled") throw new Error(result.message);
	return result.program;
}

export function specsFor(
	program: BookletProgram,
	model: BookletModel = testModel(),
): readonly AnySceneSpec[] {
	return buildSceneSpecs(program, model);
}

export function specById(
	specs: readonly AnySceneSpec[],
	sceneId: string,
): AnySceneSpec {
	const spec = specs.find((item) => item.scene.sceneId === sceneId);
	if (!spec) throw new Error(`scene「${sceneId}」がありません。`);
	return spec;
}

/** The scene's spec, verified to be drawn by `moduleId`. */
export function moduleSpec<M extends DirectionModuleId>(
	specs: readonly AnySceneSpec[],
	sceneId: string,
	moduleId: M,
): SceneSpec<M> {
	const spec = specById(specs, sceneId);
	if (!isSpecOfModule(spec, moduleId))
		throw new Error(`scene「${sceneId}」は${moduleId}ではありません。`);
	return spec;
}

export function fits(widthMm = 100, heightMm = 10): TitleMeasurement {
	return {
		contentHeightMm: heightMm,
		contentWidthMm: widthMm,
		reservedHeightMm: heightMm,
		reservedWidthMm: widthMm,
	};
}

export function coverMeasurement(
	spec: AnySceneSpec,
	overrides: Partial<CoverMeasurement> = {},
): CoverMeasurement {
	return {
		kind: "cover",
		period: fits(),
		styleKey: spec.styleKey,
		title: fits(),
		titleSizePt: null,
		...overrides,
	};
}

export function bodyMeasurement(
	spec: AnySceneSpec,
	unitHeightMm: number | readonly number[],
	textWidthMm: number,
	overrides: Partial<BodyMeasurement> = {},
): BodyMeasurement {
	const units = spec.content.ownedUnits;
	return {
		emptyHeightMm: 8,
		heading: fits(),
		kind: "day",
		styleKey: spec.styleKey,
		textWidthMm,
		unitHeightsMm:
			typeof unitHeightMm === "number"
				? units.map(() => unitHeightMm)
				: unitHeightMm,
		...overrides,
	};
}

export function extraMeasurement(
	spec: AnySceneSpec,
	kind: ExtraMeasurement["kind"],
	entryHeightsMm: readonly number[],
): ExtraMeasurement {
	return {
		entryHeightsMm,
		heading: fits(),
		kind,
		styleKey: spec.styleKey,
	};
}
