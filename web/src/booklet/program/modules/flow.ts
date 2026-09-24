import { PaginationError } from "../../paginationError";

/** Absorbs float noise in mm sums; far below print precision. */
const FLOW_EPSILON_MM = 1e-6;

export type FlowMeasurement = {
	/** Body capacity of each column on the first page of the scene. */
	readonly firstCapacityMm: number;
	/** Body capacity of each column on a continuation page. */
	readonly continuationCapacityMm: number;
	/** Space between two units of one column. */
	readonly gapMm: number;
	/** Measured height of every unit, in input order. */
	readonly unitHeightsMm: readonly number[];
};

export type FlowOptions = {
	readonly columns: number;
	/** schematic-map draws at most this many nodes per page. */
	readonly maxUnitsPerPage?: number;
};

/** Unit indexes per column; a single-column page has one column. */
export type FlowPage = {
	readonly columns: readonly (readonly number[])[];
	readonly continuation: boolean;
};

export function requireMeasuredMm(value: number, name: string): number {
	if (!Number.isFinite(value) || value < 0) {
		throw new PaginationError("invalid-measurement", `${name}が不正です。`);
	}
	return value;
}

function requireCapacity(value: number, name: string): number {
	requireMeasuredMm(value, name);
	if (value <= 0) {
		throw new PaginationError("invalid-measurement", `${name}が不正です。`);
	}
	return value;
}

/**
 * Fills columns in input order: `used + gap + unit <= capacity` stays in the
 * column, otherwise the unit moves to the next column, then to a
 * continuation page. A unit that does not fit an empty first-page column but
 * fits a continuation leaves the first page (its heading and images) in
 * place and moves on. A unit taller than an empty continuation column is
 * `unit-overflow`. The scene never ends with an empty continuation page, and
 * an empty day is one first page without units.
 */
export function flowUnits(
	measurement: FlowMeasurement,
	options: FlowOptions,
): readonly FlowPage[] {
	const first = requireCapacity(measurement.firstCapacityMm, "初頁の本文容量");
	const continuation = requireCapacity(
		measurement.continuationCapacityMm,
		"継続頁の本文容量",
	);
	const gap = requireMeasuredMm(measurement.gapMm, "予定の間隔");
	if (!Number.isInteger(options.columns) || options.columns < 1) {
		throw new PaginationError("invalid-measurement", "列数が不正です。");
	}
	const maxUnits = options.maxUnitsPerPage ?? Number.POSITIVE_INFINITY;
	if (!(maxUnits >= 1)) {
		throw new PaginationError(
			"invalid-measurement",
			"1頁の最大予定数が不正です。",
		);
	}
	measurement.unitHeightsMm.forEach((height, index) => {
		requireCapacity(height, `予定 ${index + 1}の高さ`);
	});

	const pages: { columns: number[][]; continuation: boolean }[] = [];
	const openPage = (isContinuation: boolean) => {
		const page = {
			columns: Array.from({ length: options.columns }, () => [] as number[]),
			continuation: isContinuation,
		};
		pages.push(page);
		return page;
	};
	let page = openPage(false);
	let columnIndex = 0;
	let used = 0;
	let unitsOnPage = 0;
	const capacityOf = (isContinuation: boolean) =>
		isContinuation ? continuation : first;
	const nextPage = () => {
		page = openPage(true);
		columnIndex = 0;
		used = 0;
		unitsOnPage = 0;
	};

	measurement.unitHeightsMm.forEach((height, unitIndex) => {
		if (height > continuation + FLOW_EPSILON_MM) {
			throw new PaginationError(
				"unit-overflow",
				`予定 ${unitIndex + 1}が継続頁の一列にも収まりません。`,
			);
		}
		for (;;) {
			const column = page.columns[columnIndex] ?? [];
			const needed = (column.length === 0 ? 0 : gap) + height;
			if (
				unitsOnPage < maxUnits &&
				used + needed <= capacityOf(page.continuation) + FLOW_EPSILON_MM
			) {
				column.push(unitIndex);
				used += needed;
				unitsOnPage += 1;
				return;
			}
			if (unitsOnPage < maxUnits && columnIndex + 1 < options.columns) {
				columnIndex += 1;
				used = 0;
				continue;
			}
			nextPage();
		}
	});

	return Object.freeze(
		pages.map((item) =>
			Object.freeze({
				columns: Object.freeze(
					item.columns.map((column) => Object.freeze([...column])),
				),
				continuation: item.continuation,
			}),
		),
	);
}

/** Units of a flow page in reading order: left column top to bottom, then right. */
export function flowPageUnitIndexes(page: FlowPage): readonly number[] {
	return page.columns.flat();
}
