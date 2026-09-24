import { validateFamilyTextSafety } from "../families/decorPlacement";
import type {
	BasicWorkStyleId,
	DirectionStyleBundleId,
	StyleBundleId,
} from "./types";

export type FontWeight = 400 | 700;

export type StyleBundle = {
	readonly accentColor: string;
	readonly bodyColor: string;
	readonly bodyFontFamily: string;
	readonly bodyFontSizePt: number;
	readonly bodyFontWeight: FontWeight;
	readonly bodyLineHeight: number;
	readonly displayFontFamily: string;
	readonly displayFontSizePt: number;
	readonly displayFontWeight: FontWeight;
	readonly paperColor: string;
	readonly utilityFontFamily: string;
	readonly utilityFontSizePt: number;
	readonly utilityFontWeight: FontWeight;
	readonly utilityLineHeight: number;
};

/** The six 25.1 bundles that direction baselines choose from. */
export const DIRECTION_STYLE_BUNDLES: Readonly<
	Record<DirectionStyleBundleId, StyleBundle>
> = {
	ink: {
		accentColor: "#36566A",
		bodyColor: "#242424",
		bodyFontFamily: "Noto Serif JP",
		bodyFontSizePt: 10,
		bodyFontWeight: 400,
		bodyLineHeight: 1.6,
		displayFontFamily: "Noto Serif JP",
		displayFontSizePt: 24,
		displayFontWeight: 700,
		paperColor: "#F6F2E8",
		utilityFontFamily: "Noto Sans JP",
		utilityFontSizePt: 8.5,
		utilityFontWeight: 400,
		utilityLineHeight: 1.4,
	},
	bright: {
		accentColor: "#B84930",
		bodyColor: "#203247",
		bodyFontFamily: "Noto Sans JP",
		bodyFontSizePt: 10,
		bodyFontWeight: 400,
		bodyLineHeight: 1.6,
		displayFontFamily: "Zen Kaku Gothic New",
		displayFontSizePt: 24,
		displayFontWeight: 700,
		paperColor: "#FFFFFF",
		utilityFontFamily: "Noto Sans JP",
		utilityFontSizePt: 8.5,
		utilityFontWeight: 400,
		utilityLineHeight: 1.4,
	},
	warm: {
		accentColor: "#89552E",
		bodyColor: "#4B3426",
		bodyFontFamily: "Noto Sans JP",
		bodyFontSizePt: 10,
		bodyFontWeight: 400,
		bodyLineHeight: 1.6,
		displayFontFamily: "Zen Kurenaido",
		displayFontSizePt: 22,
		displayFontWeight: 400,
		paperColor: "#F4ECDD",
		utilityFontFamily: "Noto Sans JP",
		utilityFontSizePt: 8.5,
		utilityFontWeight: 400,
		utilityLineHeight: 1.4,
	},
	quiet: {
		accentColor: "#496459",
		bodyColor: "#33453D",
		bodyFontFamily: "Noto Serif JP",
		bodyFontSizePt: 10,
		bodyFontWeight: 400,
		bodyLineHeight: 1.6,
		displayFontFamily: "Shippori Mincho",
		displayFontSizePt: 24,
		displayFontWeight: 700,
		paperColor: "#F8F5ED",
		utilityFontFamily: "Noto Sans JP",
		utilityFontSizePt: 8.5,
		utilityFontWeight: 400,
		utilityLineHeight: 1.4,
	},
	play: {
		accentColor: "#A43252",
		bodyColor: "#223047",
		bodyFontFamily: "Noto Sans JP",
		bodyFontSizePt: 10,
		bodyFontWeight: 400,
		bodyLineHeight: 1.6,
		displayFontFamily: "M PLUS Rounded 1c",
		displayFontSizePt: 24,
		displayFontWeight: 700,
		paperColor: "#F7F6E9",
		utilityFontFamily: "Noto Sans JP",
		utilityFontSizePt: 8.5,
		utilityFontWeight: 400,
		utilityLineHeight: 1.4,
	},
	night: {
		accentColor: "#E2BF70",
		bodyColor: "#FFFFFF",
		bodyFontFamily: "Noto Sans JP",
		bodyFontSizePt: 10,
		bodyFontWeight: 400,
		bodyLineHeight: 1.6,
		displayFontFamily: "Noto Sans JP",
		displayFontSizePt: 24,
		displayFontWeight: 700,
		paperColor: "#182331",
		utilityFontFamily: "Noto Sans JP",
		utilityFontSizePt: 8.5,
		utilityFontWeight: 400,
		utilityLineHeight: 1.4,
	},
};

