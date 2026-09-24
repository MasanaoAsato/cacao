/** Why a measured scene cannot be split into A5 pages. */
export type PaginationFailureCode =
	| "cover-inline-overflow"
	| "cover-block-overflow"
	| "day-header-overflow"
	| "unit-overflow"
	| "text-inline-overflow"
	| "text-block-overflow"
	| "page-inline-overflow"
	| "page-block-overflow";

export class PaginationError extends Error {
	readonly code: PaginationFailureCode | "invalid-measurement";

	constructor(
		code: PaginationFailureCode | "invalid-measurement",
		message: string,
	) {
		super(message);
		this.code = code;
		this.name = "PaginationError";
	}
}
