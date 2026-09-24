import { Fragment, type ReactNode } from "react";
import type {
	PaperCollageLayoutVariant,
	PaperCollagePagePlan,
} from "../../../../booklet/families/paperCollage";
import type { AssembledPage } from "../../../../booklet/program/assemblePages";
import type {
	AnyLocalPage,
	AnySceneSpec,
	BodyLocalPage,
	SceneSpec,
	TitleMeasurement,
} from "../../../../booklet/program/model";
import { MODULE_CAPABILITIES } from "../../../../booklet/program/moduleCapabilities";
import { paginatePaperCollageScene } from "../../../../booklet/program/modules/paperCollage";
import { sceneBooklet } from "../../../../booklet/program/modules/scenePages";
import { paperCollagePaletteFor } from "../../../../theme/families/paperCollage";
import { prepareFamilyDecorPages } from "../../families/familyDecor";
import {
	collectPaperCollageMeasurement,
	measurePaperCollageCoverTitle,
	PAPER_COLLAGE_CARD_WIDTHS,
	PaperCollageCover,
	PaperCollageDayHeader,
	PaperCollageDayMeasurementSample,
	PaperCollageDayPage,
	PaperCollageDecor,
	PaperCollageMeasurementBody,
	paperCollageDecorationsByPage,
	paperCollageStyleFor,
	paperCollageTitleSizes,
} from "../../families/PaperCollage";
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
 * Style of one paper scene: the direction bundle, or a registered profile on
 * the regression path (its palette, fonts, photo/rule treatments and decor).
 */
function paperSceneStyle(
	spec: SceneSpec<"paper-collage">,
	context: SceneRenderContext,
) {
	const { config } = spec.scene;
	const profile = config.styleProfileId
		? familyProfileById("paper-collage", config.styleProfileId)
		: null;
	const bundle = context.style.surface;
	const typography = profile ?? familyTypographyFromBundle(bundle);
	return {
		className: `paper-collage paper-collage--${config.compositionId}`,
		decor: profile
			? {
					compositionId: config.compositionId,
					decorAssetIds: profile.decorAssetIds,
					familyId: "paper-collage" as const,
					seedToken: context.seedToken,
				}
			: null,
		titleSizes: paperCollageTitleSizes(
			profile?.fontSizesPt.title ?? bundle.displayFontSizePt,
		),
		typography,
		vars: paperCollageStyleFor({
			compositionId: config.compositionId,
			palette: profile
				? paperCollagePaletteFor(profile.paletteId)
				: familyPaletteFromBundle("paper-collage", bundle),
			photoTreatment: profile?.photoTreatment ?? "none",
			ruleTreatment: profile?.ruleTreatment ?? "none",
			typography,
		}),
	};
}

/**
 * The family's card fallback chosen by the paginator. A transplanted body has
 * none and is drawn in the family's first-page frame (photo header).
 */
function layoutVariantOf(value: string | null): PaperCollageLayoutVariant {
	if (value === null || value === "selected") return "selected";
	if (value === "compact-header" || value === "wide-cards") return value;
	throw new Error(`paper-collageの構図退避「${value}」は未登録です。`);
}

function bodyPageOf(page: AnyLocalPage): BodyLocalPage | null {
	return page.kind === "first" || page.kind === "continuation" ? page : null;
}

function familyPlanOf(
	pageId: string,
	page: AnyLocalPage,
	spec: AnySceneSpec,
): PaperCollagePagePlan {
	if (page.kind === "cover") return { kind: "cover", pageId };
	const body = bodyPageOf(page);
	if (!body)
		throw new Error(`paper-collageは「${page.kind}」ページを描けません。`);
	const units = spec.content.ownedUnits;
	const indexOf = (unitId: string) => {
		const index = units.findIndex((unit) => unit.id === unitId);
		if (index < 0)
			throw new Error(
				`scene「${spec.scene.sceneId}」は予定「${unitId}」を持ちません。`,
			);
		return index;
	};
	return {
		columns: body.columns.map((column) => column.map(indexOf)),
		continuation: body.kind === "continuation",
		dayIndex: 0,
		kind: "day",
		layoutVariant: layoutVariantOf(body.layoutVariant),
		pageId,
	};
}

function sectionLabelOf(spec: SceneSpec<"paper-collage">): ReactNode {
	return spec.scene.config.heading.system ? null : (
		<SectionLabel scene={spec.scene} />
	);
}

