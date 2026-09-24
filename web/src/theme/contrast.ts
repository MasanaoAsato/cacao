function parseHexColor(
	color: string,
): readonly [number, number, number] | null {
	const match = /^#([0-9a-f]{6})$/i.exec(color.trim());
	if (!match) {
		return null;
	}

	const hex = match[1];
	return [
		Number.parseInt(hex.slice(0, 2), 16),
		Number.parseInt(hex.slice(2, 4), 16),
		Number.parseInt(hex.slice(4, 6), 16),
	];
}

function linearize(value: number): number {
	const normalized = value / 255;
	return normalized <= 0.03928
		? normalized / 12.92
		: ((normalized + 0.055) / 1.055) ** 2.4;
}

function luminance(color: readonly [number, number, number]): number {
	return (
		0.2126 * linearize(color[0]) +
		0.7152 * linearize(color[1]) +
		0.0722 * linearize(color[2])
	);
}

/** WCAG contrast ratio of two `#rrggbb` colours; `null` when either is unparsable. */
export function contrastRatio(
	foreground: string,
	background: string,
): number | null {
	const foregroundRgb = parseHexColor(foreground);
	const backgroundRgb = parseHexColor(background);
	if (!foregroundRgb || !backgroundRgb) {
		return null;
	}

	const foregroundLuminance = luminance(foregroundRgb);
	const backgroundLuminance = luminance(backgroundRgb);
	return (
		(Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
		(Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
	);
}
