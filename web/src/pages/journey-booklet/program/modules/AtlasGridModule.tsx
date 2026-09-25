import type { ReactNode } from "react";
import type { AtlasGridPagePlan } from "../../../../booklet/families/atlasGrid";
import type { AssembledPage } from "../../../../booklet/program/assemblePages";
import type {
	AnySceneSpec,
	BodyLocalPage,
	SceneSpec,
} from "../../../../booklet/program/model";
import { MODULE_CAPABILITIES } from "../../../../booklet/program/moduleCapabilities";
import { paginateAtlasGridScene } from "../../../../booklet/program/modules/atlasGrid";
import { sceneBooklet } from "../../../../booklet/program/modules/scenePages";
import { atlasGridPaletteFor } from "../../../../theme/families/atlasGrid";
import {
	AtlasCover,
	AtlasDayBand,
	AtlasDayMeasurementSample,
	AtlasDecor,
	AtlasTableHeader,
	AtlasTablePage,
	atlasDecorationsByPage,
	atlasStyleFor,
	atlasTitleSizes,
	collectAtlasTableMeasurement,
	measureAtlasCoverTitle,
} from "../../families/AtlasGrid";
import { prepareFamilyDecorPages } from "../../families/familyDecor";
import { requireElement, titleMeasurementOf } from "../measureDom";
import type { ModuleRegistration } from "../moduleRegistry";
import {
	effectMarks,
	ProgramPage,
	type SceneRenderContext,
	SectionLabel,
} from "../sceneParts";
import {
	FamilySceneRoot,
	FamilyStructuredBody,
	FamilyStructuredStack,
	familySceneFonts,
	hasTransplantedBody,
	headingMeasurementOf,
	measureFamilyStructured,
	transplantedHeading,
	transplantedImage,
} from "./familyModule";
import {
	familyPaletteFromBundle,
	familyProfileById,
	familyTypographyFromBundle,
} from "./familyStyle";

/** Every extracted family keeps 10mm margins, so its body is 128mm wide. */
const FAMILY_BODY_WIDTH_MM = 128;

/**
 * Style of one atlas scene: the direction bundle, or a registered profile on
 * the regression path (its palette, fonts and decor).
 */
function atlasSceneStyle(
	spec: SceneSpec<"atlas-grid">,
	context: SceneRenderContext,
) {
	const { config } = spec.scene;
	const profile = config.styleProfileId
		? familyProfileById("atlas-grid", config.styleProfileId)
		: null;
	const bundle = context.style.surface;
	const typography = profile ?? familyTypographyFromBundle(bundle);
	const input = {
		compositionId: config.compositionId,
		palette: profile
			? atlasGridPaletteFor(profile.paletteId)
			: familyPaletteFromBundle("atlas-grid", bundle),
		photoTreatment: profile?.photoTreatment ?? "none",
		ruleTreatment: profile?.ruleTreatment ?? "fine",
		typography,
	};
	return {
		className: `atlas-grid atlas-grid--${config.compositionId}`,
		decor: profile
			? {
					compositionId: config.compositionId,
					decorAssetIds: profile.decorAssetIds,
					familyId: "atlas-grid" as const,
					seedToken: context.seedToken,
				}
			: null,
		titleSizes: atlasTitleSizes(
			profile?.fontSizesPt.title ?? bundle.displayFontSizePt,
		),
		typography,
		vars: atlasStyleFor(input),
	};
}

function familyPlanOf(
	pageId: string,
	page: BodyLocalPage | null,
	spec: AnySceneSpec,
): AtlasGridPagePlan {
	if (!page) return { kind: "cover", pageId };
	const units = spec.content.ownedUnits;
	return {
		kind: "table",
		pageId,
		sections: [
			{
				continuation: page.kind === "continuation",
				dayIndex: 0,
				unitIndexes: page.unitIds.map((id) =>
					units.findIndex((unit) => unit.id === id),
				),
			},
		],
	};
}

