import type { ReactNode } from "react";
import { formatBookletDate } from "../../../booklet/dateFormat";
import type { AssembledPage } from "../../../booklet/program/assemblePages";
import {
	type BodyStructure,
	bodyStructureFor,
} from "../../../booklet/program/bodyStructures";
import type {
	AnySceneSpec,
	BodyLocalPage,
	BodyMeasurement,
	CoverMeasurement,
	ExtraMeasurement,
	LocalPage,
	ProgramScene,
} from "../../../booklet/program/model";
import {
	type CoverGeometry,
	type DayGeometry,
	type DayLayout,
	EXTRA_COVER_GEOMETRY,
	EXTRA_PAGE_BODY_RECT,
	MEMO_HEADING,
	MEMORY_ALBUM_NOTE,
	MEMORY_ALBUM_PHOTO,
	type ModuleRect,
	QUEST_CHECKLIST_LANE_MM,
	QUEST_PANEL_PADDING_MM,
	QUEST_STAMP_LANE_MM,
	rect,
	SPECIMEN_COLUMN_GAP_MM,
	SPECIMEN_COLUMN_MM,
} from "../../../booklet/program/modules/geometry";
import { BookletLayoutError } from "../layoutError";
import {
	closestPage,
	heightMmOf,
	pageScaleOf,
	requireElement,
	titleMeasurementOf,
} from "./measureDom";
import {
	ArtSlot,
	bindingFor,
	ConceptRoute,
	CoverTitle,
	DayHeading,
	EmptyDayText,
	ItineraryImage,
	LedgerColumnHeadings,
	PeriodText,
	ProgramPage,
	Region,
	type SceneRenderContext,
	type SceneRenderMode,
	UnitBlock,
} from "./sceneParts";

/**
 * The geometry and module-owned regions of one of the seven modules added in
 * 25.4. All of them lay their body out from a registered body structure.
 */
export type StructuredModuleDefinition = {
	readonly cover: CoverGeometry | null;
	/** Hero slot IDs as declared in `MODULE_CAPABILITIES`. */
	readonly coverHeroSlotId: string | null;
	readonly dayHeroSlotId: string | null;
	readonly dayLayout: (scene: ProgramScene) => DayLayout;
	/** A module-owned region beside the body: diagram or column headings. */
	readonly extra?: (props: {
		readonly continuation: boolean;
		readonly page: BodyLocalPage | null;
		readonly spec: AnySceneSpec;
	}) => ReactNode;
	readonly verticalCoverTitle: boolean;
	readonly verticalDayHeading: boolean;
};

function structureOf(spec: AnySceneSpec): BodyStructure {
	const structure = bodyStructureFor(spec.scene);
	if (!structure) {
		throw new BookletLayoutError(
			"dom-not-ready",
			`module「${spec.scene.moduleId}」の本文構造がありません。`,
		);
	}
	return structure;
}

function columnWidthMm(structure: BodyStructure, bodyWidthMm: number): number {
	return structure.id === "specimen-columns" ? SPECIMEN_COLUMN_MM : bodyWidthMm;
}

function laneOf(scene: ProgramScene) {
	return "participationLane" in scene.config
		? scene.config.participationLane
		: null;
}

/** The lane column spans the body so the participation claim is body-tall. */
function LaneColumn({
	body,
	scene,
}: {
	readonly body: ModuleRect;
	readonly scene: ProgramScene;
}) {
	const lane = laneOf(scene);
	if (!lane) return null;
	const width =
		lane.lane === "stamp" ? QUEST_STAMP_LANE_MM : QUEST_CHECKLIST_LANE_MM;
	const x =
		lane.lane === "stamp"
			? body.widthMm - QUEST_PANEL_PADDING_MM - width
			: QUEST_PANEL_PADDING_MM;
	return (
		<Region
			className={`program-lane program-lane--${lane.lane}`}
			region={rect(x, 0, width, body.heightMm)}
			regionId="lane"
			scene={scene}
		/>
	);
}

function Body({
	body,
	page,
	spec,
}: {
	readonly body: ModuleRect;
	readonly page: BodyLocalPage;
	readonly spec: AnySceneSpec;
}) {
	const structure = structureOf(spec);
	return (
		<Region
			className={`program-body program-body--${structure.id}`}
			region={body}
			regionId="body"
			scene={spec.scene}
		>
			<LaneColumn body={body} scene={spec.scene} />
			<StructuredColumns
				bodyWidthMm={body.widthMm}
				page={page}
				spec={spec}
				structure={structure}
			/>
		</Region>
	);
}

