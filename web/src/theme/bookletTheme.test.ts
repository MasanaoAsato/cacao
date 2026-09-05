import { describe, expect, it } from "vitest";
import {
	COVER_LAYOUTS,
	createBookletTheme,
	getBookletThemeCssVariables,
	getCoverLayoutDefinition,
	getFontPairFamilies,
	getThemeCandidates,
} from "./bookletTheme";

function selectedTheme(seed = 7) {
	const requested = createBookletTheme({ value: seed, version: "v2" });
	const candidate = getThemeCandidates(requested)[0];
	if (!candidate) {
		throw new Error("選択テーマ候補がありません。");
	}
	return { candidate, requested };
}

describe("V2テーマ定義", () => {
	it("正常系: 12構図の定義からテーマCSS変数を作る", () => {
		expect(COVER_LAYOUTS).toHaveLength(12);
		const { candidate } = selectedTheme();
		expect(getBookletThemeCssVariables(candidate)).toMatchObject({
			"--booklet-cover-ink": expect.any(String),
			"--booklet-cover-text-align": expect.any(String),
			"--booklet-cover-text-width": expect.stringMatching(/mm$/),
			"--booklet-cover-veil": expect.any(String),
		});
	});

	it("正常系: 17.3の単色パネル構図を定義値どおりに変換する", () => {
		expect(getCoverLayoutDefinition("panel-bottom")).toMatchObject({
			imageFrame: {
				heightMm: 128,
				shape: "rect",
				widthMm: 148,
				xMm: 0,
				yMm: 0,
			},
			textBox: {
				align: "left",
				anchorX: "left",
				anchorY: "top",
				offsetXMm: 12,
				offsetYMm: 138,
				paddingMm: 0,
				widthMm: 124,
			},
			safeArea: { heightMm: 66, widthMm: 124, xMm: 12, yMm: 136 },
			titleSizePt: null,
			veil: "none",
		});
		expect(getCoverLayoutDefinition("panel-top")).toMatchObject({
			imageFrame: { heightMm: 128, widthMm: 148, xMm: 0, yMm: 82 },
			safeArea: { heightMm: 66, widthMm: 124, xMm: 12, yMm: 10 },
			veil: "none",
		});
		expect(getCoverLayoutDefinition("window-arch")).toMatchObject({
			imageFrame: {
				heightMm: 112,
				shape: "arch",
				widthMm: 104,
				xMm: 22,
				yMm: 14,
			},
			safeArea: { heightMm: 70, widthMm: 124, xMm: 12, yMm: 132 },
			veil: "none",
		});
		expect(getCoverLayoutDefinition("poster")).toMatchObject({
			imageFrame: {
				heightMm: 60,
				shape: "rect",
				widthMm: 148,
				xMm: 0,
				yMm: 150,
			},
			safeArea: { heightMm: 132, widthMm: 124, xMm: 12, yMm: 12 },
			titleSizePt: 44,
			veil: "none",
		});
	});

	it("正常系: 表示書体ごとの題名ファミリーとウェイトをCSS変数へ反映する", () => {
		const { candidate } = selectedTheme();
		for (const [displayFontId, family, weight] of [
			["inherit", '"Zen Kaku Gothic New", sans-serif', "700"],
			["dela-gothic-one", '"Dela Gothic One", sans-serif', "400"],
			["zen-kurenaido", '"Zen Kurenaido", sans-serif', "400"],
			["kaisei-decol", '"Kaisei Decol", serif', "700"],
			["rocknroll-one", '"RocknRoll One", sans-serif', "400"],
		] as const) {
			const variables = getBookletThemeCssVariables({
				...candidate,
				displayFontId,
			});
			expect(variables["--booklet-cover-title-family"]).toBe(family);
			expect(variables["--booklet-cover-title-weight"]).toBe(weight);
		}
	});

	it("正常系: 全書体対のファミリー一覧を単一定義から返す", () => {
		expect([
			["classic", getFontPairFamilies("classic")],
			["literary", getFontPairFamilies("literary")],
			["wayfinding", getFontPairFamilies("wayfinding")],
			["modern", getFontPairFamilies("modern")],
			["round-trip", getFontPairFamilies("round-trip")],
		]).toEqual([
			["classic", ["Noto Serif JP"]],
			["literary", ["Shippori Mincho", "Noto Sans JP"]],
			["wayfinding", ["Zen Kaku Gothic New", "Noto Sans JP"]],
			["modern", ["Noto Sans JP"]],
			["round-trip", ["M PLUS Rounded 1c", "Noto Sans JP"]],
		]);
	});

	it("境界値系: north-east構図を右上のCSS変数へ変換する", () => {
		const { candidate } = selectedTheme();
		const variables = getBookletThemeCssVariables({
			...candidate,
			coverLayoutId: "north-east",
		});

		expect(getCoverLayoutDefinition("north-east").safeArea).toEqual({
			heightMm: 70,
			widthMm: 80,
			xMm: 56,
			yMm: 12,
		});
		expect(variables).toMatchObject({
			"--booklet-cover-text-bottom": "auto",
			"--booklet-cover-text-left": "auto",
			"--booklet-cover-text-right": "12mm",
			"--booklet-cover-text-top": "12mm",
			"--booklet-cover-text-width": "80mm",
		});
	});
});
