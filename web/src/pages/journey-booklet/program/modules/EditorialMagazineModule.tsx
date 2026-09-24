import type { CSSProperties, ReactNode } from "react";
import type { EditorialMagazinePagePlan } from "../../../../booklet/families/editorialMagazine";
import type { AssembledPage } from "../../../../booklet/program/assemblePages";
import type {
	AnySceneSpec,
	BodyLocalPage,
	LocalPageKind,
	SceneSpec,
} from "../../../../booklet/program/model";
import { MODULE_CAPABILITIES } from "../../../../booklet/program/moduleCapabilities";
import { paginateEditorialMagazineScene } from "../../../../booklet/program/modules/editorialMagazine";
import { sceneBooklet } from "../../../../booklet/program/modules/scenePages";
import { editorialMagazinePaletteFor } from "../../../../theme/families/editorialMagazine";
import {
	collectEditorialMagazineDayMeasurement,
	DayHeader,
	EDITORIAL_MAGAZINE_FONT_WEIGHTS,
	type EditorialMagazineVariant,
	editorialMagazineStyleFor,
	editorialMagazineVariantOf,
	MagazineCover,
	type MagazineDayHeaderSlots,
	MagazineDayMeasurementSample,
	MagazineDayPage,
	magazineBodyHeightMm,
} from "../../families/EditorialMagazine";
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
	type FamilyTypography,
	familyPaletteFromBundle,
	familyProfileById,
	familyTypographyFromBundle,
} from "./familyStyle";

/** Every extracted family keeps 10mm margins, so its body is 128mm wide. */
const FAMILY_BODY_WIDTH_MM = 128;

type MagazineSpec = SceneSpec<"editorial-magazine">;

/**
 * Style of one magazine scene: the direction bundle, or a registered profile
 * on the regression path (its palette, fonts and photo variant).
 */
function magazineSceneStyle(spec: MagazineSpec, context: SceneRenderContext) {
	const { config } = spec.scene;
	const profile = config.styleProfileId
		? familyProfileById("editorial-magazine", config.styleProfileId)
		: null;
	const bundle = context.style.surface;
	const source = profile ?? familyTypographyFromBundle(bundle);
	const typography: FamilyTypography = {
		fontFamilies: source.fontFamilies,
		fontSizesPt: source.fontSizesPt,
		fontWeights: EDITORIAL_MAGAZINE_FONT_WEIGHTS,
	};
	const variant: EditorialMagazineVariant = profile
		? editorialMagazineVariantOf(profile.id)
		: "quiet-photo";
	const vars = editorialMagazineStyleFor({
		compositionId: config.compositionId,
		palette: profile
			? editorialMagazinePaletteFor(profile.paletteId)
			: familyPaletteFromBundle("editorial-magazine", bundle),
		typography,
		variant,
	});
	// The shared page box pads and paints `.booklet-page`; the family page
	// draws its own paper and places everything from the page edge.
	const pageStyle: CSSProperties & Record<`--${string}`, string> = {
		...vars,
		"--booklet-background": "var(--editorial-paper)",
		"--booklet-text": "var(--editorial-ink)",
		padding: 0,
	};
	return {
		className: `editorial-magazine editorial-magazine--${variant}`,
		pageStyle,
		typography,
		vars,
	};
}

function familyPageKind(kind: LocalPageKind): string {
	if (kind === "first") return "article";
	return kind;
}

function familyPlanOf(
	pageId: string,
	page: BodyLocalPage,
	spec: AnySceneSpec,
): Exclude<EditorialMagazinePagePlan, { readonly kind: "cover" }> {
	const units = spec.content.ownedUnits;
	return {
		dayIndex: 0,
		kind: page.kind === "continuation" ? "continuation" : "article",
		pageId,
		unitIndexes: (page.columns[0] ?? []).map((id) =>
			units.findIndex((unit) => unit.id === id),
		),
	};
}

function headerSlots(
	spec: MagazineSpec,
	context: SceneRenderContext,
	continuation: boolean,
	output: boolean,
): MagazineDayHeaderSlots {
	const day = spec.content.day;
	return {
		// The low continuation header only repeats the day; the section shows on the first page.
		extra:
			spec.scene.config.heading.system || continuation ? null : (
				<SectionLabel scene={spec.scene} />
			),
		heading: transplantedHeading(spec, context, continuation),
		illustration: day
			? transplantedImage(spec, day.illustration, "", day.date)
			: undefined,
		illustrationMarks: output ? effectMarks(spec.scene, "image") : undefined,
		marks: output ? effectMarks(spec.scene, "heading") : undefined,
	};
}

/** The family's day header above a transplanted content structure. */
function MagazineStructuredFrame({
	context,
	continuation,
	page,
	spec,
}: {
	readonly context: SceneRenderContext;
	readonly continuation: boolean;
	readonly page: BodyLocalPage | null;
	readonly spec: MagazineSpec;
}) {
	const day = spec.content.day;
	if (!day) return null;
	return (
		<div className="editorial-magazine-page__content">
			<div aria-hidden="true" className="editorial-magazine-page__rule" />
			<DayHeader
				continuation={continuation}
				day={day}
				slots={headerSlots(spec, context, continuation, page !== null)}
			/>
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					height: `${magazineBodyHeightMm(continuation)}mm`,
				}}
			>
				<FamilyStructuredBody
					bodyWidthMm={FAMILY_BODY_WIDTH_MM}
					frame={continuation ? "continuation" : "first"}
					page={page}
					spec={spec}
				/>
			</div>
		</div>
	);
}

