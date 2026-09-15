import { describe, expect, it } from "vitest";
import { type MotifAssetId, motifAssetsFor } from "../motifAssets";
import {
	type DecorAnchor,
	DecorPlacementError,
	type FamilyDecoration,
	type FamilyDecorInput,
	type ProtectedTextRect,
	type RectMm,
	resolveFamilyDecor,
	validateFamilyTextSafety,
} from "./decorPlacement";

const SEED_TOKEN = "v2-0000002a";

const ASSET_IDS: readonly MotifAssetId[] = [
	"atlas-compass",
	"atlas-route-mark",
	"paper-tape",
	"paper-torn-sheet",
];

function rect(
	xMm: number,
	yMm: number,
	widthMm: number,
	heightMm: number,
): RectMm {
	return { heightMm, widthMm, xMm, yMm };
}

function anchor(
	id: string,
	kind: DecorAnchor["kind"],
	value: RectMm,
	reserveMm = 0,
): DecorAnchor {
	return { id, kind, rect: value, reserveMm };
}

function text(role: string, value: RectMm): ProtectedTextRect {
	return { rect: value, role };
}

function input(
	decorations: readonly FamilyDecoration[],
	anchors: readonly DecorAnchor[],
	protectedTexts: readonly ProtectedTextRect[] = [],
): FamilyDecorInput {
	return {
		anchors,
		assets: motifAssetsFor(ASSET_IDS),
		decorations,
		familyId: "atlas-grid",
		pageId: "page-1",
		protectedTexts,
		seedToken: SEED_TOKEN,
	};
}

/** 10×10mm compass at the anchor's top-left, with no rotation by default. */
function compass(
	anchorId: string,
	offsetMm: readonly [number, number],
	rotateDeg: readonly [number, number] = [0, 0],
): FamilyDecoration {
	return {
		anchorId,
		assetId: "atlas-compass",
		color: "accent",
		kind: "asset",
		layer: "under-content",
		offsetMm,
		rotateDeg,
		sizeMm: 10,
	};
}

function codeOf(run: () => unknown): string {
	try {
		run();
	} catch (error) {
		if (error instanceof DecorPlacementError) {
			return error.code;
		}
		throw error;
	}
	throw new Error("失敗しませんでした。");
}