/**
 * The units of one page in a body structure: an optional route strip or
 * column headings, then columns in reading order. Extracted families place
 * the same columns inside their own body container.
 */
export function StructuredColumns({
	bodyWidthMm,
	page,
	spec,
	structure,
}: {
	readonly bodyWidthMm: number;
	readonly page: BodyLocalPage;
	readonly spec: AnySceneSpec;
	readonly structure: BodyStructure;
}) {
	const unitsById = new Map(
		spec.content.ownedUnits.map((unit) => [unit.id, unit]),
	);
	let number = page.firstUnitNumber;
	return (
		<>
			{structure.headerMm > 0 ? (
				<div
					className="program-body__header"
					style={{ height: `${structure.headerMm}mm` }}
				>
					{structure.id === "concept-route" || structure.id === "route-line" ? (
						<ConceptRoute
							count={page.unitIds.length}
							firstNumber={page.firstUnitNumber}
							variant={structure.id}
						/>
					) : (
						<LedgerColumnHeadings />
					)}
				</div>
			) : null}
			<div
				className="program-body__columns"
				style={{
					columnGap: `${SPECIMEN_COLUMN_GAP_MM}mm`,
					gridTemplateColumns: page.columns
						.map(() => `${columnWidthMm(structure, bodyWidthMm)}mm`)
						.join(" "),
				}}
			>
				{page.columns.map((column, columnIndex) => (
					<div
						className="program-body__column"
						// biome-ignore lint/suspicious/noArrayIndexKey: columns are positional.
						key={columnIndex}
						style={{ rowGap: `${structure.gapMm}mm` }}
					>
						{column.map((unitId) => {
							const unit = unitsById.get(unitId);
							const current = number;
							number += 1;
							return unit ? (
								<UnitBlock
									key={unitId}
									number={current}
									scene={spec.scene}
									structure={structure}
									unit={unit}
								/>
							) : null;
						})}
					</div>
				))}
			</div>
			{spec.content.ownedUnits.length === 0 ? <EmptyDayText /> : null}
		</>
	);
}

/** Every owned unit stacked once, at the structure's column width, for measuring. */
export function StructuredMeasureStack({
	bodyWidthMm,
	spec,
	structure,
}: {
	readonly bodyWidthMm: number;
	readonly spec: AnySceneSpec;
	readonly structure: BodyStructure;
}) {
	return (
		<div
			className="program-body__column"
			data-program-measure-column="true"
			style={{ width: `${columnWidthMm(structure, bodyWidthMm)}mm` }}
		>
			{spec.content.ownedUnits.map((unit, index) => (
				<UnitBlock
					key={unit.id}
					measureIndex={index}
					number={spec.content.firstUnitOffset + index + 1}
					scene={spec.scene}
					structure={structure}
					unit={unit}
				/>
			))}
			<EmptyDayText measure />
		</div>
	);
}

/** Unit heights, the empty-day text and the text width from a measure stack. */
export function readMeasureStack(root: HTMLElement): {
	readonly emptyHeightMm: number;
	readonly textWidthMm: number;
	readonly unitHeightsMm: readonly number[];
} {
	const units = Array.from(
		root.querySelectorAll<HTMLElement>("[data-program-measure-unit]"),
	);
	return {
		emptyHeightMm: heightMmOf(
			requireElement(root, "[data-program-measure-empty]", "空日文言"),
		),
		textWidthMm: units[0] ? textBoxWidthMm(units[0]) : 0,
		unitHeightsMm: units.map(heightMmOf),
	};
}

function dayGeometry(
	definition: StructuredModuleDefinition,
	spec: AnySceneSpec,
	continuation: boolean,
): DayGeometry {
	const layout = definition.dayLayout(spec.scene);
	// A later scene of the same day starts with the continuation composition.
	const showsFirst =
		!continuation &&
		!(
			spec.scene.kind === "day" &&
			!spec.scene.showIllustration &&
			spec.scene.moduleId === "photo-essay"
		);
	return showsFirst ? layout.first : layout.continuation;
}

