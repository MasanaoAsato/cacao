import type { BookletModel, BookletPagePlan } from "./model";

export type DayPageMeasurement = {
	readonly continuationHeaderHeight: number;
	readonly headerHeight: number;
	readonly unitHeights: readonly number[];
};

export type BookletPageMeasurement = {
	readonly contentHeight: number;
	readonly coverHeight: number;
	readonly days: readonly DayPageMeasurement[];
};

export class PaginationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "PaginationError";
	}
}

function requireNonNegativeFinite(value: number, name: string): number {
	if (!Number.isFinite(value) || value < 0) {
		throw new PaginationError(`${name}が不正です。`);
	}

	return value;
}

function requirePositiveFinite(value: number, name: string): number {
	if (!Number.isFinite(value) || value <= 0) {
		throw new PaginationError(`${name}が不正です。`);
	}

	return value;
}

function validateMeasurement(
	model: BookletModel,
	measurement: BookletPageMeasurement,
): void {
	requirePositiveFinite(measurement.contentHeight, "ページ本文高さ");
	requireNonNegativeFinite(measurement.coverHeight, "表紙高さ");
	if (measurement.days.length !== model.days.length) {
		throw new PaginationError("日ごとの計測結果の件数が一致しません。");
	}

	measurement.days.forEach((dayMeasurement, dayIndex) => {
		requireNonNegativeFinite(
			dayMeasurement.headerHeight,
			`days[${dayIndex}].headerHeight`,
		);
		requireNonNegativeFinite(
			dayMeasurement.continuationHeaderHeight,
			`days[${dayIndex}].continuationHeaderHeight`,
		);
		if (
			dayMeasurement.unitHeights.length !== model.days[dayIndex]?.units.length
		) {
			throw new PaginationError(
				`days[${dayIndex}]の単位計測件数が一致しません。`,
			);
		}
		dayMeasurement.unitHeights.forEach((height, unitIndex) => {
			requireNonNegativeFinite(height, `days[${dayIndex}].units[${unitIndex}]`);
		});
	});
}

function ensureFits(
	height: number,
	availableHeight: number,
	name: string,
): void {
	if (height > availableHeight) {
		throw new PaginationError(`${name}が1ページに収まりません。`);
	}
}

export function paginateBooklet(
	model: BookletModel,
	measurement: BookletPageMeasurement,
): readonly BookletPagePlan[] {
	validateMeasurement(model, measurement);
	ensureFits(measurement.coverHeight, measurement.contentHeight, "表紙");

	const pages: BookletPagePlan[] = [{ kind: "cover", pageId: "cover" }];

	model.days.forEach((day, dayIndex) => {
		const dayMeasurement = measurement.days[dayIndex];
		if (!dayMeasurement) {
			throw new PaginationError(`days[${dayIndex}]の計測結果がありません。`);
		}

		let continuation = false;
		let headerHeight = dayMeasurement.headerHeight;
		let unitIndexes: number[] = [];
		let usedHeight = headerHeight;

		ensureFits(
			headerHeight,
			measurement.contentHeight,
			`Day ${dayIndex + 1}のヘッダー`,
		);

		const appendPage = () => {
			pages.push({
				continuation,
				dayIndex,
				kind: "day",
				pageId: `day-${day.id}-${pages.length + 1}`,
				unitIndexes,
			});
		};

		for (const [unitIndex] of day.units.entries()) {
			const unitHeight = dayMeasurement.unitHeights[unitIndex];
			if (unitHeight === undefined) {
				throw new PaginationError(
					`Day ${dayIndex + 1}のSpot計測結果がありません。`,
				);
			}

			ensureFits(
				headerHeight + unitHeight,
				measurement.contentHeight,
				`Day ${dayIndex + 1}のSpot ${unitIndex + 1}`,
			);

			if (usedHeight + unitHeight > measurement.contentHeight) {
				if (unitIndexes.length === 0) {
					throw new PaginationError(
						`Day ${dayIndex + 1}のSpot ${unitIndex + 1}が収まりません。`,
					);
				}

				appendPage();
				continuation = true;
				headerHeight = dayMeasurement.continuationHeaderHeight;
				ensureFits(
					headerHeight + unitHeight,
					measurement.contentHeight,
					`Day ${dayIndex + 1}のSpot ${unitIndex + 1}`,
				);
				unitIndexes = [];
				usedHeight = headerHeight;
			}

			unitIndexes.push(unitIndex);
			usedHeight += unitHeight;
		}

		appendPage();
	});

	return pages;
}