describe("系統装飾の配置", () => {
	it("正常系: anchorの左上からのoffsetと実寸でmm座標を決める", () => {
		const resolved = resolveFamilyDecor(
			input(
				[compass("title-1", [4, 3])],
				[anchor("title-1", "title", rect(20, 30, 80, 20))],
			),
		);
		const [item] = resolved.items;
		expect(item?.kind).toBe("asset");
		if (item?.kind !== "asset") {
			throw new Error("素材の配置がありません。");
		}
		expect(item.xMm).toBeCloseTo(24, 6);
		expect(item.yMm).toBeCloseTo(33, 6);
		expect(item.widthMm).toBeCloseTo(10, 6);
		expect(item.heightMm).toBeCloseTo(10, 6);
		expect(item.boundsMm).toEqual(rect(24, 33, 10, 10));
		expect(item.rotationFallback).toBe(false);
		expect(resolved.rotationFallbacks).toEqual([]);
	});

	it("正常系: 同じ入力なら回転も配置も変わらない", () => {
		const anchors = [anchor("unit-1", "unit", rect(20, 60, 100, 40))];
		const decorations = [
			compass("unit-1", [10, 10], [-12, 12]),
			compass("unit-1", [40, 10], [-12, 12]),
		];
		const first = resolveFamilyDecor(input(decorations, anchors));
		const second = resolveFamilyDecor(input(decorations, anchors));
		expect(first).toEqual(second);

		const angles = first.items.map((item) =>
			item.kind === "asset" ? item.rotateDeg : Number.NaN,
		);
		// The axis includes the instance index, so repeats differ from each other.
		expect(angles[0]).not.toBeCloseTo(angles[1] ?? Number.NaN, 6);
		for (const angle of angles) {
			expect(angle).toBeGreaterThanOrEqual(-12);
			expect(angle).toBeLessThanOrEqual(12);
		}
	});

	it("正常系: 紙片の下地はunder-contentで文字の下に置ける", () => {
		const resolved = resolveFamilyDecor(
			input(
				[
					{
						anchorId: "section-1",
						assetId: "paper-torn-sheet",
						color: "own",
						kind: "asset",
						layer: "under-content",
						offsetMm: [0, 0],
						rotateDeg: [0, 0],
						sizeMm: 30,
					},
				],
				[anchor("section-1", "section", rect(20, 40, 100, 60))],
				[text("spot-name", rect(24, 44, 40, 8))],
			),
		);
		expect(resolved.items).toHaveLength(1);
	});

	it("異常系: 下地以外の素材は文字の下に置けない", () => {
		expect(
			codeOf(() =>
				resolveFamilyDecor(
					input(
						[compass("section-1", [2, 2])],
						[anchor("section-1", "section", rect(20, 40, 100, 60))],
						[text("spot-name", rect(24, 44, 40, 8))],
					),
				),
			),
		).toBe("decor-collision");
	});

	it("境界値系: 面積のない文字矩形は装飾の禁止領域にしない", () => {
		// A display:none text role measures 0×0 and holds no ink, so treating it as
		// a 1mm exclusion zone would reject a placement that is actually clear.
		expect(
			resolveFamilyDecor(
				input(
					[compass("title-1", [0, 0])],
					[anchor("title-1", "title", rect(10, 10, 60, 40))],
					[
						text("day-title", rect(10.5, 10.5, 0, 5)),
						text("utility-label", rect(12, 12, 4, 0)),
					],
				),
			).items,
		).toHaveLength(1);
	});

	it("境界値系: 文字からちょうど1mmは通り、0.9mmは衝突する", () => {
		const anchors = [anchor("title-1", "title", rect(10, 10, 60, 40))];
		const decorations = [compass("title-1", [0, 0])];
		expect(
			resolveFamilyDecor(
				input(decorations, anchors, [text("day-title", rect(21, 10, 20, 10))]),
			).items,
		).toHaveLength(1);
		expect(
			codeOf(() =>
				resolveFamilyDecor(
					input(decorations, anchors, [
						text("day-title", rect(20.9, 10, 20, 10)),
					]),
				),
			),
		).toBe("decor-collision");
	});

	it("境界値系: 回転で紙面外になるときだけ0度へ退避し、記録に残す", () => {
		const resolved = resolveFamilyDecor(
			input(
				[
					{
						anchorId: "title-1",
						assetId: "atlas-route-mark",
						color: "accent",
						kind: "asset",
						layer: "under-content",
						offsetMm: [0, 0],
						rotateDeg: [45, 45],
						sizeMm: 20,
					},
				],
				[anchor("title-1", "title", rect(0, 0, 148, 30))],
			),
		);
		const [item] = resolved.items;
		if (item?.kind !== "asset") {
			throw new Error("素材の配置がありません。");
		}
		expect(item.rotateDeg).toBe(0);
		expect(item.rotationFallback).toBe(true);
		expect(item.boundsMm).toEqual(rect(0, 0, 40, 20));
		expect(resolved.rotationFallbacks).toEqual(["title-1:0"]);
	});

	it("異常系: 0度でも紙面に収まらない配置は装飾計測エラーになる", () => {
		expect(
			codeOf(() =>
				resolveFamilyDecor(
					input(
						[
							{
								anchorId: "title-1",
								assetId: "atlas-route-mark",
								color: "accent",
								kind: "asset",
								layer: "under-content",
								offsetMm: [120, 0],
								rotateDeg: [45, 45],
								sizeMm: 20,
							},
						],
						[anchor("title-1", "title", rect(0, 0, 148, 30))],
					),
				),
			),
		).toBe("decor-collision");
	});

	it("正常系: over-imageは写真の矩形と予約領域の内側に置ける", () => {
		const anchors = [
			anchor("illustration-1", "illustration", rect(30, 40, 60, 45), 3),
		];
		const tape = (offsetMm: readonly [number, number]): FamilyDecoration => ({
			anchorId: "illustration-1",
			assetId: "paper-tape",
			color: "own",
			kind: "asset",
			layer: "over-image",
			offsetMm,
			rotateDeg: [0, 0],
			sizeMm: 6,
		});
		expect(
			resolveFamilyDecor(input([tape([-2, -3])], anchors)).items,
		).toHaveLength(1);
		expect(
			codeOf(() => resolveFamilyDecor(input([tape([-10, -3])], anchors))),
		).toBe("decor-collision");
	});

	it("異常系: over-imageを写真以外のanchorへ置けない", () => {
		expect(
			codeOf(() =>
				resolveFamilyDecor(
					input(
						[
							{
								anchorId: "title-1",
								assetId: "paper-tape",
								color: "own",
								kind: "asset",
								layer: "over-image",
								offsetMm: [0, 0],
								rotateDeg: [0, 0],
								sizeMm: 6,
							},
						],
						[anchor("title-1", "title", rect(20, 30, 80, 20))],
					),
				),
			),
		).toBe("decor-definition-invalid");
	});

	it("異常系: 未登録の素材とanchorは回転の退避を試さずに拒否する", () => {
		const anchors = [anchor("title-1", "title", rect(20, 30, 80, 20))];
		expect(
			codeOf(() =>
				resolveFamilyDecor({
					...input([compass("title-1", [0, 0])], anchors),
					assets: motifAssetsFor(["paper-tape"]),
				}),
			),
		).toBe("decor-unregistered");
		expect(
			codeOf(() =>
				resolveFamilyDecor(input([compass("title-9", [0, 0])], anchors)),
			),
		).toBe("decor-unregistered");
	});

	it("境界値系: 0・負数・非有限の寸法と重複anchorを拒否する", () => {
		const anchors = [anchor("title-1", "title", rect(20, 30, 80, 20))];
		for (const sizeMm of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
			expect(
				codeOf(() =>
					resolveFamilyDecor(
						input(
							[{ ...compass("title-1", [0, 0]), sizeMm } as FamilyDecoration],
							anchors,
						),
					),
				),
			).toBe("decor-definition-invalid");
		}
		expect(
			codeOf(() =>
				resolveFamilyDecor(
					input(
						[compass("title-1", [0, 0])],
						[anchor("title-1", "title", rect(20, 30, 0, 20))],
					),
				),
			),
		).toBe("decor-definition-invalid");
		expect(
			codeOf(() => resolveFamilyDecor(input([], [...anchors, ...anchors]))),
		).toBe("decor-definition-invalid");
	});

	it("異常系: 許可範囲外の回転と着色方式の不一致を拒否する", () => {
		const anchors = [anchor("title-1", "title", rect(20, 30, 80, 20))];
		expect(
			codeOf(() =>
				resolveFamilyDecor(
					input([compass("title-1", [0, 0], [10, -10])], anchors),
				),
			),
		).toBe("decor-definition-invalid");
		expect(
			codeOf(() =>
				resolveFamilyDecor(
					input([compass("title-1", [0, 0], [-200, 10])], anchors),
				),
			),
		).toBe("decor-definition-invalid");
		expect(
			codeOf(() =>
				resolveFamilyDecor(
					input(
						[
							{
								...compass("title-1", [0, 0]),
								color: "own",
							} as FamilyDecoration,
						],
						anchors,
					),
				),
			),
		).toBe("decor-definition-invalid");
	});
});

