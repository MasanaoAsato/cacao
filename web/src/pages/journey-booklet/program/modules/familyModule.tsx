import type { CSSProperties, ReactNode } from "react";
import { bodyStructureFor } from "../../../../booklet/program/bodyStructures";
import type {
	AnySceneSpec,
	BodyLocalPage,
	StructuredBodyMeasurement,
	TitleMeasurement,
} from "../../../../booklet/program/model";
import { BookletLayoutError } from "../../layoutError";
import {
	closestPage,
	pageScaleOf,
	requireElement,
	titleMeasurementOf,
} from "../measureDom";
import {
	DayHeading,
	effectMarks,
	type SceneRenderContext,
	TreatedImageFill,
} from "../sceneParts";
import type { FontRequirement } from "../sceneStyle";
import {
	readMeasureStack,
	StructuredColumns,
	StructuredMeasureStack,
} from "../structuredModule";
import type { FamilyTypography } from "./familyStyle";
import { typographyFonts } from "./familyStyle";

/**
 * The family's root classes and variables for one scene. It does not create
 * a box (`display: contents`), so pages still flow in the shared document,
 * while the family CSS stays scoped to this scene.
 */
export function FamilySceneRoot({
	children,
	className,
	style,
}: {
	readonly children: ReactNode;
	readonly className: string;
	readonly style: CSSProperties;
}) {
	return (
		<div className={`program-scene booklet-theme ${className}`} style={style}>
			{children}
		</div>
	);
}

/**
 * The family's own fonts plus the scene bundle's: the running page number,
 * section labels and any transplanted part draw with the bundle.
 */
export function familySceneFonts(
	typography: FamilyTypography,
	_spec: AnySceneSpec,
	context: SceneRenderContext,
): readonly FontRequirement[] {
	const fonts = new Map(
		[...typographyFonts(typography), ...context.style.fonts].map((font) => [
			`${font.weight} ${font.family}`,
			font,
		]),
	);
	return [...fonts.values()];
}

/** A transplanted heading system replaces the family heading in its own slot. */
export function transplantedHeading(
	spec: AnySceneSpec,
	context: SceneRenderContext,
	continuation: boolean,
): ReactNode | undefined {
	return spec.scene.config.heading.system ? (
		<DayHeading
			context={context}
			continuation={continuation}
			spec={spec}
			vertical={false}
		/>
	) : undefined;
}

/** A transplanted image treatment inside the family's own figure. */
export function transplantedImage(
	spec: AnySceneSpec,
	image: import("../../../../booklet/model").BookletImage | null,
	alt: string,
	captionDate: string | null,
): ReactNode | undefined {
	const treatment = spec.scene.config.imageTreatment?.treatment;
	return treatment && image ? (
		<TreatedImageFill
			alt={alt}
			captionDate={captionDate}
			image={image}
			treatment={treatment}
		/>
	) : undefined;
}

export function hasTransplantedBody(spec: AnySceneSpec): boolean {
	return (
		spec.scene.kind === "day" && spec.scene.config.contentStructure !== null
	);
}

function structureFor(spec: AnySceneSpec, bodyWidthMm: number) {
	const structure = bodyStructureFor(spec.scene, bodyWidthMm);
	if (!structure)
		throw new BookletLayoutError(
			"dom-not-ready",
			`scene「${spec.scene.sceneId}」の移植構造がありません。`,
		);
	return structure;
}

/**
 * The family's body container holding a transplanted content structure.
 * It fills the space the family leaves for its body on this page.
 */
export function FamilyStructuredBody({
	bodyWidthMm,
	frame,
	page,
	spec,
}: {
	readonly bodyWidthMm: number;
	/** Which measurement frame this container belongs to. */
	readonly frame: "first" | "continuation";
	readonly page: BodyLocalPage | null;
	readonly spec: AnySceneSpec;
}) {
	const structure = structureFor(spec, bodyWidthMm);
	return (
		<div
			className={`program-family-body program-body--${structure.id}`}
			data-program-family-body={frame}
			data-program-region="body"
			{...(page ? effectMarks(spec.scene, "body") : {})}
		>
			{page ? (
				<StructuredColumns
					bodyWidthMm={bodyWidthMm}
					page={page}
					spec={spec}
					structure={structure}
				/>
			) : null}
		</div>
	);
}

/** The stack of units to measure at the family body's width. */
export function FamilyStructuredStack({
	bodyWidthMm,
	spec,
}: {
	readonly bodyWidthMm: number;
	readonly spec: AnySceneSpec;
}) {
	return (
		<div className="program-family-body" data-program-family-stack="true">
			<StructuredMeasureStack
				bodyWidthMm={bodyWidthMm}
				spec={spec}
				structure={structureFor(spec, bodyWidthMm)}
			/>
		</div>
	);
}

function heightOfContainerMm(element: HTMLElement): number {
	return element.clientHeight * pageScaleOf(closestPage(element));
}

/**
 * A transplanted structure inside an extracted family: capacities are the
 * family's empty body containers on the first and continuation frames.
 */
export function measureFamilyStructured(
	root: HTMLElement,
	spec: AnySceneSpec,
	heading: TitleMeasurement,
): StructuredBodyMeasurement {
	const first = requireElement(
		root,
		'[data-program-family-body="first"]',
		"初頁の本文領域",
	);
	const continuation = requireElement(
		root,
		'[data-program-family-body="continuation"]',
		"継続頁の本文領域",
	);
	const stack = readMeasureStack(
		requireElement(root, "[data-program-family-stack]", "計測用の予定列"),
	);
	return {
		...stack,
		bodyWidthMm:
			first.getBoundingClientRect().width * pageScaleOf(closestPage(first)),
		continuationCapacityMm: heightOfContainerMm(continuation),
		firstCapacityMm: heightOfContainerMm(first),
		heading,
		kind: "structured-day",
		styleKey: spec.styleKey,
	};
}

/** A heading region that grows with its content always reports what it holds. */
export function headingMeasurementOf(element: HTMLElement): TitleMeasurement {
	return titleMeasurementOf(element, element);
}
