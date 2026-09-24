import type { CSSProperties, ReactNode } from "react";
import {
	TRAVEL_NEWSPAPER_ARTICLE_CAPACITY_MM,
	TRAVEL_NEWSPAPER_CONTINUATION_CAPACITY_MM,
	type TravelNewspaperPagePlan,
} from "../../../../booklet/families/travelNewspaper";
import type { AssembledPage } from "../../../../booklet/program/assemblePages";
import type {
	AnySceneSpec,
	BodyLocalPage,
	LocalPageKind,
	SceneSpec,
	TitleMeasurement,
} from "../../../../booklet/program/model";
import { MODULE_CAPABILITIES } from "../../../../booklet/program/moduleCapabilities";
import { sceneBooklet } from "../../../../booklet/program/modules/scenePages";
import { paginateTravelNewspaperScene } from "../../../../booklet/program/modules/travelNewspaper";
import { styleProfilesForFamily } from "../../../../theme/families/styleProfiles";
import { travelNewspaperPaletteFor } from "../../../../theme/families/travelNewspaper";
import {
	collectTravelNewspaperDayHeights,
	ensureTravelNewspaperPagesFit,
	TravelNewspaperArticles,
	TravelNewspaperCover,
	DayHeader as TravelNewspaperDayHeader,
	type TravelNewspaperDayHeaderSlots,
	TravelNewspaperDayMeasurementSample,
	type TravelNewspaperVariant,
	travelNewspaperMeasurementsOf,
	travelNewspaperStyleFor,
	travelNewspaperVariantOf,
} from "../../families/TravelNewspaper";
import {
	closestPage,
	pageScaleOf,
	requireElement,
	titleMeasurementOf,
} from "../measureDom";
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
	familyTypographyFromBundle,
} from "./familyStyle";

/** Every extracted family keeps 10mm margins, so its body is 128mm wide. */
const FAMILY_BODY_WIDTH_MM = 128;

type NewspaperPageKind = TravelNewspaperPagePlan["kind"];

/**
 * The registered newspaper profile. `familyProfileById` only searches the
 * base profile list, which does not hold the newspaper profiles.
 */
function newspaperProfile(profileId: string) {
	const profile = styleProfilesForFamily("travel-newspaper").find(
		(item) => item.id === profileId,
	);
	if (!profile)
		throw new Error(
			`travel-newspaperの作風プロファイル「${profileId}」がありません。`,
		);
	return profile;
}

/**
 * Style of one newspaper scene: the direction bundle with the classic rules,
 * or a registered profile (its palette, fonts and variant) on the
 * regression path.
 */
function newspaperSceneStyle(
	spec: SceneSpec<"travel-newspaper">,
	context: SceneRenderContext,
) {
	const { config } = spec.scene;
	const profile = config.styleProfileId
		? newspaperProfile(config.styleProfileId)
		: null;
	const bundle = context.style.surface;
	const typography = profile ?? familyTypographyFromBundle(bundle);
	const variant: TravelNewspaperVariant = profile
		? travelNewspaperVariantOf(profile.id)
		: "classic-travel";
	const vars = travelNewspaperStyleFor({
		compositionId: config.compositionId,
		palette: profile
			? travelNewspaperPaletteFor(profile.paletteId)
			: familyPaletteFromBundle("travel-newspaper", bundle),
		typography,
		variant,
	});
	// `.travel-newspaper` lays out a grid; the scene root must stay boxless.
	const rootStyle: CSSProperties = { ...vars, display: "contents" };
	return {
		className: `travel-newspaper travel-newspaper--${variant}`,
		rootStyle,
		typography,
		vars,
	};
}

function familyPlanOf(
	pageId: string,
	page: BodyLocalPage | null,
	spec: AnySceneSpec,
): TravelNewspaperPagePlan {
	if (!page) return { kind: "cover", pageId };
	const units = spec.content.ownedUnits;
	return {
		dayIndex: 0,
		kind: page.kind === "continuation" ? "continuation" : "articles",
		pageId,
		unitIndexes: (page.columns[0] ?? []).map((id) =>
			units.findIndex((unit) => unit.id === id),
		),
	};
}