describe("写真とカードの枠", () => {
	const frame: FamilyDecoration = {
		anchorId: "unit-1",
		fill: "border",
		kind: "frame",
		notchMm: 1,
		radiusMm: 0,
		shape: "torn",
		stroke: "accent",
		widthMm: 2,
	};
	const anchors = [anchor("unit-1", "unit", rect(20, 30, 80, 50))];

	it("正常系: 不透明な面の内側の文字は許し、写真の枠はover-imageになる", () => {
		const card = resolveFamilyDecor(
			input([frame], anchors, [text("spot-name", rect(30, 40, 20, 10))]),
		);
		const [cardFrame] = card.items;
		if (cardFrame?.kind !== "frame") {
			throw new Error("枠がありません。");
		}
		expect(cardFrame.layer).toBe("under-content");
		expect(cardFrame.innerRectMm).toEqual(rect(23, 33, 74, 44));

		const photo = resolveFamilyDecor(
			input(
				[{ ...frame, anchorId: "illustration-1" }],
				[anchor("illustration-1", "illustration", rect(20, 30, 80, 50))],
			),
		);
		expect(photo.items[0]?.kind === "frame" ? photo.items[0].layer : null).toBe(
			"over-image",
		);
	});

	it("正常系: 枠の外側1mmより離れた文字は影響を受けない", () => {
		expect(
			resolveFamilyDecor(
				input([frame], anchors, [text("unit-cost", rect(20, 120, 40, 10))]),
			).items,
		).toHaveLength(1);
	});

	it("異常系: 枠線と切り込みに重なる文字は衝突として扱う", () => {
		expect(
			codeOf(() =>
				resolveFamilyDecor(
					input([frame], anchors, [text("spot-name", rect(20, 30, 20, 10))]),
				),
			),
		).toBe("decor-collision");
	});

	it("境界値系: 円形の枠は矩形の帯ではなく円の内側で文字を判定する", () => {
		const circle: FamilyDecoration = { ...frame, shape: "circle" };
		// 80×50mm anchor, 2mm border, 1mm cut-in: inner ink radius is 22mm, so the
		// safe square is 31.1mm wide even though the band's inner rect is 74mm.
		const resolved = resolveFamilyDecor(input([circle], anchors));
		const safe =
			resolved.items[0]?.kind === "frame"
				? resolved.items[0].textSafeRectMm
				: null;
		expect(safe?.widthMm).toBeCloseTo((2 * 22) / Math.SQRT2, 6);
		expect(
			resolveFamilyDecor(
				input([circle], anchors, [text("spot-name", rect(50, 45, 20, 15))]),
			).items,
		).toHaveLength(1);
		// Inside the rectangular band but outside the circle: the stroke crosses it.
		expect(
			codeOf(() =>
				resolveFamilyDecor(
					input([circle], anchors, [text("spot-name", rect(25, 35, 10, 6))]),
				),
			),
		).toBe("decor-collision");
	});

	it("異常系: 枠幅と切り込みが基準より大きい定義と、own指定を拒否する", () => {
		expect(
			codeOf(() =>
				resolveFamilyDecor(input([{ ...frame, widthMm: 30 }], anchors)),
			),
		).toBe("decor-definition-invalid");
		expect(
			codeOf(() =>
				resolveFamilyDecor(input([{ ...frame, fill: "own" }], anchors)),
			),
		).toBe("decor-definition-invalid");
	});

	it("境界値系: 紙面をはみ出す基準の枠は収まり確認で落とす", () => {
		expect(
			codeOf(() =>
				resolveFamilyDecor(
					input([frame], [anchor("unit-1", "unit", rect(20, 190, 80, 50))]),
				),
			),
		).toBe("decor-collision");
	});
});

