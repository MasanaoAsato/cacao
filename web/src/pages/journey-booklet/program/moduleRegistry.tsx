import type { ComponentType, ReactNode } from "react";
import type { AssembledPage } from "../../../booklet/program/assemblePages";
import {
	type AnyScenePlan,
	type AnySceneSpec,
	isSpecOfModule,
	type SceneMeasurementByModule,
	type ScenePaginator,
	type ScenePlan,
	type SceneSpec,
} from "../../../booklet/program/model";
import {
	MODULE_CAPABILITIES,
	type ModuleCapability,
} from "../../../booklet/program/moduleCapabilities";
import type { DirectionModuleId } from "../../../theme/directions/types";
import type { SceneRenderContext } from "./sceneParts";
import type { FontRequirement } from "./sceneStyle";

/** What a scene waits for before it may be measured. */
export type SceneResources = {
	/** Frozen artwork IDs only; the catalog is never preloaded. */
	readonly artworkIds: readonly string[];
	readonly fonts: readonly FontRequirement[];
};

export type SceneMeasureProps<M extends DirectionModuleId> = {
	readonly context: SceneRenderContext;
	readonly spec: SceneSpec<M>;
};

export type ScenePagesProps<M extends DirectionModuleId> = {
	/** This scene's pages after concatenation, in order. */
	readonly assembled: readonly AssembledPage[];
	readonly context: SceneRenderContext;
	readonly plan: ScenePlan<M>;
	readonly spec: SceneSpec<M>;
};

/**
 * One drawing module (25.4): measurement DOM and `measure` read the same
 * parts, width and CSS as `Pages`; `paginate` is the DOM-free split.
 */
export type ModuleRegistration<M extends DirectionModuleId> = {
	readonly capabilities: ModuleCapability;
	readonly Measure: ComponentType<SceneMeasureProps<M>>;
	readonly measure: (
		root: HTMLElement,
		spec: SceneSpec<M>,
		context: SceneRenderContext,
	) => SceneMeasurementByModule[M];
	readonly moduleId: M;
	readonly Pages: ComponentType<ScenePagesProps<M>>;
	readonly paginate: ScenePaginator<M>;
	readonly resources: (
		spec: SceneSpec<M>,
		context: SceneRenderContext,
	) => SceneResources;
	/** Module-specific checks on the drawn pages of this scene. */
	readonly validateOutput: (
		pages: readonly HTMLElement[],
		spec: SceneSpec<M>,
		plan: ScenePlan<M>,
		context: SceneRenderContext,
	) => void;
};

export type ModuleRegistry = {
	readonly [M in DirectionModuleId]: ModuleRegistration<M>;
};

/** A scene whose local plan exists; rendering and checks keep its types. */
export type PlannedScene = {
	readonly plan: AnyScenePlan;
	readonly render: (
		assembled: readonly AssembledPage[],
		context: SceneRenderContext,
	) => ReactNode;
	readonly validateOutput: (pages: readonly HTMLElement[]) => void;
};

/** A scene bound to exactly its own module registration. */
export type BoundScene = {
	readonly measureAndPlan: (
		root: HTMLElement,
		context: SceneRenderContext,
	) => PlannedScene;
	readonly renderMeasure: (context: SceneRenderContext) => ReactNode;
	readonly resources: (context: SceneRenderContext) => SceneResources;
	readonly spec: AnySceneSpec;
};

function bind<M extends DirectionModuleId>(
	spec: SceneSpec<M>,
	registration: ModuleRegistration<M>,
): BoundScene {
	const { Measure, Pages } = registration;
	return {
		measureAndPlan: (root, context) => {
			const plan = registration.paginate(
				spec,
				registration.measure(root, spec, context),
			);
			return {
				plan,
				render: (assembled, renderContext) => (
					<Pages
						assembled={assembled}
						context={renderContext}
						key={spec.scene.sceneId}
						plan={plan}
						spec={spec}
					/>
				),
				validateOutput: (pages) =>
					registration.validateOutput(pages, spec, plan, context),
			};
		},
		renderMeasure: (context) => <Measure context={context} spec={spec} />,
		resources: (context) => registration.resources(spec, context),
		spec,
	};
}

/**
 * The only place a spec meets a module. Each branch narrows the spec with a
 * runtime check of its own module ID, so no cast connects them.
 */
export function bindScene(
	spec: AnySceneSpec,
	registry: ModuleRegistry,
): BoundScene {
	if (isSpecOfModule(spec, "atlas-grid"))
		return bind(spec, registry["atlas-grid"]);
	if (isSpecOfModule(spec, "editorial-magazine"))
		return bind(spec, registry["editorial-magazine"]);
	if (isSpecOfModule(spec, "ledger")) return bind(spec, registry.ledger);
	if (isSpecOfModule(spec, "paper-collage"))
		return bind(spec, registry["paper-collage"]);
	if (isSpecOfModule(spec, "photo-essay"))
		return bind(spec, registry["photo-essay"]);
	if (isSpecOfModule(spec, "playful-route"))
		return bind(spec, registry["playful-route"]);
	if (isSpecOfModule(spec, "quest-board"))
		return bind(spec, registry["quest-board"]);
	if (isSpecOfModule(spec, "schematic-map"))
		return bind(spec, registry["schematic-map"]);
	if (isSpecOfModule(spec, "specimen-board"))
		return bind(spec, registry["specimen-board"]);
	if (isSpecOfModule(spec, "travel-newspaper"))
		return bind(spec, registry["travel-newspaper"]);
	if (isSpecOfModule(spec, "vertical-poster"))
		return bind(spec, registry["vertical-poster"]);
	if (isSpecOfModule(spec, "woodcut-folio"))
		return bind(spec, registry["woodcut-folio"]);
	throw new Error(`module「${spec.scene.moduleId}」が登録されていません。`);
}

/** Registrations must cover all twelve modules and agree with their capabilities. */
export function createModuleRegistry(registry: ModuleRegistry): ModuleRegistry {
	for (const [moduleId, registration] of Object.entries(registry)) {
		if (registration.moduleId !== moduleId)
			throw new Error(
				`module「${moduleId}」に別module「${registration.moduleId}」が登録されています。`,
			);
		if (
			registration.capabilities !== MODULE_CAPABILITIES[registration.moduleId]
		)
			throw new Error(
				`module「${moduleId}」のcapabilitiesが共有定義と一致しません。`,
			);
	}
	const missing = (
		Object.keys(MODULE_CAPABILITIES) as DirectionModuleId[]
	).filter((moduleId) => !(moduleId in registry));
	if (missing.length > 0)
		throw new Error(`module「${missing.join("、")}」が未登録です。`);
	return Object.freeze({ ...registry });
}