function AtlasStructuredFrame({
	context,
	continuation,
	page,
	spec,
}: {
	readonly context: SceneRenderContext;
	readonly continuation: boolean;
	readonly page: BodyLocalPage | null;
	readonly spec: SceneSpec<"atlas-grid">;
}) {
	const day = spec.content.day;
	return (
		<>
			<AtlasTableHeader
				continuation={continuation}
				extra={
					spec.scene.config.heading.system ? null : (
						<SectionLabel scene={spec.scene} />
					)
				}
				heading={transplantedHeading(spec, context, continuation)}
				marks={page ? effectMarks(spec.scene, "heading") : undefined}
			/>
			{day ? (
				<table className="atlas-grid-table">
					<tbody>
						<AtlasDayBand continuation={continuation} day={day} />
					</tbody>
				</table>
			) : null}
			<FamilyStructuredBody
				bodyWidthMm={FAMILY_BODY_WIDTH_MM}
				frame={continuation ? "continuation" : "first"}
				page={page}
				spec={spec}
			/>
		</>
	);
}

function Measure({
	context,
	spec,
}: {
	readonly context: SceneRenderContext;
	readonly spec: SceneSpec<"atlas-grid">;
}) {
	const style = atlasSceneStyle(spec, context);
	const probe = {
		compositionId: spec.scene.config.compositionId,
		localPageId: "measure",
	};
	if (spec.scene.kind === "cover")
		return (
			<FamilySceneRoot className={style.className} style={style.vars}>
				<ProgramPage
					context={context}
					className="atlas-grid-page atlas-grid-page--cover"
					familyStyle={style.vars}
					mode="measurement"
					page={{ ...probe, kind: "cover" }}
					spec={spec}
					style={context.style}
				>
					<div className="booklet-page__content">
						<AtlasCover
							booklet={spec.content.booklet}
							compositionId={spec.scene.config.compositionId}
							measurement
							titleSizePt={style.titleSizes[0] ?? 22}
							titleSizesPt={style.titleSizes}
						/>
					</div>
				</ProgramPage>
			</FamilySceneRoot>
		);
	const day = spec.content.day;
	if (!day) return null;
	const tablePage = (children: ReactNode, kind: "first" | "continuation") => (
		<ProgramPage
			context={context}
			className="atlas-grid-page atlas-grid-page--table"
			familyStyle={style.vars}
			mode="measurement"
			page={{ ...probe, kind, localPageId: `measure-${kind}` }}
			spec={spec}
			style={context.style}
		>
			<div className="booklet-page__content">{children}</div>
		</ProgramPage>
	);
	return (
		<FamilySceneRoot className={style.className} style={style.vars}>
			{hasTransplantedBody(spec) ? (
				<>
					{tablePage(
						<AtlasStructuredFrame
							context={context}
							continuation={false}
							page={null}
							spec={spec}
						/>,
						"first",
					)}
					{tablePage(
						<AtlasStructuredFrame
							context={context}
							continuation
							page={null}
							spec={spec}
						/>,
						"continuation",
					)}
					{tablePage(
						<FamilyStructuredStack
							bodyWidthMm={FAMILY_BODY_WIDTH_MM}
							spec={spec}
						/>,
						"continuation",
					)}
				</>
			) : (
				<div data-atlas-grid-measurement-day="0">
					{tablePage(
						<AtlasDayMeasurementSample
							day={day}
							dayIndex={0}
							heading={transplantedHeading(spec, context, false)}
						/>,
						"first",
					)}
				</div>
			)}
		</FamilySceneRoot>
	);
}

