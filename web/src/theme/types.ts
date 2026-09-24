import type { CoverVisualStyle as CatalogCoverVisualStyle } from "./coverVisualStyles";

export type ThemeCatalogVersion = "v2";

export type CoverVisualStyle = CatalogCoverVisualStyle;

export type ThemeSeed = {
	readonly value: number;
	readonly version: ThemeCatalogVersion;
};

/** Which palette colour a motif is painted with. `own` keeps the asset's colours. */
export type MotifColor = "accent" | "border" | "muted" | "own";
