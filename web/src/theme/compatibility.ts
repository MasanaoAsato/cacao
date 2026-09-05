import type { CompatibilityRule, MoodDefinition, ThemeContext } from "./types";

export const COMPATIBILITY_RULES: readonly CompatibilityRule[] = [];

function withoutExcluded<T>(
	values: readonly T[],
	excluded: readonly T[],
): readonly T[] {
	const filtered = values.filter((value) => !excluded.includes(value));
	return filtered.length > 0 ? filtered : values;
}

export function applyCompatibility(
	mood: MoodDefinition,
	context: ThemeContext,
	rules: readonly CompatibilityRule[] = COMPATIBILITY_RULES,
): MoodDefinition {
	const matchingRules = rules.filter((rule) => rule.matches(context));
	const excludedCoverLayouts = matchingRules.flatMap(
		(rule) => rule.exclude.coverLayouts ?? [],
	);
	const excludedDecors = matchingRules.flatMap(
		(rule) => rule.exclude.decors ?? [],
	);
	const excludedPalettes = matchingRules.flatMap(
		(rule) => rule.exclude.palettes ?? [],
	);
	return {
		...mood,
		coverLayouts: withoutExcluded(mood.coverLayouts, excludedCoverLayouts),
		decors: withoutExcluded(mood.decors, excludedDecors),
		palettes: withoutExcluded(mood.palettes, excludedPalettes),
	};
}