function DayPage({
	context,
	definition,
	mode,
	page,
	pageId,
	pageNumber,
	spec,
}: {
	readonly context: SceneRenderContext;
	readonly definition: StructuredModuleDefinition;
	readonly mode: SceneRenderMode;
	readonly page: BodyLocalPage;
	readonly pageId?: string;
	readonly pageNumber?: number;
	readonly spec: AnySceneSpec;
}) {
	const { scene, content } = spec;
	const continuation = page.kind === "continuation";
	const geometry = dayGeometry(definition, spec, continuation);
	const showIllustration = scene.kind === "day" && scene.showIllustration;
	return (
		<ProgramPage
			mode={mode}
			page={page}
			pageId={pageId}
			pageNumber={pageNumber}
			spec={spec}
			style={context.style}
		>
			<Region
				className="program-heading-region"
				region={geometry.heading}
				regionId="heading"
				scene={scene}
			>
				<DayHeading
					context={context}
					continuation={continuation}
					spec={spec}
					vertical={definition.verticalDayHeading && !continuation}
				/>
			</Region>
			{geometry.image ? (
				<ItineraryImage
					alt={`${content.day?.dayNumber ?? ""}日目の挿絵`}
					captionDate={content.day?.date ?? null}
					image={showIllustration ? (content.day?.illustration ?? null) : null}
					region={geometry.image}
					scene={scene}
					treatment={scene.config.imageTreatment?.treatment ?? null}
				/>
			) : null}
			{geometry.hero && definition.dayHeroSlotId ? (
				<ArtSlot
					binding={bindingFor(scene, definition.dayHeroSlotId)}
					context={context}
					region={geometry.hero}
					scene={scene}
				/>
			) : null}
			{geometry.extra && definition.extra ? (
				<Region
					className="program-extra"
					region={geometry.extra}
					regionId="extra"
					scene={scene}
				>
					{definition.extra({ continuation, page, spec })}
				</Region>
			) : null}
			<Body body={geometry.body} page={page} spec={spec} />
		</ProgramPage>
	);
}

function CoverPage({
	context,
	definition,
	mode,
	page,
	pageId,
	pageNumber,
	spec,
}: {
	readonly context: SceneRenderContext;
	readonly definition: StructuredModuleDefinition;
	readonly mode: SceneRenderMode;
	readonly page: Pick<LocalPage, "compositionId" | "kind" | "localPageId">;
	readonly pageId?: string;
	readonly pageNumber?: number;
	readonly spec: AnySceneSpec;
}) {
	const geometry = definition.cover;
	if (!geometry) {
		throw new BookletLayoutError(
			"dom-not-ready",
			`module「${spec.scene.moduleId}」は表紙を描けません。`,
		);
	}
	const { scene, content } = spec;
	return (
		<ProgramPage
			mode={mode}
			page={page}
			pageId={pageId}
			pageNumber={pageNumber}
			spec={spec}
			style={context.style}
		>
			<Region
				className="program-title-region"
				effectRegionId="heading"
				region={geometry.title}
				regionId="title"
				scene={scene}
			>
				<CoverTitle
					booklet={content.booklet}
					vertical={definition.verticalCoverTitle}
				/>
			</Region>
			{geometry.hero && definition.coverHeroSlotId ? (
				<ArtSlot
					binding={bindingFor(scene, definition.coverHeroSlotId)}
					context={context}
					region={geometry.hero}
					scene={scene}
				/>
			) : null}
			<ItineraryImage
				alt={`${content.booklet.cover.title}の表紙画像`}
				captionDate={content.booklet.cover.period.start_date}
				image={content.booklet.cover.image}
				region={geometry.image}
				scene={scene}
				treatment={scene.config.imageTreatment?.treatment ?? null}
			/>
			<Region
				className="program-cover-mark"
				effectRegionId="cover"
				region={geometry.image}
				regionId="cover"
				scene={scene}
			/>
			<Region
				className="program-period-region"
				region={geometry.period}
				regionId="period"
				scene={scene}
			>
				<PeriodText booklet={content.booklet} />
			</Region>
		</ProgramPage>
	);
}

const CHAPTER_TITLES = {
	day: (dayNumber: number) => `第${dayNumber}章 ${dayNumber}日目`,
	departure: (dayNumber: number) => `第${dayNumber}章 出発`,
	return: (dayNumber: number) => `第${dayNumber}章 帰路`,
} as const;

