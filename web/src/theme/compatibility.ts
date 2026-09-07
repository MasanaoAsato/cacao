import type { CompatibilityRule, MoodDefinition, ThemeContext } from "./types";

export const COMPATIBILITY_RULES: readonly CompatibilityRule[] = [
	{
		exclude: {
			decors: ["stripe-band", "dashed-ticket"],
		},
		when: {
			coverVisualStyle: ["oil-painting", "gouache"],
		},
	},
	{
		exclude: {
			decors: ["stripe-band", "dashed-ticket"],
			palettes: ["night-window"],
		},
		when: {
			coverVisualStyle: ["watercolor", "pastel"],
		},
	},
];

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
	const matchingRules = rules.filter(
		(rule) =>
			context.coverVisualStyle !== null &&
			rule.when.coverVisualStyle.includes(context.coverVisualStyle),
	);
	const excludedCoverLayouts = matchingRules.flatMap(
		(rule) => rule.exclude.coverLayouts ?? [],
	);
	const excludedDecors = matchingRules.flatMap(
		(rule) => rule.exclude.decors ?? [],
	);
	const excludedPalettes = matchingRules.flatMap(
		(rule) => rule.exclude.palettes ?? [],
	);
	const excludedCompositions = matchingRules.flatMap(
		(rule) => rule.exclude.compositions ?? [],
	);
	const excludedInkStyles = matchingRules.flatMap(
		(rule) => rule.exclude.inkStyles ?? [],
	);
	return {
		...mood,
		compositions: withoutExcluded(mood.compositions, excludedCompositions),
		coverLayouts: withoutExcluded(mood.coverLayouts, excludedCoverLayouts),
		decors: withoutExcluded(mood.decors, excludedDecors),
		inkStyles: withoutExcluded(mood.inkStyles, excludedInkStyles),
		palettes: withoutExcluded(mood.palettes, excludedPalettes),
	};
}
