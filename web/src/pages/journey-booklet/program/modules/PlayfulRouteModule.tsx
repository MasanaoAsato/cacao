import type { ReactNode } from "react";
import type { EditorialBooklet } from "../../../../booklet/editorialModel";
import type {
	PlayfulRouteDayPagePlan,
	PlayfulRouteLayoutVariant,
	PlayfulRoutePagePlan,
} from "../../../../booklet/families/playfulRoute";
import type { AssembledPage } from "../../../../booklet/program/assemblePages";
import type {
	AnyLocalPage,
	BodyLocalPage,
	SceneSpec,
	TitleMeasurement,
} from "../../../../booklet/program/model";
import { MODULE_CAPABILITIES } from "../../../../booklet/program/moduleCapabilities";
import { paginatePlayfulRouteScene } from "../../../../booklet/program/modules/playfulRoute";
import { sceneBooklet } from "../../../../booklet/program/modules/scenePages";
import {
	playfulRouteDecorVariantFor,
	playfulRoutePaletteFor,
} from "../../../../theme/families/playfulRoute";
import {
	type MotifAssetId,
	motifAssetsFor,
} from "../../../../theme/motifAssets";
import { prepareFamilyDecorPages } from "../../families/familyDecor";
import {
	collectPlayfulRouteDayMeasurement,
	DecorAnchorElement,
	ensurePlayfulRouteDayPageContent,
	measurePlayfulRouteCoverTitle,
	PlayfulDecor,
	PlayfulRouteCover,
	PlayfulRouteDayMeasurementSample,
	type PlayfulRouteDaySlots,
	PlayfulRouteMeasurementBodies,
	playfulRouteDayLabel,
	playfulRouteDecorationsByPage,
	playfulRoutePhotoAlt,
	playfulRouteStyleFor,
	playfulRouteTitleSizes,
	RouteDayHeader,
	RouteDayPage,
} from "../../families/PlayfulRoute";
import { BookletLayoutError } from "../../layoutError";
import { requireElement, titleMeasurementOf } from "../measureDom";
import type { ModuleRegistration } from "../moduleRegistry";
import {
	dayLabel,
	effectMarks,
	ProgramPage,
	type SceneRenderContext,
	SectionLabel,
	unitLabelOf,
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

type PlayfulSpec = SceneSpec<"playful-route">;

/** Every extracted family keeps 10mm margins, so its body is 128mm wide. */
const FAMILY_BODY_WIDTH_MM = 128;

/**
 * Style of one playful scene: the direction bundle, or a registered profile
 * on the regression path (its palette, fonts, title step-down and decor).
 */
function playfulSceneStyle(spec: PlayfulSpec, context: SceneRenderContext) {
	const { config } = spec.scene;
	const profile = config.styleProfileId
		? familyProfileById("playful-route", config.styleProfileId)
		: null;
	const bundle = context.style.surface;
	const typography = profile ?? familyTypographyFromBundle(bundle);
	return {
		className: `playful-route playful-route--${config.compositionId}`,
		decor: profile
			? {
					compositionId: config.compositionId,
					decorAssetIds: profile.decorAssetIds,
					decorVariantId: profile.decorVariantId,
					familyId: "playful-route" as const,
					seedToken: context.seedToken,
				}
			: null,
		titleSizes: playfulRouteTitleSizes(
			profile?.fontSizesPt.title ?? bundle.displayFontSizePt,
		),
		typography,
		vars: playfulRouteStyleFor({
			compositionId: config.compositionId,
			palette: profile
				? playfulRoutePaletteFor(profile.paletteId)
				: familyPaletteFromBundle("playful-route", bundle),
			// The family's default photo radius and route rule.
			photoTreatment: profile?.photoTreatment ?? "rounded-photo",
			ruleTreatment: profile?.ruleTreatment ?? "rounded-route",
			typography,
		}),
	};
}

/** The motif assets this scene's pages draw on the profile path. */
function sceneDecorAssetIds(
	spec: PlayfulSpec,
	decorVariantId: string | null,
): readonly MotifAssetId[] {
	const variant = playfulRouteDecorVariantFor(decorVariantId);
	return spec.scene.kind === "cover"
		? variant.coverAssetIds
		: [variant.slots["playful-day-squiggle"].assetId];
}

/**
 * The profile's motif SVGs as images of the measurement DOM, so the scene
 * session decodes them with the itinerary images before measuring.
 */
function DecorAssetPreload({
	assetIds,
}: {
	readonly assetIds: readonly MotifAssetId[];
}) {
	if (assetIds.length === 0) return null;
	return (
		<div data-playful-route-decor-preload="true" hidden>
			{motifAssetsFor(assetIds).map((asset) => (
				<img
					alt={`装飾素材 ${asset.id}`}
					decoding="async"
					key={asset.id}
					loading="eager"
					src={asset.src}
				/>
			))}
		</div>
	);
}

/** The booklet the family parts read: the whole cover, or the scene's day. */
function bookletOf(spec: PlayfulSpec): EditorialBooklet {
	return spec.scene.kind === "cover"
		? spec.content.booklet
		: sceneBooklet(spec);
}

function bodyOf(page: AnyLocalPage): BodyLocalPage | null {
	return page.kind === "first" || page.kind === "continuation" ? page : null;
}

function layoutVariantOf(value: string | null): PlayfulRouteLayoutVariant {
	// A transplanted structure keeps the family's first frame.
	if (value === null || value === "selected") return "selected";
	if (value === "compact-header" || value === "wide-ribbon") return value;
	throw new BookletLayoutError(
		"dom-not-ready",
		`playful-routeの構図退避「${value}」がありません。`,
	);
}

/**
 * A local page as the family's page plan. Unit IDs of the single column are
 * indexes into the scene's owned units, which are the scene day's units.
 */
function familyPlanOf(
	pageId: string,
	page: BodyLocalPage | null,
	spec: PlayfulSpec,
): PlayfulRoutePagePlan {
	if (!page) return { kind: "cover", pageId };
	const layoutVariant = layoutVariantOf(page.layoutVariant);
	const continuation = page.kind === "continuation";
	if (hasTransplantedBody(spec))
		return {
			blockHeightsMm: [],
			continuation,
			dayIndex: 0,
			kind: "day",
			layoutVariant,
			pageId,
			unitIndexes: [],
		};
	const units = spec.content.ownedUnits;
	const unitIndexes = (page.columns[0] ?? []).map((id) => {
		const index = units.findIndex((unit) => unit.id === id);
		if (index < 0)
			throw new BookletLayoutError(
				"dom-not-ready",
				`ページ「${pageId}」の予定「${id}」がsceneにありません。`,
			);
		return index;
	});
	if (!page.unitHeightsMm || page.unitHeightsMm.length !== unitIndexes.length)
		throw new BookletLayoutError(
			"dom-not-ready",
			`ページ「${pageId}」の予定ブロック高さがありません。`,
		);
	return {
		blockHeightsMm: page.unitHeightsMm,
		continuation,
		dayIndex: 0,
		kind: "day",
		layoutVariant,
		pageId,
		unitIndexes,
	};
}

/** Program slots of a day page; marks only on printed pages. */
function daySlots(
	spec: PlayfulSpec,
	context: SceneRenderContext,
	continuation: boolean,
	output: boolean,
): PlayfulRouteDaySlots {
	const { content, scene } = spec;
	const day = content.day;
	const image = day ? (day.illustration ?? content.booklet.cover.image) : null;
	return {
		bodyMarks: output ? effectMarks(scene, "body") : undefined,
		// The low continuation header only repeats the day; the section shows on the first page.
		extra:
			scene.config.heading.system || continuation ? null : (
				<SectionLabel scene={scene} />
			),
		heading: transplantedHeading(spec, context, continuation),
		image: transplantedImage(
			spec,
			image,
			playfulRoutePhotoAlt(content.booklet.cover.title),
			day?.date ?? null,
		),
		imageMarks: output ? effectMarks(scene, "image") : undefined,
		label:
			scene.config.dayHeader && day
				? dayLabel(scene, day.dayNumber)
				: undefined,
		marks: output ? effectMarks(scene, "heading") : undefined,
		ordinalOffset: content.firstUnitOffset,
		showIllustration: scene.kind === "day" ? scene.showIllustration : true,
		unitLabel: unitLabelOf(scene),
	};
}

/** The family's first or continuation frame, for a page without blocks. */
function dayPlan(continuation: boolean): PlayfulRouteDayPagePlan {
	return {
		blockHeightsMm: [],
		continuation,
		dayIndex: 0,
		kind: "day",
		layoutVariant: "selected",
		pageId: continuation ? "measure-continuation" : "measure-first",
		unitIndexes: [],
	};
}

/**
 * The family's day frame around a transplanted content structure. The
 * structure fills the family's own body container (140 / 158mm).
 */
function PlayfulStructuredFrame({
	context,
	continuation,
	output,
	page,
	spec,
}: {
	readonly context: SceneRenderContext;
	readonly continuation: boolean;
	readonly output: boolean;
	readonly page: BodyLocalPage | null;
	readonly spec: PlayfulSpec;
}) {
	const booklet = sceneBooklet(spec);
	const day = booklet.days[0];
	if (!day) return null;
	return (
		<>
			<RouteDayHeader
				booklet={booklet}
				day={day}
				page={dayPlan(continuation)}
				slots={daySlots(spec, context, continuation, output)}
			/>
			<div
				className={`playful-route-blocks playful-route-blocks--selected${continuation ? " playful-route-blocks--continuation" : ""}`}
			>
				<FamilyStructuredBody
					bodyWidthMm={FAMILY_BODY_WIDTH_MM}
					frame={continuation ? "continuation" : "first"}
					page={page}
					spec={spec}
				/>
			</div>
			<DecorAnchorElement
				className="playful-route-anchor playful-route-anchor--day-squiggle"
				id="playful-day-squiggle"
			/>
		</>
	);
}

function overflowMm(heading: TitleMeasurement): number {
	return Math.max(
		heading.contentHeightMm - heading.reservedHeightMm,
		heading.contentWidthMm - heading.reservedWidthMm,
	);
}

function Measure({
	context,
	spec,
}: {
	readonly context: SceneRenderContext;
	readonly spec: PlayfulSpec;
}) {
	const style = playfulSceneStyle(spec, context);
	const compositionId = spec.scene.config.compositionId;
	const preload = style.decor ? (
		<DecorAssetPreload
			assetIds={sceneDecorAssetIds(spec, style.decor.decorVariantId)}
		/>
	) : null;
	if (spec.scene.kind === "cover") {
		const booklet = spec.content.booklet;
		return (
			<FamilySceneRoot className={style.className} style={style.vars}>
				{preload}
				<ProgramPage
					context={context}
					className="playful-route-page playful-route-page--cover"
					familyStyle={style.vars}
					mode="measurement"
					page={{ compositionId, kind: "cover", localPageId: "measure" }}
					spec={spec}
					style={context.style}
				>
					<div className="booklet-page__content">
						<PlayfulRouteCover
							booklet={booklet}
							measurement
							slots={{
								image: transplantedImage(
									spec,
									booklet.cover.image,
									playfulRoutePhotoAlt(booklet.cover.title),
									booklet.cover.period.start_date,
								),
							}}
							titleSizePt={style.titleSizes[0] ?? 22}
							titleSizesPt={style.titleSizes}
						/>
					</div>
				</ProgramPage>
			</FamilySceneRoot>
		);
	}
	const booklet = sceneBooklet(spec);
	const day = booklet.days[0];
	if (!day) return null;
	const measurePage = (
		localPageId: string,
		kind: "first" | "continuation",
		children: ReactNode,
	) => (
		<ProgramPage
			context={context}
			className="playful-route-page playful-route-page--day"
			familyStyle={style.vars}
			mode="measurement"
			page={{ compositionId, kind, localPageId }}
			spec={spec}
			style={context.style}
		>
			<div className="booklet-page__content">{children}</div>
		</ProgramPage>
	);
	const header = (continuation: boolean) => (
		<RouteDayHeader
			booklet={booklet}
			day={day}
			page={dayPlan(continuation)}
			slots={daySlots(spec, context, continuation, false)}
		/>
	);
	return (
		<FamilySceneRoot className={style.className} style={style.vars}>
			{preload}
			{hasTransplantedBody(spec) ? (
				<>
					{measurePage(
						"measure-first",
						"first",
						<PlayfulStructuredFrame
							context={context}
							continuation={false}
							output={false}
							page={null}
							spec={spec}
						/>,
					)}
					{measurePage(
						"measure-continuation",
						"continuation",
						<PlayfulStructuredFrame
							context={context}
							continuation
							output={false}
							page={null}
							spec={spec}
						/>,
					)}
					{measurePage(
						"measure-stack",
						"continuation",
						<FamilyStructuredStack
							bodyWidthMm={FAMILY_BODY_WIDTH_MM}
							spec={spec}
						/>,
					)}
				</>
			) : (
				<>
					{measurePage("measure-first", "first", header(false))}
					{measurePage("measure-continuation", "continuation", header(true))}
					{measurePage(
						"measure-blocks",
						"continuation",
						<div data-playful-route-measurement-day="0">
							<PlayfulRouteMeasurementBodies />
							<PlayfulRouteDayMeasurementSample
								day={day}
								dayIndex={0}
								ordinalOffset={spec.content.firstUnitOffset}
								unitLabel={unitLabelOf(spec.scene)}
							/>
						</div>,
					)}
				</>
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
	readonly spec: PlayfulSpec;
}) {
	const style = playfulSceneStyle(spec, context);
	const booklet = bookletOf(spec);
	return (
		<FamilySceneRoot className={style.className} style={style.vars}>
			{assembled.map((item) => {
				const page = item.page;
				const body = bodyOf(page);
				const familyPlan = familyPlanOf(item.pageId, body, spec);
				return (
					<ProgramPage
						context={context}
						className={`playful-route-page playful-route-page--${familyPlan.kind}`}
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
							<PlayfulDecor
								booklet={booklet}
								design={style.decor}
								ordinalOffset={spec.content.firstUnitOffset}
								page={familyPlan}
								scope="output"
							/>
						) : null}
						<div className="booklet-page__content">
							{page.kind === "cover" ? (
								<PlayfulRouteCover
									booklet={booklet}
									measurement={false}
									slots={{
										image: transplantedImage(
											spec,
											booklet.cover.image,
											playfulRoutePhotoAlt(booklet.cover.title),
											booklet.cover.period.start_date,
										),
										imageMarks: effectMarks(spec.scene, "cover", "image"),
										titleMarks: effectMarks(spec.scene, "heading"),
									}}
									titleSizePt={page.titleSizePt ?? style.titleSizes[0] ?? 22}
									titleSizesPt={style.titleSizes}
								/>
							) : body && hasTransplantedBody(spec) ? (
								<PlayfulStructuredFrame
									context={context}
									continuation={body.kind === "continuation"}
									output
									page={body}
									spec={spec}
								/>
							) : familyPlan.kind === "day" ? (
								<RouteDayPage
									booklet={booklet}
									page={familyPlan}
									slots={daySlots(spec, context, familyPlan.continuation, true)}
								/>
							) : null}
						</div>
					</ProgramPage>
				);
			})}
		</FamilySceneRoot>
	);
}

/** The family's content checks that apply to one scene's pages. */
function ensureSceneContent(
	pages: readonly HTMLElement[],
	spec: PlayfulSpec,
	familyPlans: readonly PlayfulRoutePagePlan[],
): void {
	const { content, scene } = spec;
	if (scene.kind === "cover") {
		const title = pages[0]
			? requireElement(
					pages[0],
					'[data-booklet-text-role="cover-destination"]',
					"表紙都市名",
				).textContent?.trim()
			: null;
		if (title !== content.booklet.cover.title)
			throw new BookletLayoutError(
				"dom-not-ready",
				"表紙都市名が掲載モデルと一致しません。",
			);
		return;
	}
	const day = content.day;
	if (!day) return;
	const label = scene.config.heading.system
		? null
		: scene.config.dayHeader
			? dayLabel(scene, day.dayNumber)
			: playfulRouteDayLabel(day.dayNumber);
	familyPlans.forEach((plan, index) => {
		const pageElement = pages[index];
		if (plan.kind !== "day" || !pageElement) return;
		ensurePlayfulRouteDayPageContent(pageElement, day, plan, {
			label,
			ordinalOffset: content.firstUnitOffset,
			unitLabel: unitLabelOf(scene),
		});
	});
}

/**
 * playful-route, extracted from the family: cover and one day per scene
 * with the family's geometry, block fallback (selected → compact-header →
 * wide-ribbon) and title step-down.
 */
export const PLAYFUL_ROUTE_MODULE: ModuleRegistration<"playful-route"> = {
	capabilities: MODULE_CAPABILITIES["playful-route"],
	Measure,
	measure: (root, spec, context) => {
		const style = playfulSceneStyle(spec, context);
		if (spec.scene.kind === "cover") {
			const titleSizePt = measurePlayfulRouteCoverTitle(root, style.titleSizes);
			const title = requireElement(
				root,
				`[data-playful-route-cover-title-size="${titleSizePt}"]`,
				"表紙の題名",
			);
			const period = requireElement(
				root,
				".playful-route-cover__period",
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
		// The first frame's heading sits beside the photo; continuation and
		// fallback pages use the compact one. Both must hold the heading.
		const [first, continuation] = (
			["measure-first", "measure-continuation"] as const
		).map((localPageId) =>
			headingMeasurementOf(
				requireElement(
					root,
					`[data-local-page-id="${localPageId}"] .playful-route-day-header__heading`,
					"日見出し",
				),
			),
		);
		if (!first || !continuation)
			throw new BookletLayoutError("dom-not-ready", "日見出しがありません。");
		const heading =
			overflowMm(continuation) > overflowMm(first) ? continuation : first;
		if (hasTransplantedBody(spec))
			return measureFamilyStructured(root, spec, heading);
		return {
			heading,
			kind: "day",
			measurement: collectPlayfulRouteDayMeasurement(
				root,
				sceneBooklet(spec),
				spec.scene.config.compositionId,
			),
			styleKey: spec.styleKey,
		};
	},
	moduleId: "playful-route",
	Pages,
	paginate: paginatePlayfulRouteScene,
	resources: (spec, context) => ({
		artworkIds: [],
		fonts: familySceneFonts(
			playfulSceneStyle(spec, context).typography,
			spec,
			context,
		),
	}),
	validateOutput: (pages, spec, plan, context) => {
		const familyPlans = plan.pages.map((page, index) =>
			familyPlanOf(pages[index]?.dataset.pageId ?? "", bodyOf(page), spec),
		);
		ensureSceneContent(pages, spec, familyPlans);
		// The profile path draws the family's decor; it must match its placement.
		const decor = playfulSceneStyle(spec, context).decor;
		if (!decor) return;
		prepareFamilyDecorPages(
			pages,
			decor,
			playfulRouteDecorationsByPage(
				familyPlans,
				spec.scene.config.compositionId,
				decor.decorVariantId,
				bookletOf(spec),
				spec.content.firstUnitOffset,
			),
		);
	},
};