const MEMO_TITLES = {
	checklist: "チェックリスト",
	"memory-album": "アルバム",
	mission: "ミッション",
	stamp: "スタンプラリー",
} as const;

/**
 * Divider, memo and endcap pages. Their text is limited to dates, existing
 * place names, fixed labels and blank fields; nothing is invented.
 */
function ExtraPage({
	context,
	mode,
	page,
	pageId,
	pageNumber,
	spec,
}: {
	readonly context: SceneRenderContext;
	readonly mode: SceneRenderMode;
	readonly page: Pick<
		LocalPage,
		"compositionId" | "kind" | "localPageId" | "unitRefs"
	>;
	readonly pageId?: string;
	readonly pageNumber?: number;
	readonly spec: AnySceneSpec;
}) {
	const { scene, content } = spec;
	const refs = new Set(page.unitRefs);
	const measuring = mode === "measurement";
	const heading = (text: string) => (
		<h2
			className="program-extra-title"
			data-booklet-text-role="extra-title"
			data-program-extra-title="true"
		>
			{text}
		</h2>
	);
	let body: ReactNode = null;
	let title: ReactNode = null;
	if (scene.kind === "divider" && content.day) {
		title = heading(CHAPTER_TITLES[scene.chapterRole](content.day.dayNumber));
		body = (
			<>
				<ItineraryImage
					alt={`${content.day.dayNumber}日目の挿絵`}
					captionDate={null}
					image={content.day.illustration}
					region={EXTRA_COVER_GEOMETRY.image}
					scene={scene}
					treatment={null}
				/>
				<Region
					region={EXTRA_COVER_GEOMETRY.period}
					regionId="period"
					scene={scene}
				>
					<p className="program-period" data-booklet-text-role="extra-date">
						{formatBookletDate(content.day.date)}
					</p>
				</Region>
			</>
		);
	}
	if (scene.kind === "endcap") {
		title = heading("旅の終わり");
		body = (
			<>
				<Region
					region={EXTRA_COVER_GEOMETRY.image}
					regionId="image"
					scene={scene}
				>
					<svg
						aria-hidden="true"
						className="program-endcap-line"
						preserveAspectRatio="none"
						viewBox="0 0 100 10"
					>
						<line x1="0" x2="100" y1="5" y2="5" />
					</svg>
				</Region>
				<Region
					region={EXTRA_COVER_GEOMETRY.period}
					regionId="period"
					scene={scene}
				>
					<p className="program-period" data-booklet-text-role="extra-date">
						帰路　{formatBookletDate(content.booklet.cover.period.end_date)}
					</p>
				</Region>
			</>
		);
	}
	if (scene.kind === "memo" && content.day) {
		title = heading(
			`${content.day.dayNumber}日目 ${MEMO_TITLES[scene.participation]}`,
		);
		body =
			scene.participation === "memory-album" ? (
				<>
					<div
						className="program-album__photo"
						style={{ height: `${MEMORY_ALBUM_PHOTO.heightMm}mm` }}
					>
						<span data-booklet-text-role="album-label">今日の一枚</span>
					</div>
					<div
						className="program-album__note"
						style={{
							height: `${MEMORY_ALBUM_NOTE.heightMm}mm`,
							marginTop: `${MEMORY_ALBUM_NOTE.yMm - MEMORY_ALBUM_PHOTO.yMm - MEMORY_ALBUM_PHOTO.heightMm}mm`,
						}}
					>
						<span data-booklet-text-role="album-label">ひとこと</span>
					</div>
				</>
			) : (
				content.referencedUnits
					.filter((unit) => measuring || refs.has(unit.id))
					.map((unit, index) => (
						<div
							className={`program-memo-entry program-memo-entry--${scene.participation}`}
							data-program-measure-entry={measuring ? index : undefined}
							data-unit-ref={measuring ? undefined : unit.id}
							key={unit.id}
						>
							{scene.participation === "checklist" ||
							scene.participation === "mission" ? (
								<span
									className="program-memo-entry__checkbox"
									aria-hidden="true"
								/>
							) : null}
							<span
								className="program-memo-entry__text"
								data-booklet-text-role="memo-entry"
							>
								訪問：{unit.spotName}
							</span>
							{scene.participation === "stamp" ? (
								<span
									className="program-memo-entry__stamp"
									aria-hidden="true"
								/>
							) : null}
							{scene.participation === "mission" ? (
								<span
									className="program-memo-entry__done"
									data-booklet-text-role="memo-label"
								>
									達成
								</span>
							) : null}
						</div>
					))
			);
	}
	const memo = scene.kind === "memo";
	return (
		<ProgramPage
			mode={mode}
			page={page}
			pageId={pageId}
			pageNumber={pageNumber}
			spec={spec}
			style={context.style}
		>
			<Region
				className="program-title-region"
				region={memo ? MEMO_HEADING : EXTRA_COVER_GEOMETRY.title}
				regionId="title"
				scene={scene}
			>
				{title}
			</Region>
			<Region
				className={memo ? "program-memo-body" : "program-extra-page"}
				effectRegionId={memo ? "memo" : "page"}
				region={EXTRA_PAGE_BODY_RECT}
				regionId={memo ? "memo" : "page"}
				scene={scene}
			>
				{memo ? body : null}
			</Region>
			{memo ? null : body}
		</ProgramPage>
	);
}

