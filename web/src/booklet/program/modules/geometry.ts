/**
 * A5 rectangles of the seven modules added in 25.4, in mm from the page's
 * top-left corner as (x, y, w, h). Output pages, measurement DOM and the pure
 * paginators all read these numbers so they cannot drift apart.
 */
export type ModuleRect = {
	readonly heightMm: number;
	readonly widthMm: number;
	readonly xMm: number;
	readonly yMm: number;
};

export const rect = (
	xMm: number,
	yMm: number,
	widthMm: number,
	heightMm: number,
): ModuleRect => Object.freeze({ heightMm, widthMm, xMm, yMm });

/** Gap between units when a body structure does not set its own. */
export const DEFAULT_UNIT_GAP_MM = 3;

export type CoverGeometry = {
	/** The existing itinerary cover image. */
	readonly image: ModuleRect;
	readonly period: ModuleRect;
	readonly title: ModuleRect;
	/** woodcut-folio only: the principal woodcut art. */
	readonly hero: ModuleRect | null;
};

export const STANDARD_COVER_GEOMETRY: CoverGeometry = Object.freeze({
	hero: null,
	image: rect(10, 50, 128, 104),
	period: rect(10, 162, 128, 24),
	title: rect(10, 12, 128, 32),
});

export const VERTICAL_POSTER_COVER_GEOMETRY: CoverGeometry = Object.freeze({
	hero: null,
	image: rect(10, 12, 96, 146),
	period: rect(10, 162, 128, 24),
	title: rect(112, 12, 26, 146),
});

export const WOODCUT_COVER_GEOMETRY: CoverGeometry = Object.freeze({
	hero: rect(10, 54, 128, 84),
	image: rect(102, 148, 36, 24),
	period: rect(10, 150, 86, 20),
	title: rect(10, 14, 128, 32),
});

export type DayGeometry = {
	readonly body: ModuleRect;
	readonly heading: ModuleRect;
	/** A module-owned region beside the body (diagram, column headings). */
	readonly extra: ModuleRect | null;
	readonly hero: ModuleRect | null;
	readonly image: ModuleRect | null;
};

export type DayLayout = {
	readonly continuation: DayGeometry;
	readonly first: DayGeometry;
};

const continuationOnly = (
	heading: ModuleRect,
	body: ModuleRect,
	extra: ModuleRect | null = null,
): DayGeometry =>
	Object.freeze({ body, extra, heading, hero: null, image: null });

const STANDARD_DAY_HEADING = rect(10, 10, 128, 24);
const STANDARD_CONTINUATION_BODY = rect(10, 40, 128, 154);

export const WOODCUT_DAY_LAYOUT: DayLayout = Object.freeze({
	continuation: continuationOnly(rect(10, 10, 128, 28), rect(10, 46, 128, 148)),
	first: Object.freeze({
		body: rect(10, 96, 128, 98),
		extra: null,
		heading: rect(10, 10, 128, 28),
		hero: rect(98, 44, 40, 46),
		image: rect(10, 44, 82, 46),
	}),
});

export const SPECIMEN_DAY_LAYOUT: DayLayout = Object.freeze({
	continuation: continuationOnly(
		STANDARD_DAY_HEADING,
		STANDARD_CONTINUATION_BODY,
	),
	first: Object.freeze({
		body: rect(10, 86, 128, 108),
		extra: null,
		heading: STANDARD_DAY_HEADING,
		hero: rect(96, 40, 42, 40),
		image: rect(10, 40, 80, 40),
	}),
});
/** Two 61mm columns 6mm apart; each unit frame keeps a 4mm band and 1mm text guard. */
export const SPECIMEN_COLUMN_MM = 61;
export const SPECIMEN_COLUMN_GAP_MM = 6;
export const SPECIMEN_TEXT_MM = 51;

export const VERTICAL_POSTER_DAY_LAYOUT: DayLayout = Object.freeze({
	continuation: continuationOnly(
		STANDARD_DAY_HEADING,
		STANDARD_CONTINUATION_BODY,
	),
	first: Object.freeze({
		body: rect(10, 96, 128, 98),
		extra: null,
		heading: rect(112, 10, 26, 80),
		hero: null,
		image: rect(10, 10, 96, 80),
	}),
});

export const PHOTO_ESSAY_DAY_LAYOUT: DayLayout = Object.freeze({
	continuation: continuationOnly(
		STANDARD_DAY_HEADING,
		STANDARD_CONTINUATION_BODY,
	),
	first: Object.freeze({
		body: rect(10, 146, 128, 48),
		extra: null,
		heading: STANDARD_DAY_HEADING,
		hero: null,
		image: rect(10, 40, 128, 100),
	}),
});