function dayImageOf(spec: SceneSpec<"paper-collage">): ReactNode | undefined {
	const { booklet, day } = spec.content;
	return transplantedImage(
		spec,
		day?.illustration ?? booklet.cover.image,
		`${booklet.cover.title}の旅のイメージ`,
		day?.date ?? null,
	);
}

/**
 * The first page draws the photo header, continuation pages the compact one;
 * a scene may use both, so the one that fits worse is reported.
 */
function tighterHeading(
	first: TitleMeasurement,
	continuation: TitleMeasurement,
): TitleMeasurement {
	const overflowOf = (heading: TitleMeasurement) =>
		Math.max(
			heading.contentHeightMm - heading.reservedHeightMm,
			heading.contentWidthMm - heading.reservedWidthMm,
		);
	return overflowOf(continuation) > overflowOf(first) ? continuation : first;
}

function PaperStructuredFrame({
	context,
	continuation,
	page,
	spec,
}: {
	readonly context: SceneRenderContext;
	readonly continuation: boolean;
	readonly page: BodyLocalPage | null;
	readonly spec: SceneSpec<"paper-collage">;
}) {
	const day = spec.content.day;
	if (!day) return null;
	return (
		<>
			<PaperCollageDayHeader
				booklet={spec.content.booklet}
				day={day}
				page={{ continuation, layoutVariant: "selected" }}
				slots={{
					heading: transplantedHeading(spec, context, continuation),
					headingExtra: sectionLabelOf(spec),
					headingMarks: page ? effectMarks(spec.scene, "heading") : undefined,
					image: dayImageOf(spec),
					imageMarks: page ? effectMarks(spec.scene, "image") : undefined,
				}}
			/>
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
	readonly spec: SceneSpec<"paper-collage">;
}) {
	const style = paperSceneStyle(spec, context);
	const compositionId = spec.scene.config.compositionId;
	const measurePage = (
		kind: "cover" | "first" | "continuation",
		localPageId: string,
		children: ReactNode,
	) => (
		<ProgramPage
			className={`paper-collage-page paper-collage-page--${kind === "cover" ? "cover" : "day"}`}
			familyStyle={style.vars}
			mode="measurement"
			page={{ compositionId, kind, localPageId }}
			spec={spec}
			style={context.style}
		>
			<div className="booklet-page__content">{children}</div>
		</ProgramPage>
	);
	if (spec.scene.kind === "cover")
		return (
			<FamilySceneRoot className={style.className} style={style.vars}>
				{measurePage(
					"cover",
					"measure",
					<PaperCollageCover
						booklet={spec.content.booklet}
						measurement
						titleSizePt={style.titleSizes[0] ?? 22}
						titleSizesPt={style.titleSizes}
					/>,
				)}
			</FamilySceneRoot>
		);
	const day = spec.content.day;
	if (!day) return null;
	if (hasTransplantedBody(spec))
		return (
			<FamilySceneRoot className={style.className} style={style.vars}>
				{measurePage(
					"first",
					"measure-first",
					<PaperStructuredFrame
						context={context}
						continuation={false}
						page={null}
						spec={spec}
					/>,
				)}
				{measurePage(
					"continuation",
					"measure-continuation",
					<PaperStructuredFrame
						context={context}
						continuation
						page={null}
						spec={spec}
					/>,
				)}
				{measurePage(
					"continuation",
					"measure-stack",
					<FamilyStructuredStack
						bodyWidthMm={FAMILY_BODY_WIDTH_MM}
						spec={spec}
					/>,
				)}
			</FamilySceneRoot>
		);
	const header = (continuation: boolean) => (
		<PaperCollageDayHeader
			booklet={spec.content.booklet}
			day={day}
			page={{ continuation, layoutVariant: "selected" }}
			slots={{
				heading: transplantedHeading(spec, context, continuation),
				headingExtra: sectionLabelOf(spec),
				image: dayImageOf(spec),
			}}
		/>
	);
	// Body frames and card stacks sit on their own pages so no flex layout
	// shrinks them below the family's reserved heights.
	return (
		<FamilySceneRoot className={style.className} style={style.vars}>
			{measurePage("first", "measure-first", header(false))}
			{measurePage("continuation", "measure-continuation", header(true))}
			{measurePage(
				"first",
				"measure-first-body",
				<PaperCollageMeasurementBody frame="first" />,
			)}
			{measurePage(
				"continuation",
				"measure-continuation-body",
				<PaperCollageMeasurementBody frame="continuation" />,
			)}
			{PAPER_COLLAGE_CARD_WIDTHS.map((width) => (
				<Fragment key={width}>
					{measurePage(
						"continuation",
						`measure-cards-${width}`,
						<PaperCollageDayMeasurementSample
							day={day}
							dayIndex={0}
							width={width}
						/>,
					)}
				</Fragment>
			))}
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
	readonly spec: SceneSpec<"paper-collage">;
}) {
	const style = paperSceneStyle(spec, context);
	const booklet = spec.content.booklet;
	return (
		<FamilySceneRoot className={style.className} style={style.vars}>
			{assembled.map((item) => {
				const page = item.page;
				const body = bodyPageOf(page);
				const familyPlan = familyPlanOf(item.pageId, page, spec);
				return (
					<ProgramPage
						className={`paper-collage-page paper-collage-page--${familyPlan.kind}`}
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
							<PaperCollageDecor
								design={style.decor}
								page={familyPlan}
								scope="output"
							/>
						) : null}
						<div className="booklet-page__content">
							{familyPlan.kind === "cover" ? (
								<PaperCollageCover
									booklet={booklet}
									measurement={false}
									slots={{
										image: transplantedImage(
											spec,
											booklet.cover.image,
											`${booklet.cover.title}の旅のイメージ`,
											booklet.cover.period.start_date,
										),
										imageMarks: effectMarks(spec.scene, "cover", "image"),
										titleMarks: effectMarks(spec.scene, "heading"),
									}}
									titleSizePt={
										(page.kind === "cover" ? page.titleSizePt : null) ??
										style.titleSizes[0] ??
										22
									}
									titleSizesPt={style.titleSizes}
								/>
							) : body && hasTransplantedBody(spec) ? (
								<PaperStructuredFrame
									context={context}
									continuation={body.kind === "continuation"}
									page={body}
									spec={spec}
								/>
							) : (
								<PaperCollageDayPage
									booklet={sceneBooklet(spec)}
									page={familyPlan}
									slots={{
										bodyMarks: effectMarks(spec.scene, "body"),
										heading: transplantedHeading(
											spec,
											context,
											familyPlan.continuation,
										),
										headingExtra: sectionLabelOf(spec),
										headingMarks: effectMarks(spec.scene, "heading"),
										image: dayImageOf(spec),
										imageMarks: effectMarks(spec.scene, "image"),
									}}
								/>
							)}
						</div>
					</ProgramPage>
				);
			})}
		</FamilySceneRoot>
	);
}