/* ---- Measurement DOM ---- */

/**
 * The same page parts, widths and CSS as the output. Every owned unit is
 * stacked once without gaps so each block's own height can be read; the
 * page plan is never an input here.
 */
export function StructuredMeasure({
	context,
	definition,
	spec,
}: {
	readonly context: SceneRenderContext;
	readonly definition: StructuredModuleDefinition;
	readonly spec: AnySceneSpec;
}) {
	const { scene } = spec;
	const probe = {
		compositionId: scene.config.compositionId,
		localPageId: "measure",
	};
	if (scene.kind === "cover")
		return (
			<CoverPage
				context={context}
				definition={definition}
				mode="measurement"
				page={{ ...probe, kind: "cover" }}
				spec={spec}
			/>
		);
	if (scene.kind !== "day")
		return (
			<ExtraPage
				context={context}
				mode="measurement"
				page={{ ...probe, kind: scene.kind, unitRefs: [] }}
				spec={spec}
			/>
		);
	const structure = structureOf(spec);
	const geometry = dayGeometry(definition, spec, false);
	const emptyPage: BodyLocalPage = {
		...probe,
		columns: [],
		firstUnitNumber: 1,
		kind: "first",
		layoutVariant: null,
		unitHeightsMm: null,
		unitIds: [],
		unitRefs: [],
	};
	return (
		<>
			<DayPage
				context={context}
				definition={definition}
				mode="measurement"
				page={emptyPage}
				spec={{ ...spec, content: { ...spec.content, ownedUnits: [] } }}
			/>
			<ProgramPage
				mode="measurement"
				page={{ ...probe, kind: "continuation" }}
				spec={spec}
				style={context.style}
			>
				<Region
					className={`program-body program-body--${structure.id} program-body--measure`}
					region={{ ...geometry.body, heightMm: 400 }}
					regionId="body"
					scene={scene}
				>
					<div
						className="program-body__column"
						data-program-measure-column="true"
						style={{
							width: `${columnWidthMm(structure, geometry.body.widthMm)}mm`,
						}}
					>
						{spec.content.ownedUnits.map((unit, index) => (
							<UnitBlock
								key={unit.id}
								measureIndex={index}
								number={spec.content.firstUnitOffset + index + 1}
								scene={scene}
								structure={structure}
								unit={unit}
							/>
						))}
					</div>
				</Region>
			</ProgramPage>
		</>
	);
}

/** Content-box width of a unit's text, the width its lines wrap at. */
function textBoxWidthMm(unit: HTMLElement): number {
	const box =
		unit.querySelector<HTMLElement>("[data-program-text-box]") ?? unit;
	const style = getComputedStyle(box);
	// A border only takes width when it is drawn.
	const border = (width: string, lineStyle: string) =>
		lineStyle === "" || lineStyle === "none" || lineStyle === "hidden"
			? "0"
			: width;
	const insetPx = [
		style.paddingLeft,
		style.paddingRight,
		border(style.borderLeftWidth, style.borderLeftStyle),
		border(style.borderRightWidth, style.borderRightStyle),
	]
		.map((value) => Number.parseFloat(value))
		.filter(Number.isFinite)
		.reduce((total, value) => total + value, 0);
	return (
		(box.getBoundingClientRect().width - insetPx) *
		pageScaleOf(closestPage(box))
	);
}