/** photo-essay's image + hero composition; the body does not move. */
export const PHOTO_ESSAY_SPLIT_FIRST: DayGeometry = Object.freeze({
	body: rect(10, 146, 128, 48),
	extra: null,
	heading: STANDARD_DAY_HEADING,
	hero: rect(96, 40, 42, 100),
	image: rect(10, 40, 80, 100),
});

export const QUEST_BOARD_DAY_LAYOUT: DayLayout = Object.freeze({
	continuation: continuationOnly(
		STANDARD_DAY_HEADING,
		STANDARD_CONTINUATION_BODY,
	),
	first: Object.freeze({
		body: rect(10, 86, 128, 108),
		extra: null,
		heading: STANDARD_DAY_HEADING,
		hero: rect(96, 40, 42, 40),
		image: rect(10, 40, 80, 40),
	}),
});
export const QUEST_PANEL_PADDING_MM = 4;
export const QUEST_UNIT_GAP_MM = 4;
/** Lane widths are subtracted from the panel text width before measuring. */
export const QUEST_STAMP_LANE_MM = 24;
export const QUEST_CHECKLIST_LANE_MM = 6;

export const SCHEMATIC_DAY_LAYOUT: DayLayout = Object.freeze({
	continuation: continuationOnly(
		STANDARD_DAY_HEADING,
		rect(10, 76, 128, 118),
		rect(10, 40, 128, 30),
	),
	first: Object.freeze({
		body: rect(10, 100, 128, 94),
		extra: rect(10, 40, 128, 54),
		heading: STANDARD_DAY_HEADING,
		hero: null,
		image: null,
	}),
});
/** The concept route draws at most eight nodes; names stay in the numbered body. */
export const SCHEMATIC_MAX_NODES = 8;

export const LEDGER_DAY_LAYOUT: DayLayout = Object.freeze({
	continuation: Object.freeze({
		body: rect(10, 52, 128, 142),
		extra: rect(10, 40, 128, 10),
		heading: STANDARD_DAY_HEADING,
		hero: null,
		image: null,
	}),
	first: Object.freeze({
		body: rect(10, 52, 128, 142),
		extra: rect(10, 40, 128, 10),
		heading: STANDARD_DAY_HEADING,
		hero: null,
		image: null,
	}),
});
/** Ledger row gap; the 18/18/64/28mm columns and 2mm cell padding live in CSS. */
export const LEDGER_ROW_GAP_MM = 2;

/**
 * Divider and endcap reuse the standard cover composition (title, image,
 * period). A memo has a day heading above its body region.
 */
export const EXTRA_COVER_GEOMETRY = STANDARD_COVER_GEOMETRY;
export const MEMO_HEADING = STANDARD_DAY_HEADING;
export const EXTRA_PAGE_BODY_RECT = rect(10, 40, 128, 154);
export const MEMORY_ALBUM_PHOTO = rect(10, 40, 128, 76);
export const MEMORY_ALBUM_NOTE = rect(10, 124, 128, 60);
export const MEMO_ENTRY_GAP_MM = 3;

/** Image treatments reserve their frame inside the image rect (25.4). */
export type TreatmentInset = {
	readonly bottomMm: number;
	readonly leftMm: number;
	readonly rightMm: number;
	readonly topMm: number;
};

export const IMAGE_TREATMENT_INSETS: Readonly<Record<string, TreatmentInset>> =
	Object.freeze({
		"caption-margin": { bottomMm: 12, leftMm: 0, rightMm: 0, topMm: 0 },
		collage: { bottomMm: 3, leftMm: 3, rightMm: 3, topMm: 3 },
		film: { bottomMm: 3, leftMm: 1, rightMm: 1, topMm: 3 },
		"gallery-margin": { bottomMm: 6, leftMm: 6, rightMm: 6, topMm: 6 },
		polaroid: { bottomMm: 10, leftMm: 3, rightMm: 3, topMm: 3 },
		post: { bottomMm: 12, leftMm: 0, rightMm: 0, topMm: 0 },
		"sketch-note": { bottomMm: 8, leftMm: 2, rightMm: 2, topMm: 2 },
	});

export function insetRect(
	outer: ModuleRect,
	inset: TreatmentInset,
): ModuleRect {
	return rect(
		outer.xMm + inset.leftMm,
		outer.yMm + inset.topMm,
		outer.widthMm - inset.leftMm - inset.rightMm,
		outer.heightMm - inset.topMm - inset.bottomMm,
	);
}
