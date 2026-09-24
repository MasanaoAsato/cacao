import { parseDirectionLimit } from "./directionLimit";

export const MAX_BOOKLET_DIRECTIONS = parseDirectionLimit(
	import.meta.env.VITE_BOOKLET_MAX_DIRECTIONS,
);

/** Identifies the delivered catalog, including its deployment direction limit. */
export const CATALOG_REVISION = `2026-09-24.3-max${MAX_BOOKLET_DIRECTIONS}`;
