import { validateFamilyTextSafety } from "../families/decorPlacement";
import type { StyleBundleId } from "./types";

export type StyleBundle = {
	readonly accentColor: string;
	readonly bodyColor: string;
	readonly bodyFontFamily: string;
	readonly bodyFontSizePt: number;
	readonly bodyLineHeight: number;
	readonly displayFontFamily: string;
	readonly displayFontSizePt: number;
	readonly paperColor: string;
	readonly utilityFontFamily: string;
	readonly utilityFontSizePt: number;
	readonly utilityLineHeight: number;
};

export const STYLE_BUNDLES: Readonly<Record<StyleBundleId, StyleBundle>> = {
	ink: {
		accentColor: "#36566A",
		bodyColor: "#242424",
		bodyFontFamily: "Noto Serif JP",
		bodyFontSizePt: 10,
		bodyLineHeight: 1.6,
		displayFontFamily: "Noto Serif JP",
		displayFontSizePt: 24,
		paperColor: "#F6F2E8",
		utilityFontFamily: "Noto Sans JP",
		utilityFontSizePt: 8.5,
		utilityLineHeight: 1.4,
	},
	bright: {
		accentColor: "#B84930",
		bodyColor: "#203247",
		bodyFontFamily: "Noto Sans JP",
		bodyFontSizePt: 10,
		bodyLineHeight: 1.6,
		displayFontFamily: "Zen Kaku Gothic New",
		displayFontSizePt: 24,
		paperColor: "#FFFFFF",
		utilityFontFamily: "Noto Sans JP",
		utilityFontSizePt: 8.5,
		utilityLineHeight: 1.4,
	},
	warm: {
		accentColor: "#89552E",
		bodyColor: "#4B3426",
		bodyFontFamily: "Noto Sans JP",
		bodyFontSizePt: 10,
		bodyLineHeight: 1.6,
		displayFontFamily: "Zen Kurenaido",
		displayFontSizePt: 22,
		paperColor: "#F4ECDD",
		utilityFontFamily: "Noto Sans JP",
		utilityFontSizePt: 8.5,
		utilityLineHeight: 1.4,
	},
	quiet: {
		accentColor: "#496459",
		bodyColor: "#33453D",
		bodyFontFamily: "Noto Serif JP",
		bodyFontSizePt: 10,
		bodyLineHeight: 1.6,
		displayFontFamily: "Shippori Mincho",
		displayFontSizePt: 24,
		paperColor: "#F8F5ED",
		utilityFontFamily: "Noto Sans JP",
		utilityFontSizePt: 8.5,
		utilityLineHeight: 1.4,
	},
	play: {
		accentColor: "#A43252",
		bodyColor: "#223047",
		bodyFontFamily: "Noto Sans JP",
		bodyFontSizePt: 10,
		bodyLineHeight: 1.6,
		displayFontFamily: "M PLUS Rounded 1c",
		displayFontSizePt: 24,
		paperColor: "#F7F6E9",
		utilityFontFamily: "Noto Sans JP",
		utilityFontSizePt: 8.5,
		utilityLineHeight: 1.4,
	},
	night: {
		accentColor: "#E2BF70",
		bodyColor: "#FFFFFF",
		bodyFontFamily: "Noto Sans JP",
		bodyFontSizePt: 10,
		bodyLineHeight: 1.6,
		displayFontFamily: "Noto Sans JP",
		displayFontSizePt: 24,
		paperColor: "#182331",
		utilityFontFamily: "Noto Sans JP",
		utilityFontSizePt: 8.5,
		utilityLineHeight: 1.4,
	},
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
