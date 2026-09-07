import { getBodyContentInset, getDecorDefinition } from "./bookletTheme";
import {
	type PanelRect,
	panelRect,
	type ResolvedMotif,
	resolveMotifPlacements,
} from "./decorGeometry";
import { MOTIFS } from "./motifs";
import type {
	BookletThemeCandidate,
	ContentInsetMm,
	DecorDefinition,
	MotifDefinition,
} from "./types";

export type DecorLayerMotif = ResolvedMotif & {
	readonly definition: MotifDefinition;
};

export type DecorLayer = {
	readonly contentInset: ContentInsetMm;
	readonly decor: DecorDefinition;
	readonly motifs: readonly DecorLayerMotif[];
	readonly pageMarginMm: number;
	readonly panel: PanelRect | null;
};

/** The seed token is the first segment of the resolved theme key (`seed:step`). */
export function seedTokenOf(resolvedThemeKey: string): string {
	return resolvedThemeKey.split(":")[0] ?? resolvedThemeKey;
}

/**
 * Everything the page decor SVG needs for one theme: the decor set, the body
 * inset it produces together with the composition, and the motifs placed for
 * this seed. Pure, so the same theme always yields the same layer.
 */
export function getDecorLayer(
	theme: Pick<
		BookletThemeCandidate,
		"compositionId" | "decorId" | "resolvedThemeKey" | "typography"
	>,
): DecorLayer {
	const decor = getDecorDefinition(theme.decorId);
	const contentInset = getBodyContentInset(theme);
	const pageMarginMm = theme.typography.pageMarginMm;
	const motifs = resolveMotifPlacements(
		decor,
		MOTIFS,
		{ contentInset, pageMarginMm },
		seedTokenOf(theme.resolvedThemeKey),
	).map((motif) => {
		const definition = MOTIFS.get(motif.motif);
		if (!definition) {
			throw new Error(`未登録の図形「${motif.motif}」です。`);
		}
		return { ...motif, definition };
	});
	return {
		contentInset,
		decor,
		motifs,
		pageMarginMm,
		panel: panelRect(decor),
	};
}
