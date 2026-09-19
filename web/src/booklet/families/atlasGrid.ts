import type { EditorialBooklet } from "../editorialModel";
import { PaginationError } from "../paginate";

export type AtlasGridDayMeasurement = {
	readonly bandHeight: number;
	readonly emptyRowHeight: number;
	readonly rowHeights: readonly number[];
};

export type AtlasGridMeasurement = {
	readonly bodyHeight: number;
	readonly days: readonly AtlasGridDayMeasurement[];
};

export type AtlasGridCoverPagePlan = {
	readonly kind: "cover";
	readonly pageId: string;
};

export type AtlasGridDaySectionPlan = {
	readonly continuation: boolean;
	readonly dayIndex: number;
	readonly unitIndexes: readonly number[];
};

export type AtlasGridTablePagePlan = {
	readonly kind: "table";
	readonly pageId: string;
	readonly sections: readonly AtlasGridDaySectionPlan[];
};

export type AtlasGridPagePlan = AtlasGridCoverPagePlan | AtlasGridTablePagePlan;

type MutableSection = {
	continuation: boolean;
	dayIndex: number;
	unitIndexes: number[];
};

type MutablePage = {
	sections: MutableSection[];
	usedHeight: number;
};

function requirePositiveFinite(value: number, name: string): number {
	if (!Number.isFinite(value) || value <= 0) {
		throw new PaginationError("invalid-measurement", `${name}が不正です。`);
	}
	return value;
}

function validateMeasurement(
	booklet: EditorialBooklet,
	measurement: AtlasGridMeasurement,
): void {
	requirePositiveFinite(measurement.bodyHeight, "表本体の高さ");
	if (measurement.days.length !== booklet.days.length) {
		throw new PaginationError(
			"invalid-measurement",
			"日ごとの計測結果の件数が一致しません。",
		);
	}
	booklet.days.forEach((day, dayIndex) => {
		const dayMeasurement = measurement.days[dayIndex];
		if (!dayMeasurement) {
			throw new PaginationError(
				"invalid-measurement",
				`Day ${dayIndex + 1}の計測結果がありません。`,
			);
		}
		requirePositiveFinite(
			dayMeasurement.bandHeight,
			`Day ${dayIndex + 1}の日付帯の高さ`,
		);
		requirePositiveFinite(
			dayMeasurement.emptyRowHeight,
			`Day ${dayIndex + 1}の空行の高さ`,
		);
		if (dayMeasurement.rowHeights.length !== day.units.length) {
			throw new PaginationError(
				"invalid-measurement",
				`Day ${dayIndex + 1}の行計測結果の件数が一致しません。`,
			);
		}
		dayMeasurement.rowHeights.forEach((height, unitIndex) => {
			requirePositiveFinite(
				height,
				`Day ${dayIndex + 1}の行 ${unitIndex + 1}の高さ`,
			);
		});
	});
}

export function paginateAtlasGrid(
	booklet: EditorialBooklet,
	measurement: AtlasGridMeasurement,
): readonly AtlasGridPagePlan[] {
	if (booklet.days.length === 0) {
		return Object.freeze([
			{ kind: "cover", pageId: `atlas-cover-${booklet.journeyId}` },
		]);
	}
	validateMeasurement(booklet, measurement);
	const tablePages: MutablePage[] = [];
	let currentPage: MutablePage | null = null;

	const startPage = (): MutablePage => {
		const page = { sections: [], usedHeight: 0 };
		tablePages.push(page);
		currentPage = page;
		return page;
	};

	booklet.days.forEach((day, dayIndex) => {
		const dayMeasurement = measurement.days[dayIndex];
		if (!dayMeasurement) {
			throw new PaginationError(
				"invalid-measurement",
				`Day ${dayIndex + 1}の計測結果がありません。`,
			);
		}
		const unitIndexes = day.units.map((_unit, unitIndex) => unitIndex);
		const rowIndexes: readonly (number | null)[] =
			unitIndexes.length > 0 ? unitIndexes : [null];

		rowIndexes.forEach((unitIndex, rowIndex) => {
			const rowHeight =
				unitIndex === null
					? dayMeasurement.emptyRowHeight
					: dayMeasurement.rowHeights[unitIndex];
			if (rowHeight === undefined) {
				throw new PaginationError(
					"invalid-measurement",
					`Day ${dayIndex + 1}の行 ${rowIndex + 1}の高さがありません。`,
				);
			}
			if (dayMeasurement.bandHeight + rowHeight > measurement.bodyHeight) {
				throw new PaginationError(
					"unit-overflow",
					`Day ${dayIndex + 1}の行 ${rowIndex + 1}が1ページに収まりません。`,
				);
			}

			const needsBand = rowIndex === 0;
			const requiredHeight =
				rowHeight + (needsBand ? dayMeasurement.bandHeight : 0);
			if (
				currentPage === null ||
				currentPage.usedHeight + requiredHeight > measurement.bodyHeight
			) {
				const page = startPage();
				page.sections.push({
					continuation: rowIndex > 0,
					dayIndex,
					unitIndexes: unitIndex === null ? [] : [unitIndex],
				});
				page.usedHeight = dayMeasurement.bandHeight + rowHeight;
				return;
			}

			if (needsBand) {
				currentPage.sections.push({
					continuation: false,
					dayIndex,
					unitIndexes: unitIndex === null ? [] : [unitIndex],
				});
				currentPage.usedHeight += requiredHeight;
				return;
			}

			const section = currentPage.sections.at(-1);
			if (!section || section.dayIndex !== dayIndex) {
				throw new PaginationError(
					"invalid-measurement",
					`Day ${dayIndex + 1}の継続先がありません。`,
				);
			}
			section.unitIndexes.push(unitIndex as number);
			currentPage.usedHeight += rowHeight;
		});
	});

	return Object.freeze([
		{ kind: "cover", pageId: `atlas-cover-${booklet.journeyId}` },
		...tablePages.map((page, pageIndex) =>
			Object.freeze({
				kind: "table" as const,
				pageId: `atlas-table-${booklet.journeyId}-${pageIndex + 1}`,
				sections: Object.freeze(
					page.sections.map((section) =>
						Object.freeze({
							...section,
							unitIndexes: Object.freeze([...section.unitIndexes]),
						}),
					),
				),
			}),
		),
	]);
}