describe("掲載単位をつなぐ線", () => {
	const connector: FamilyDecoration = {
		color: "border",
		fromUnitId: "unit-1",
		kind: "connector",
		toUnitId: "unit-2",
		widthMm: 1,
	};
	const anchors = [
		anchor("unit-1", "unit", rect(20, 30, 80, 40)),
		anchor("unit-2", "unit", rect(20, 76, 80, 40)),
	];

	it("正常系: 隣り合う単位の向かい合う辺を結ぶ", () => {
		const resolved = resolveFamilyDecor(
			input([connector], anchors, [text("spot-name", rect(25, 35, 50, 30))]),
		);
		const [line] = resolved.items;
		if (line?.kind !== "connector") {
			throw new Error("接続線がありません。");
		}
		expect(line.fromMm).toEqual([60, 70]);
		expect(line.toMm).toEqual([60, 76]);
		expect(line.layer).toBe("under-content");
		expect(line.boundsMm).toEqual(rect(59.5, 69.5, 1, 7));
	});

	it("異常系: 隙間の文字に重なる線は衝突になる", () => {
		expect(
			codeOf(() =>
				resolveFamilyDecor(
					input([connector], anchors, [text("unit-time", rect(55, 71, 20, 4))]),
				),
			),
		).toBe("decor-collision");
	});

	it("異常系: 隣り合わない単位・同じ単位・単位以外の基準を拒否する", () => {
		expect(
			codeOf(() =>
				resolveFamilyDecor(
					input(
						[connector],
						[
							anchor("unit-1", "unit", rect(20, 30, 80, 40)),
							anchor("unit-2", "unit", rect(30, 40, 80, 40)),
						],
					),
				),
			),
		).toBe("decor-definition-invalid");
		expect(
			codeOf(() =>
				resolveFamilyDecor(
					input([{ ...connector, toUnitId: "unit-1" }], anchors),
				),
			),
		).toBe("decor-definition-invalid");
		expect(
			codeOf(() =>
				resolveFamilyDecor(
					input(
						[{ ...connector, toUnitId: "title-1" }],
						[
							anchors[0] as DecorAnchor,
							anchor("title-1", "title", rect(20, 76, 80, 40)),
						],
					),
				),
			),
		).toBe("decor-definition-invalid");
	});

	it("境界値系: 0以下の線幅と未登録の単位を拒否する", () => {
		expect(
			codeOf(() =>
				resolveFamilyDecor(input([{ ...connector, widthMm: 0 }], anchors)),
			),
		).toBe("decor-definition-invalid");
		expect(
			codeOf(() =>
				resolveFamilyDecor(
					input([{ ...connector, toUnitId: "unit-9" }], anchors),
				),
			),
		).toBe("decor-unregistered");
	});
});