function headerSlots(
	spec: SceneSpec<"travel-newspaper">,
	context: SceneRenderContext,
	continuation: boolean,
	output: boolean,
): TravelNewspaperDayHeaderSlots {
	const { scene } = spec;
	const day = spec.content.day;
	return {
		// The low continuation header only repeats the day; the section shows on the first page.
		extra:
			scene.config.heading.system || continuation ? null : (
				<SectionLabel scene={scene} />
			),
		heading: transplantedHeading(spec, context, continuation),
		illustration: scene.kind === "day" && scene.showIllustration,
		image: day
			? transplantedImage(spec, day.illustration, "", day.date)
			: undefined,
		imageMarks: output ? effectMarks(scene, "image") : undefined,
		marks: output ? effectMarks(scene, "heading") : undefined,
	};
}

/**
 * A transplanted content structure in the newspaper's article area, which
 * keeps the family's height under the first and continuation headers.
 */
function NewspaperStructuredFrame({
	context,
	continuation,
	page,
	spec,
}: {
	readonly context: SceneRenderContext;
	readonly continuation: boolean;
	readonly page: BodyLocalPage | null;
	readonly spec: SceneSpec<"travel-newspaper">;
}) {
	const day = spec.content.day;
	if (!day) return null;
	return (
		<>
			<TravelNewspaperDayHeader
				continuation={continuation}
				day={day}
				slots={headerSlots(spec, context, continuation, page !== null)}
			/>
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					height: `${continuation ? TRAVEL_NEWSPAPER_CONTINUATION_CAPACITY_MM : TRAVEL_NEWSPAPER_ARTICLE_CAPACITY_MM}mm`,
				}}
			>
				<FamilyStructuredBody
					bodyWidthMm={FAMILY_BODY_WIDTH_MM}
					frame={continuation ? "continuation" : "first"}
					page={page}
					spec={spec}
				/>
			</div>
		</>
	);
}

/** The header that overflows most; the continuation header is the shorter one. */
function measureNewspaperHeading(root: HTMLElement): TitleMeasurement {
	const excess = (title: TitleMeasurement) =>
		Math.max(
			title.contentHeightMm - title.reservedHeightMm,
			title.contentWidthMm - title.reservedWidthMm,
		);
	const first = headingMeasurementOf(
		requireElement(root, ".travel-newspaper-day-header", "日付ヘッダー"),
	);
	return Array.from(
		root.querySelectorAll<HTMLElement>(".travel-newspaper-day-header"),
		headingMeasurementOf,
	).reduce(
		(worst, next) => (excess(next) > excess(worst) ? next : worst),
		first,
	);
}