/**
 * paper-collage, extracted from the family: cover and one day per scene with
 * the family's geometry, card fallback (selected → compact-header →
 * wide-cards) and title step-down.
 */
export const PAPER_COLLAGE_MODULE: ModuleRegistration<"paper-collage"> = {
	capabilities: MODULE_CAPABILITIES["paper-collage"],
	Measure,
	measure: (root, spec, context) => {
		const style = paperSceneStyle(spec, context);
		if (spec.scene.kind === "cover") {
			const titleSizePt = measurePaperCollageCoverTitle(root, style.titleSizes);
			const title = requireElement(
				root,
				`[data-paper-collage-cover-title-size="${titleSizePt}"]`,
				"表紙の題名",
			);
			const period = requireElement(
				root,
				".paper-collage-cover__period",
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
		const headingOf = (localPageId: string, name: string) =>
			headingMeasurementOf(
				requireElement(
					root,
					`[data-local-page-id="${localPageId}"] .paper-collage-day-header__heading`,
					name,
				),
			);
		const heading = tighterHeading(
			headingOf("measure-first", "初頁の日見出し"),
			headingOf("measure-continuation", "継続頁の日見出し"),
		);
		if (hasTransplantedBody(spec))
			return measureFamilyStructured(root, spec, heading);
		return {
			heading,
			kind: "day",
			measurement: collectPaperCollageMeasurement(root, sceneBooklet(spec)),
			styleKey: spec.styleKey,
		};
	},
	moduleId: "paper-collage",
	Pages,
	paginate: paginatePaperCollageScene,
	resources: (spec, context) => ({
		artworkIds: [],
		fonts: familySceneFonts(
			paperSceneStyle(spec, context).typography,
			spec,
			context,
		),
	}),
	// The profile path draws the family's decor; it must match its placement.
	validateOutput: (pages, spec, plan, context) => {
		const decor = paperSceneStyle(spec, context).decor;
		if (!decor) return;
		const familyPlans = plan.pages.map((page, index) =>
			familyPlanOf(pages[index]?.dataset.pageId ?? "", page, spec),
		);
		prepareFamilyDecorPages(
			pages,
			decor,
			paperCollageDecorationsByPage(
				familyPlans,
				spec.scene.config.compositionId,
			),
		);
	},
};