describe("系統の文字の読みやすさ", () => {
	it("正常系: 不透明な面色に対して本文7:1・大見出し4.5:1を満たす", () => {
		expect(() =>
			validateFamilyTextSafety("atlas-grid", "#fffdf8", [
				{ colorHex: "#1d2733", fontSizePt: 10, role: "body" },
				{ colorHex: "#3d4a5a", fontSizePt: 8.5, role: "utility" },
				{ colorHex: "#7a5a2f", fontSizePt: 24, role: "display" },
			]),
		).not.toThrow();
	});

	it("境界値系: 本文10pt・補助8.5ptを下回る定義を拒否する", () => {
		for (const style of [
			{ colorHex: "#1d2733", fontSizePt: 9.5, role: "body" as const },
			{ colorHex: "#3d4a5a", fontSizePt: 8.4, role: "utility" as const },
			{ colorHex: "#7a5a2f", fontSizePt: 17, role: "display" as const },
		]) {
			expect(
				codeOf(() =>
					validateFamilyTextSafety("atlas-grid", "#fffdf8", [style]),
				),
			).toBe("family-text-unsafe");
		}
	});

	it("異常系: コントラスト不足・解釈できない色・定義なしを拒否する", () => {
		expect(
			codeOf(() =>
				validateFamilyTextSafety("atlas-grid", "#fffdf8", [
					{ colorHex: "#8a8f96", fontSizePt: 10, role: "body" },
				]),
			),
		).toBe("family-text-unsafe");
		expect(
			codeOf(() =>
				validateFamilyTextSafety("atlas-grid", "var(--surface)", [
					{ colorHex: "#1d2733", fontSizePt: 10, role: "body" },
				]),
			),
		).toBe("family-text-unsafe");
		expect(
			codeOf(() => validateFamilyTextSafety("atlas-grid", "#fffdf8", [])),
		).toBe("family-text-unsafe");
	});
});