export function measureStructured(
	root: HTMLElement,
	spec: AnySceneSpec,
): CoverMeasurement | BodyMeasurement | ExtraMeasurement {
	const { scene } = spec;
	if (scene.kind === "cover") {
		const title = requireElement(
			root,
			'[data-program-region="title"]',
			"表紙の題名枠",
		);
		const period = requireElement(
			root,
			'[data-program-region="period"]',
			"表紙の期間枠",
		);
		return {
			kind: "cover",
			period: titleMeasurementOf(
				period,
				requireElement(period, "[data-program-period]", "表紙の期間"),
			),
			styleKey: spec.styleKey,
			title: titleMeasurementOf(
				title,
				requireElement(title, "[data-program-title]", "表紙の題名"),
			),
			titleSizePt: null,
		};
	}
	if (scene.kind !== "day") {
		const title = requireElement(
			root,
			'[data-program-region="title"]',
			"見出し枠",
		);
		return {
			entryHeightsMm: Array.from(
				root.querySelectorAll<HTMLElement>("[data-program-measure-entry]"),
				heightMmOf,
			),
			heading: titleMeasurementOf(
				title,
				requireElement(title, "[data-program-extra-title]", "見出し"),
			),
			kind: scene.kind,
			styleKey: spec.styleKey,
		};
	}
	const heading = requireElement(
		root,
		'[data-program-region="heading"]',
		"日見出し枠",
	);
	const units = Array.from(
		root.querySelectorAll<HTMLElement>("[data-program-measure-unit]"),
	);
	const empty = requireElement(root, ".program-empty-day", "空日文言");
	return {
		emptyHeightMm: heightMmOf(empty),
		heading: titleMeasurementOf(
			heading,
			requireElement(heading, "[data-program-heading]", "日見出し"),
		),
		kind: "day",
		styleKey: spec.styleKey,
		textWidthMm: units[0] ? textBoxWidthMm(units[0]) : 0,
		unitHeightsMm: units.map(heightMmOf),
	};
}

/** Output pages of one planned scene. */
export function StructuredPages({
	assembled,
	context,
	definition,
	spec,
}: {
	readonly assembled: readonly AssembledPage[];
	readonly context: SceneRenderContext;
	readonly definition: StructuredModuleDefinition;
	readonly spec: AnySceneSpec;
}) {
	return (
		<>
			{assembled.map((item) => {
				const page = item.page;
				const props = {
					context,
					mode: "output" as const,
					pageId: item.pageId,
					pageNumber: item.pageNumber,
					spec,
				};
				if (page.kind === "cover")
					return (
						<CoverPage
							{...props}
							definition={definition}
							key={item.pageId}
							page={page}
						/>
					);
				if (page.kind === "first" || page.kind === "continuation")
					return (
						<DayPage
							{...props}
							definition={definition}
							key={item.pageId}
							page={page}
						/>
					);
				return <ExtraPage {...props} key={item.pageId} page={page} />;
			})}
		</>
	);
}

/* ---- Registration helpers for the seven structured modules ---- */

export function coverOrBody(
	measurement: CoverMeasurement | BodyMeasurement | ExtraMeasurement,
): CoverMeasurement | BodyMeasurement {
	if (measurement.kind === "cover" || measurement.kind === "day")
		return measurement;
	throw new BookletLayoutError(
		"dom-not-ready",
		`このmoduleは${measurement.kind}を描けません。`,
	);
}

export function bodyOnly(
	measurement: CoverMeasurement | BodyMeasurement | ExtraMeasurement,
): BodyMeasurement {
	if (measurement.kind === "day") return measurement;
	throw new BookletLayoutError(
		"dom-not-ready",
		`このmoduleは${measurement.kind}を描けません。`,
	);
}

/** Fonts of the scene style and only the artwork frozen into its bindings. */
export function structuredResources(
	spec: AnySceneSpec,
	context: SceneRenderContext,
) {
	return {
		artworkIds: spec.scene.config.bindings.flatMap((binding) =>
			binding.assetId ? [binding.assetId] : [],
		),
		fonts: context.style.fonts,
	};
}

/** Nothing module-specific beyond the shared final checks. */
export function noModuleChecks(): void {}
