import type { EditorialBooklet } from "../../editorialModel";
import {
	PaginationError,
	type PaginationFailureCode,
} from "../../paginationError";
import { bodyStructureFor, maxUnitsPerPage } from "../bodyStructures";
import type {
	AnySceneSpec,
	BodyLocalPage,
	BodyMeasurement,
	CoverLocalPage,
	CoverMeasurement,
	FamilyDayMeasurement,
	StructuredBodyMeasurement,
	TitleMeasurement,
} from "../model";
import { flowUnits, requireMeasuredMm } from "./flow";

/** One CSS px at 96dpi; the same rounding allowance the families use. */
export const LAYOUT_TOLERANCE_MM = 25.4 / 96;
/** Widths are laid out from mm values, so only float noise may differ. */
const WIDTH_TOLERANCE_MM = 0.05;

export function requireSameStyle(
	spec: AnySceneSpec,
	measurement: { readonly styleKey: string },
): void {
	if (measurement.styleKey !== spec.styleKey) {
		throw new PaginationError(
			"invalid-measurement",
			`scene「${spec.scene.sceneId}」の計測styleが出力と一致しません。`,
		);
	}
}

export function requireMeasurementKind<
	T extends { readonly kind: string },
	K extends T["kind"],
>(
	spec: AnySceneSpec,
	measurement: T,
	kind: K,
): asserts measurement is Extract<T, { readonly kind: K }> {
	if (measurement.kind !== kind) {
		throw new PaginationError(
			"invalid-measurement",
			`scene「${spec.scene.sceneId}」の計測種別が「${measurement.kind}」です（期待値: ${kind}）。`,
		);
	}
}

/** A reserved title or heading must hold its text without shrinking it. */
export function requireTitleFits(
	title: TitleMeasurement,
	code: PaginationFailureCode,
	name: string,
): void {
	for (const [value, label] of [
		[title.contentHeightMm, "高さ"],
		[title.contentWidthMm, "幅"],
		[title.reservedHeightMm, "予約高"],
		[title.reservedWidthMm, "予約幅"],
	] as const) {
		requireMeasuredMm(value, `${name}の${label}`);
	}
	if (
		title.contentHeightMm > title.reservedHeightMm + LAYOUT_TOLERANCE_MM ||
		title.contentWidthMm > title.reservedWidthMm + LAYOUT_TOLERANCE_MM
	) {
		const size = (width: number, height: number) =>
			`${width.toFixed(1)}×${height.toFixed(1)}mm`;
		throw new PaginationError(
			code,
			`${name}が予約領域に収まりません（内容 ${size(title.contentWidthMm, title.contentHeightMm)}／予約 ${size(title.reservedWidthMm, title.reservedHeightMm)}）。`,
		);
	}
}

export function requireTextWidth(
	spec: AnySceneSpec,
	actualMm: number,
	expectedMm: number,
): void {
	requireMeasuredMm(actualMm, "本文の計測幅");
	if (Math.abs(actualMm - expectedMm) > WIDTH_TOLERANCE_MM) {
		throw new PaginationError(
			"invalid-measurement",
			`scene「${spec.scene.sceneId}」の本文を${actualMm.toFixed(2)}mm幅で計測しました（期待値: ${expectedMm}mm）。`,
		);
	}
}

export function coverPage(
	spec: AnySceneSpec,
	measurement: CoverMeasurement,
	compositionId: string,
): CoverLocalPage {
	requireSameStyle(spec, measurement);
	requireTitleFits(measurement.title, "cover-block-overflow", "表紙の題名");
	requireTitleFits(measurement.period, "cover-block-overflow", "表紙の期間");
	return Object.freeze({
		compositionId,
		kind: "cover",
		localPageId: "cover",
		titleSizePt: measurement.titleSizePt,
		unitIds: Object.freeze([]),
		unitRefs: Object.freeze([]),
	});
}

export type BodyFlowOptions = {
	readonly columns: number;
	readonly compositionId: string;
	/** Body capacity of one column on the first page, before `headerMm`. */
	readonly continuationCapacityMm: number;
	readonly firstCapacityMm: number;
	readonly gapMm: number;
	/** Reserved at the top of every page's body by the structure. */
	readonly headerMm: number;
	readonly layoutVariant: string | null;
	readonly maxUnitsPerPage: number | null;
	readonly textWidthMm: number;
};

/**
 * Day pages of a module whose body follows a registered body structure
 * (its native body or a transplanted content structure).
 */
export function structuredBodyPages(
	spec: AnySceneSpec,
	measurement: BodyMeasurement,
	capacity: {
		readonly compositionId: string;
		readonly continuationCapacityMm: number;
		readonly firstCapacityMm: number;
	},
): readonly BodyLocalPage[] {
	const structure = bodyStructureFor(spec.scene);
	if (!structure) {
		throw new Error(`module「${spec.scene.moduleId}」の本文構造が未登録です。`);
	}
	return bodyPages(spec, measurement, {
		columns: structure.columns,
		compositionId: capacity.compositionId,
		continuationCapacityMm: capacity.continuationCapacityMm,
		firstCapacityMm: capacity.firstCapacityMm,
		gapMm: structure.gapMm,
		headerMm: structure.headerMm,
		layoutVariant: null,
		maxUnitsPerPage: maxUnitsPerPage(spec.scene),
		textWidthMm: structure.textWidthMm,
	});
}

/**
 * Pages of one day scene. The heading must fit its reserved region, units are
 * placed by `flowUnits`, and an empty day is one first page whose empty-day
 * text sits where the body starts.
 */