function Measure({
	context,
	spec,
}: {
	readonly context: SceneRenderContext;
	readonly spec: SceneSpec<"travel-newspaper">;
}) {
	const style = newspaperSceneStyle(spec, context);
	const measurePage = (
		children: ReactNode,
		kind: Extract<LocalPageKind, "cover" | "first" | "continuation">,
		familyKind: NewspaperPageKind,
	) => (
		<ProgramPage
			className={`travel-newspaper-page travel-newspaper-page--${familyKind}`}
			familyStyle={style.vars}
			mode="measurement"
			page={{
				compositionId: spec.scene.config.compositionId,
				kind,
				localPageId: `measure-${familyKind}`,
			}}
			spec={spec}
			style={context.style}
		>
			<div className="travel-newspaper-page__content">{children}</div>
		</ProgramPage>
	);
	if (spec.scene.kind === "cover")
		return (
			<FamilySceneRoot className={style.className} style={style.rootStyle}>
				{measurePage(
					<TravelNewspaperCover booklet={spec.content.booklet} />,
					"cover",
					"cover",
				)}
			</FamilySceneRoot>
		);
	const day = spec.content.day;
	if (!day) return null;
	return (
		<FamilySceneRoot className={style.className} style={style.rootStyle}>
			{hasTransplantedBody(spec) ? (
				<>
					{measurePage(
						<NewspaperStructuredFrame
							context={context}
							continuation={false}
							page={null}
							spec={spec}
						/>,
						"first",
						"articles",
					)}
					{measurePage(
						<NewspaperStructuredFrame
							context={context}
							continuation
							page={null}
							spec={spec}
						/>,
						"continuation",
						"continuation",
					)}
					{measurePage(
						<FamilyStructuredStack
							bodyWidthMm={FAMILY_BODY_WIDTH_MM}
							spec={spec}
						/>,
						"continuation",
						"continuation",
					)}
				</>
			) : (
				<div data-travel-newspaper-measurement-day={day.id}>
					{measurePage(
						<TravelNewspaperDayMeasurementSample
							day={day}
							headers={{
								continuation: headerSlots(spec, context, true, false),
								first: headerSlots(spec, context, false, false),
							}}
						/>,
						"first",
						"articles",
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
	readonly spec: SceneSpec<"travel-newspaper">;
}) {
	const style = newspaperSceneStyle(spec, context);
	const booklet = spec.content.booklet;
	return (
		<FamilySceneRoot className={style.className} style={style.rootStyle}>
			{assembled.map((item) => {
				const page = item.page;
				const body =
					page.kind === "first" || page.kind === "continuation" ? page : null;
				const familyPlan = familyPlanOf(item.pageId, body, spec);
				return (
					<ProgramPage
						className={`travel-newspaper-page travel-newspaper-page--${familyPlan.kind}`}
						familyStyle={style.vars}
						key={item.pageId}
						mode="output"
						page={page}
						pageId={item.pageId}
						pageNumber={item.pageNumber}
						spec={spec}
						style={context.style}
					>
						<div className="travel-newspaper-page__content">
							{page.kind === "cover" ? (
								<TravelNewspaperCover
									booklet={booklet}
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
								<NewspaperStructuredFrame
									context={context}
									continuation={body.kind === "continuation"}
									page={body}
									spec={spec}
								/>
							) : familyPlan.kind !== "cover" ? (
								<TravelNewspaperArticles
									booklet={sceneBooklet(spec)}
									page={familyPlan}
									slots={{
										bodyMarks: effectMarks(spec.scene, "body"),
										header: headerSlots(
											spec,
											context,
											familyPlan.kind === "continuation",
											true,
										),
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
 * travel-newspaper, extracted from the family: masthead cover and one day
 * per scene in the newspaper's own two article columns.
 */
export const TRAVEL_NEWSPAPER_MODULE: ModuleRegistration<"travel-newspaper"> = {
	capabilities: MODULE_CAPABILITIES["travel-newspaper"],
	Measure,
	measure: (root, spec) => {
		if (spec.scene.kind === "cover") {
			// The title keeps its 24mm reserved height; overflow is not shrunk.
			const title = requireElement(
				root,
				".travel-newspaper-cover__title",
				"表紙の題名",
			);
			const period = requireElement(
				root,
				".travel-newspaper-cover__period",
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
		const heading = measureNewspaperHeading(root);
		if (hasTransplantedBody(spec))
			return measureFamilyStructured(root, spec, heading);
		const sample = requireElement(
			root,
			"[data-travel-newspaper-measurement-day] [data-program-page]",
			"日別計測用紙面",
		);
		const days = collectTravelNewspaperDayHeights(
			root,
			sceneBooklet(spec),
			pageScaleOf(closestPage(sample)),
		);
		return {
			heading,
			kind: "day",
			measurement: travelNewspaperMeasurementsOf(days),
			styleKey: spec.styleKey,
		};
	},
	moduleId: "travel-newspaper",
	Pages,
	paginate: paginateTravelNewspaperScene,
	resources: (spec, context) => ({
		artworkIds: [],
		fonts: familySceneFonts(
			newspaperSceneStyle(spec, context).typography,
			spec,
			context,
		),
	}),
	validateOutput: (pages) => ensureTravelNewspaperPagesFit(pages),
};
