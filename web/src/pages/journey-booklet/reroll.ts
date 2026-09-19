import type { BookletFamilyId } from "../../booklet/family";
import { createBookletTheme } from "../../theme/bookletTheme";
import { ACTIVE_BOOKLET_FAMILY_IDS } from "../../theme/families/registry";
import { resolveBookletDesign } from "../../theme/families/resolveBookletDesign";
import { createRerollSeed as defaultCreateRerollSeed } from "../../theme/seed";
import type { CoverVisualStyle, ThemeSeed } from "../../theme/types";

export type RerollSeedOptions = {
	readonly familyIds?: readonly BookletFamilyId[];
	readonly createRerollSeed?: typeof defaultCreateRerollSeed;
	readonly resolveFamilyId?: (candidate: ThemeSeed) => BookletFamilyId;
};

export class RerollUnavailableError extends Error {
	readonly reason: "no-family" | "single-family";

	constructor(reason: "no-family" | "single-family") {
		super(
			reason === "no-family"
				? "しおりのデザイン候補が登録されていません。"
				: "別のデザイン候補がないため、再抽選できません。",
		);
		this.name = "RerollUnavailableError";
		this.reason = reason;
	}
}

/**
 * Select a seed whose resolved family differs from the current family.
 *
 * Family availability is checked before consuming random candidates so the
 * caller can distinguish a catalog configuration error from an exhausted
 * finite search.  Resolution failures are treated as rejected candidates.
 */
export function selectRerollSeed(
	currentSeed: ThemeSeed,
	currentFamilyId: BookletFamilyId,
	coverVisualStyle: CoverVisualStyle | null,
	options: RerollSeedOptions = {},
): ThemeSeed {
	const familyIds = options.familyIds ?? ACTIVE_BOOKLET_FAMILY_IDS;
	if (familyIds.length === 0) {
		throw new RerollUnavailableError("no-family");
	}
	if (familyIds.length === 1) {
		throw new RerollUnavailableError("single-family");
	}

	const resolveFamilyId =
		options.resolveFamilyId ??
		((candidate: ThemeSeed): BookletFamilyId =>
			resolveBookletDesign(createBookletTheme(candidate, { coverVisualStyle }))
				.familyId);
	const createSeed = options.createRerollSeed ?? defaultCreateRerollSeed;

	return createSeed(currentSeed, (candidate) => {
		try {
			return resolveFamilyId(candidate) !== currentFamilyId;
		} catch {
			return false;
		}
	});
}
