import type { PaginationFailureCode } from "../../booklet/paginationError";

type LayoutFailureCode =
	| PaginationFailureCode
	| "cover-bounds-invalid"
	| "cover-safe-area-overflow"
	| "dom-not-ready"
	| "hidden-text";

/** A drawn or measured page that breaks the layout contract. */
export class BookletLayoutError extends Error {
	readonly code: LayoutFailureCode;

	constructor(code: LayoutFailureCode, message: string) {
		super(message);
		this.code = code;
		this.name = "BookletLayoutError";
	}
}