function Pages({
	assembled,
	context,
	spec,
}: {
	readonly assembled: readonly AssembledPage[];
	readonly context: SceneRenderContext;
	readonly spec: SceneSpec<"atlas-grid">;
}) {
	const style = atlasSceneStyle(spec, context);
	const booklet = spec.content.booklet;
	return (
		<FamilySceneRoot className={style.className} style={style.vars}>
			{assembled.map((item) => {
				const page = item.page;
				const body =
					page.kind === "first" || page.kind === "continuation" ? page : null;
				const familyPlan = familyPlanOf(item.pageId, body, spec);
				return (
					<ProgramPage
						context={context}
						className={`atlas-grid-page atlas-grid-page--${familyPlan.kind}`}
						familyStyle={style.vars}
						key={item.pageId}
						mode="output"
						page={page}
						pageId={item.pageId}
						pageNumber={item.pageNumber}
						spec={spec}
						style={context.style}
					>
						{style.decor ? (
							<AtlasDecor
								design={style.decor}
								page={familyPlan}
								scope="output"
							/>
						) : null}
						<div className="booklet-page__content">
							{page.kind === "cover" ? (
								<AtlasCover
									booklet={booklet}
									compositionId={spec.scene.config.compositionId}
									measurement={false}
									slots={{
										image: transplantedImage(
											spec,
											booklet.cover.image,
											`${booklet.cover.title}の表紙画像`,
											booklet.cover.period.start_date,
										),
										imageMarks: effectMarks(spec.scene, "cover", "image"),
										titleMarks: effectMarks(spec.scene, "heading"),
									}}
									titleSizePt={page.titleSizePt ?? style.titleSizes[0] ?? 22}
									titleSizesPt={style.titleSizes}
								/>
							) : body && hasTransplantedBody(spec) ? (
								<AtlasStructuredFrame
									context={context}
									continuation={body.kind === "continuation"}
									page={body}
									spec={spec}
								/>
							) : familyPlan.kind === "table" ? (
								<AtlasTablePage
									booklet={sceneBooklet(spec)}
									page={familyPlan}
									slots={{
										bodyMarks: effectMarks(spec.scene, "body"),
										heading: transplantedHeading(
											spec,
											context,
											body?.kind === "continuation",
										),
										headingExtra: spec.scene.config.heading.system ? null : (
											<SectionLabel scene={spec.scene} />
										),
										headingMarks: effectMarks(spec.scene, "heading"),
									}}
								/>
							) : null}
						</div>
					</ProgramPage>
				);
			})}
		</FamilySceneRoot>
	);
}

/**
 * atlas-grid, extracted from the family: cover and one day per scene with
 * the family's geometry, timetable policy and title step-down.
 */
export const ATLAS_GRID_MODULE: ModuleRegistration<"atlas-grid"> = {
	capabilities: MODULE_CAPABILITIES["atlas-grid"],
	Measure,
	measure: (root, spec, context) => {
		const style = atlasSceneStyle(spec, context);
		if (spec.scene.kind === "cover") {
			const titleSizePt = measureAtlasCoverTitle(root, style.titleSizes);
			const title = requireElement(
				root,
				`[data-atlas-cover-title-size="${titleSizePt}"]`,
				"表紙の題名",
			);
			const period = requireElement(
				root,
				".atlas-grid-cover__period",
				"表紙の期間",
			);
			return {
				kind: "cover",
				period: titleMeasurementOf(period, period),
				styleKey: spec.styleKey,
				title: titleMeasurementOf(title, title),
				titleSizePt,
			};
		}
		const heading = headingMeasurementOf(
			requireElement(root, ".atlas-grid-table__header", "表の見出し"),
		);
		if (hasTransplantedBody(spec))
			return measureFamilyStructured(root, spec, heading);
		return {
			heading,
			kind: "day",
			measurement: collectAtlasTableMeasurement(root, sceneBooklet(spec)),
			styleKey: spec.styleKey,
		};
	},
	moduleId: "atlas-grid",
	Pages,
	paginate: paginateAtlasGridScene,
	resources: (spec, context) => ({
		artworkIds: [],
		fonts: familySceneFonts(
			atlasSceneStyle(spec, context).typography,
			spec,
			context,
		),
	}),
	// The profile path draws the family's decor; it must match its placement.
	validateOutput: (pages, spec, plan, context) => {
		const decor = atlasSceneStyle(spec, context).decor;
		if (!decor) return;
		const familyPlans = plan.pages.map((page, index) =>
			familyPlanOf(
				pages[index]?.dataset.pageId ?? "",
				page.kind === "first" || page.kind === "continuation" ? page : null,
				spec,
			),
		);
		prepareFamilyDecorPages(
			pages,
			decor,
			atlasDecorationsByPage(familyPlans, spec.scene.config.compositionId),
		);
	},
};