export function bodyPages(
	spec: AnySceneSpec,
	measurement: BodyMeasurement,
	options: BodyFlowOptions,
): readonly BodyLocalPage[] {
	requireSameStyle(spec, measurement);
	requireTitleFits(measurement.heading, "day-header-overflow", "日見出し");
	const units = spec.content.ownedUnits;
	if (measurement.unitHeightsMm.length !== units.length) {
		throw new PaginationError(
			"invalid-measurement",
			`scene「${spec.scene.sceneId}」の予定計測件数が一致しません。`,
		);
	}
	const firstCapacityMm = options.firstCapacityMm - options.headerMm;
	const continuationCapacityMm =
		options.continuationCapacityMm - options.headerMm;
	if (units.length === 0) {
		requireMeasuredMm(measurement.emptyHeightMm, "空日文言の高さ");
		if (measurement.emptyHeightMm > firstCapacityMm) {
			throw new PaginationError(
				"unit-overflow",
				`scene「${spec.scene.sceneId}」の空日文言が本文領域に収まりません。`,
			);
		}
		return localBodyPages(
			spec,
			[
				{
					columns: Array.from({ length: options.columns }, () => []),
					continuation: false,
					unitHeightsMm: null,
				},
			],
			options.compositionId,
			options.layoutVariant,
		);
	}
	requireTextWidth(spec, measurement.textWidthMm, options.textWidthMm);
	const flow = flowUnits(
		{
			continuationCapacityMm,
			firstCapacityMm,
			gapMm: options.gapMm,
			unitHeightsMm: measurement.unitHeightsMm,
		},
		{
			columns: options.columns,
			maxUnitsPerPage: options.maxUnitsPerPage ?? undefined,
		},
	);
	return localBodyPages(
		spec,
		flow.map((page) => ({ ...page, unitHeightsMm: null })),
		options.compositionId,
		options.layoutVariant,
	);
}

/** A module's own page split, with unit indexes into the scene's owned units. */
export type IndexedBodyPage = {
	readonly columns: readonly (readonly number[])[];
	readonly continuation: boolean;
	readonly unitHeightsMm: readonly number[] | null;
};

/**
 * Turns index-based pages into local pages `p1`, `p2`… with unit IDs and the
 * day-running number of each page's first unit.
 */
export function localBodyPages(
	spec: AnySceneSpec,
	pages: readonly IndexedBodyPage[],
	compositionId: string,
	layoutVariant: string | null,
): readonly BodyLocalPage[] {
	const units = spec.content.ownedUnits;
	const idOf = (unitIndex: number) => {
		const unit = units[unitIndex];
		if (!unit)
			throw new PaginationError(
				"invalid-measurement",
				`予定 ${unitIndex + 1}がありません。`,
			);
		return unit.id;
	};
	let placed = 0;
	return Object.freeze(
		pages.map((page, pageIndex) => {
			const columns = page.columns.map((column) =>
				Object.freeze(column.map(idOf)),
			);
			const unitIds = columns.flat();
			const firstUnitNumber = spec.content.firstUnitOffset + placed + 1;
			placed += unitIds.length;
			return Object.freeze({
				columns: Object.freeze(columns),
				compositionId,
				firstUnitNumber,
				kind: page.continuation
					? ("continuation" as const)
					: ("first" as const),
				layoutVariant,
				localPageId: `p${pageIndex + 1}`,
				unitHeightsMm: page.unitHeightsMm
					? Object.freeze([...page.unitHeightsMm])
					: null,
				unitIds: Object.freeze(unitIds),
				unitRefs: Object.freeze([]),
			});
		}),
	);
}

/**
 * An extracted family whose body is a transplanted content structure: the
 * family's measured body capacity, the structure's own flow rules.
 */
export function structuredFamilyPages(
	spec: AnySceneSpec,
	measurement: StructuredBodyMeasurement,
	compositionId: string,
): readonly BodyLocalPage[] {
	requireMeasuredMm(measurement.bodyWidthMm, "本文領域の幅");
	const structure = bodyStructureFor(spec.scene, measurement.bodyWidthMm);
	if (!structure || !spec.scene.config.contentStructure) {
		throw new PaginationError(
			"invalid-measurement",
			`scene「${spec.scene.sceneId}」は移植された本文構造を持ちません。`,
		);
	}
	return bodyPages(
		spec,
		{ ...measurement, kind: "day" },
		{
			columns: structure.columns,
			compositionId,
			continuationCapacityMm: measurement.continuationCapacityMm,
			firstCapacityMm: measurement.firstCapacityMm,
			gapMm: structure.gapMm,
			headerMm: structure.headerMm,
			layoutVariant: null,
			maxUnitsPerPage: maxUnitsPerPage(spec.scene),
			textWidthMm: structure.textWidthMm,
		},
	);
}

/** The scene's single day as a one-day booklet for a family's day function. */
export function sceneBooklet(spec: AnySceneSpec): EditorialBooklet {
	const day = spec.content.day;
	if (!day) {
		throw new PaginationError(
			"invalid-measurement",
			`scene「${spec.scene.sceneId}」に日がありません。`,
		);
	}
	return { ...spec.content.booklet, days: [day] };
}

/** The family's own day heading must fit where the family reserved it. */
export function requireFamilyDay(
	spec: AnySceneSpec,
	measurement: FamilyDayMeasurement<unknown>,
): void {
	requireSameStyle(spec, measurement);
	requireTitleFits(measurement.heading, "day-header-overflow", "日見出し");
}