/**
 * The styles of the basic verification works (25.4). They are never added to
 * the family profile arrays and no direction selects them.
 */
export const BASIC_WORK_STYLES: Readonly<
	Record<BasicWorkStyleId, StyleBundle>
> = {
	"woodcut-journey": {
		accentColor: "#D7C6A0",
		bodyColor: "#19352C",
		bodyFontFamily: "Noto Serif JP",
		bodyFontSizePt: 10,
		bodyFontWeight: 400,
		bodyLineHeight: 1.6,
		displayFontFamily: "Shippori Mincho",
		displayFontSizePt: 24,
		displayFontWeight: 700,
		paperColor: "#F7F1DD",
		utilityFontFamily: "Noto Sans JP",
		utilityFontSizePt: 8.5,
		utilityFontWeight: 400,
		utilityLineHeight: 1.4,
	},
	"rail-sketchbook": {
		accentColor: "#D8E5E8",
		bodyColor: "#263A46",
		bodyFontFamily: "Zen Kaku Gothic New",
		bodyFontSizePt: 10,
		bodyFontWeight: 400,
		bodyLineHeight: 1.6,
		displayFontFamily: "Zen Kurenaido",
		displayFontSizePt: 26,
		displayFontWeight: 400,
		paperColor: "#F4F5EF",
		utilityFontFamily: "Noto Sans JP",
		utilityFontSizePt: 8.5,
		utilityFontWeight: 700,
		utilityLineHeight: 1.4,
	},
	"specimen-scrapbook": {
		accentColor: "#DCE5CD",
		bodyColor: "#302B28",
		bodyFontFamily: "Noto Serif JP",
		bodyFontSizePt: 10,
		bodyFontWeight: 400,
		bodyLineHeight: 1.6,
		displayFontFamily: "Kaisei Decol",
		displayFontSizePt: 26,
		displayFontWeight: 700,
		paperColor: "#F6F3E9",
		utilityFontFamily: "Noto Sans JP",
		utilityFontSizePt: 8.5,
		utilityFontWeight: 400,
		utilityLineHeight: 1.4,
	},
};

export const STYLE_BUNDLES: Readonly<Record<StyleBundleId, StyleBundle>> = {
	...DIRECTION_STYLE_BUNDLES,
	...BASIC_WORK_STYLES,
};

export function styleBundleById(id: StyleBundleId): StyleBundle {
	return STYLE_BUNDLES[id];
}

export function validateStyleBundle(bundle: StyleBundle): void {
	if (
		bundle.bodyFontSizePt < 10 ||
		bundle.utilityFontSizePt < 8.5 ||
		bundle.displayFontSizePt < 18
	)
		throw new Error("文字サイズが25.1の下限を満たしていません。");
	if (bundle.bodyLineHeight < 1.6 || bundle.utilityLineHeight < 1.4)
		throw new Error("行間が25.1の下限を満たしていません。");
	if (
		bundle.bodyColor.toUpperCase() === bundle.accentColor.toUpperCase() ||
		bundle.bodyColor.toUpperCase() === bundle.paperColor.toUpperCase()
	)
		throw new Error("本文色を装飾色または紙色にできません。");
}

function validateStyleBundleTextSafety(bundle: StyleBundle): void {
	validateFamilyTextSafety("direction-catalog", bundle.paperColor, [
		{
			colorHex: bundle.bodyColor,
			fontSizePt: bundle.bodyFontSizePt,
			role: "body",
		},
		{
			colorHex: bundle.bodyColor,
			fontSizePt: bundle.displayFontSizePt,
			role: "display",
		},
		{
			colorHex: bundle.bodyColor,
			fontSizePt: bundle.utilityFontSizePt,
			role: "utility",
		},
	]);
}

for (const bundle of Object.values(STYLE_BUNDLES)) {
	validateStyleBundle(bundle);
	validateStyleBundleTextSafety(bundle);
}