function Measure({
	context,
	spec,
}: {
	readonly context: SceneRenderContext;
	readonly spec: MagazineSpec;
}) {
	const style = magazineSceneStyle(spec, context);
	const compositionId = spec.scene.config.compositionId;
	const probe = (
		children: ReactNode,
		kind: "cover" | "first" | "continuation",
	) => (
		<ProgramPage
			className={`editorial-magazine-page editorial-magazine-page--${familyPageKind(kind)}`}
			familyStyle={style.pageStyle}
			mode="measurement"
			page={{ compositionId, kind, localPageId: `measure-${kind}` }}
			spec={spec}
			style={context.style}
		>
			{children}
		</ProgramPage>
	);
	if (spec.scene.kind === "cover")
		return (
			<FamilySceneRoot className={style.className} style={style.vars}>
				{probe(
					<MagazineCover booklet={spec.content.booklet} measurement />,
					"cover",
				)}
			</FamilySceneRoot>
		);
	const day = spec.content.day;
	if (!day) return null;
	return (
		<FamilySceneRoot className={style.className} style={style.vars}>
			{hasTransplantedBody(spec) ? (
				<>
					{probe(
						<MagazineStructuredFrame
							context={context}
							continuation={false}
							page={null}
							spec={spec}
						/>,
						"first",
					)}
					{probe(
						<MagazineStructuredFrame
							context={context}
							continuation
							page={null}
							spec={spec}
						/>,
						"continuation",
					)}
					{probe(
						<div className="editorial-magazine-page__content">
							<FamilyStructuredStack
								bodyWidthMm={FAMILY_BODY_WIDTH_MM}
								spec={spec}
							/>
						</div>,
						"continuation",
					)}
				</>
			) : (
				<div data-editorial-magazine-measurement-day={day.id}>
					{probe(
						<MagazineDayMeasurementSample
							articleSlots={headerSlots(spec, context, false, false)}
							continuationSlots={headerSlots(spec, context, true, false)}
							day={day}
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
	readonly spec: MagazineSpec;
}) {
	const style = magazineSceneStyle(spec, context);
	const booklet = spec.content.booklet;
	const day = spec.content.day;
	return (
		<FamilySceneRoot className={style.className} style={style.vars}>
			{assembled.map((item) => {
				const page = item.page;
				const body =
					page.kind === "first" || page.kind === "continuation" ? page : null;
				return (
					<ProgramPage
						className={`editorial-magazine-page editorial-magazine-page--${familyPageKind(page.kind)}`}
						familyStyle={style.pageStyle}
						key={item.pageId}
						mode="output"
						page={page}
						pageId={item.pageId}
						pageNumber={item.pageNumber}
						spec={spec}
						style={context.style}
					>
						{page.kind === "cover" ? (
							<MagazineCover
								booklet={booklet}
								measurement={false}
								slots={{
									image: transplantedImage(
										spec,
										booklet.cover.image,
										booklet.cover.title,
										booklet.cover.period.start_date,
									),
									imageMarks: effectMarks(spec.scene, "cover", "image"),
									titleMarks: effectMarks(spec.scene, "heading"),
								}}
							/>
						) : body && hasTransplantedBody(spec) ? (
							<MagazineStructuredFrame
								context={context}
								continuation={body.kind === "continuation"}
								page={body}
								spec={spec}
							/>
						) : body && day ? (
							<MagazineDayPage
								day={day}
								page={familyPlanOf(item.pageId, body, spec)}
								slots={{
									...headerSlots(
										spec,
										context,
										body.kind === "continuation",
										true,
									),
									bodyRegion: effectMarks(spec.scene, "body"),
								}}
							/>
						) : null}
					</ProgramPage>
				);
			})}
		</FamilySceneRoot>
	);
}

/**
 * editorial-magazine, extracted from the family: cover and one day per scene
 * with the photo feature's geometry and article cards. Its columns stay its
 * own; they are never merged into a shared card body.
 */
export const EDITORIAL_MAGAZINE_MODULE: ModuleRegistration<"editorial-magazine"> =
	{
		capabilities: MODULE_CAPABILITIES["editorial-magazine"],
		Measure,
		measure: (root, spec) => {
			if (spec.scene.kind === "cover") {
				const title = requireElement(
					root,
					"[data-editorial-magazine-cover-title]",
					"表紙の題名",
				);
				const period = requireElement(
					root,
					".editorial-magazine-cover__period",
					"表紙の期間",
				);
				return {
					kind: "cover",
					period: titleMeasurementOf(period, period),
					styleKey: spec.styleKey,
					title: titleMeasurementOf(title, title),
					titleSizePt: null,
				};
			}
			const heading = headingMeasurementOf(
				requireElement(root, ".editorial-magazine-day-header", "日見出し"),
			);
			if (hasTransplantedBody(spec))
				return measureFamilyStructured(root, spec, heading);
			return {
				heading,
				kind: "day",
				measurement: collectEditorialMagazineDayMeasurement(
					root,
					sceneBooklet(spec),
				),
				styleKey: spec.styleKey,
			};
		},
		moduleId: "editorial-magazine",
		Pages,
		paginate: paginateEditorialMagazineScene,
		resources: (spec, context) => ({
			artworkIds: [],
			fonts: familySceneFonts(
				magazineSceneStyle(spec, context).typography,
				spec,
				context,
			),
		}),
		// The family draws no decor; page, text and body-region overflow are
		// the shared output checks.
		validateOutput: () => {},
	};
