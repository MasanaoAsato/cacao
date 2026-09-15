import { useLayoutEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { FamilyDecorLayer } from "../../src/pages/journey-booklet/decor/FamilyDecorLayer";
import { MotifShapes } from "../../src/pages/journey-booklet/decor/MotifShapes";
import {
	prepareFamilyDecor,
	readDecorAnchors,
	readProtectedTextRects,
} from "../../src/pages/journey-booklet/families/useFamilyPagePlan";
import "../../src/print.css";
import type { ResolvedBookletDesign } from "../../src/booklet/family";
import {
	DecorPlacementError,
	type FamilyDecoration,
	type ResolvedFamilyDecor,
	resolveFamilyDecor,
} from "../../src/theme/families/decorPlacement";
import {
	MOTIF_ASSETS,
	type MotifAssetId,
	motifAssetsFor,
} from "../../src/theme/motifAssets";
import type { RequestedBookletTheme } from "../../src/theme/types";

const SEED_TOKEN = "v2-0000002a";

function colorFor(asset: (typeof MOTIF_ASSETS)[number]): string | null {
	if (asset.recolor === "none") {
		return null;
	}
	return asset.styleId === "atlas-ink" ? "#19324d" : "#cf5b36";
}

function DecorAssetsFixture() {
	return (
		<svg
			aria-label="装飾素材のA5見本"
			data-decor-assets
			height="210mm"
			viewBox="0 0 148 210"
			width="148mm"
		>
			<rect fill="#fffdf8" height="210" width="148" />
			{MOTIF_ASSETS.flatMap((asset) =>
				[0, 1].map((repeat) => ({ asset, repeat })),
			).map(({ asset, repeat }, index) => {
				const column = index % 4;
				const row = Math.floor(index / 4);
				return (
					<g
						data-decor-asset={asset.id}
						key={`${asset.id}-${repeat}`}
						transform={`translate(${8 + column * 34} ${10 + row * 33}) scale(10)`}
					>
						<MotifShapes
							color={colorFor(asset)}
							definition={asset}
							maskId={`decor-assets-${asset.id}-${repeat}`}
						/>
					</g>
				);
			})}
		</svg>
	);
}

/**
 * Placement fixture (20.6). Each example is a fixed A5 page whose composition
 * reserves space for decor, so the boundary between photo, text and decor can
 * be measured on the product layers instead of on a mock.
 */
const PHOTO_SRC = `data:image/svg+xml,${encodeURIComponent(
	`<svg xmlns="http://www.w3.org/2000/svg" width="420" height="300" viewBox="0 0 420 300">
  <rect width="420" height="300" fill="#2f5f74"/>
  <circle cx="310" cy="80" r="52" fill="#f3d089"/>
  <path d="M0 220 C110 170 240 260 420 190 V300 H0Z" fill="#183a42"/>
</svg>`,
)}`;

type FixtureAnchorId = "title-1" | "illustration-1" | "unit-1" | "unit-2";

type FixtureAnchor = {
	readonly heightMm: number | null;
	readonly id: FixtureAnchorId;
	readonly kind: "title" | "illustration" | "unit";
	readonly leftMm: number;
	readonly reserveMm: number;
	readonly topMm: number;
	readonly widthMm: number;
};

const ANCHOR_LAYOUT: Readonly<Record<FixtureAnchorId, FixtureAnchor>> = {
	"illustration-1": {
		heightMm: 50,
		id: "illustration-1",
		kind: "illustration",
		leftMm: 12,
		reserveMm: 4,
		topMm: 42,
		widthMm: 70,
	},
	"title-1": {
		heightMm: null,
		id: "title-1",
		kind: "title",
		leftMm: 12,
		reserveMm: 0,
		topMm: 12,
		widthMm: 124,
	},
	"unit-1": {
		heightMm: 30,
		id: "unit-1",
		kind: "unit",
		leftMm: 12,
		reserveMm: 0,
		topMm: 104,
		widthMm: 124,
	},
	"unit-2": {
		heightMm: 30,
		id: "unit-2",
		kind: "unit",
		leftMm: 12,
		reserveMm: 0,
		topMm: 140,
		widthMm: 124,
	},
};

type PlacementExample = {
	readonly anchorIds: readonly FixtureAnchorId[];
	readonly assetIds: readonly MotifAssetId[];
	readonly decorations: readonly FamilyDecoration[];
	readonly heading: string;
	readonly id: string;
};

const HEADING = "8月28日 京都散策";
const LONG_HEADING =
	"8月28日 非常に長い見出しの日程と地域文化をめぐる散策の一日";

const TITLE_COMPASS = (
	offsetMm: readonly [number, number],
	rotateDeg: readonly [number, number],
): FamilyDecoration => ({
	anchorId: "title-1",
	assetId: "atlas-compass",
	color: "accent",
	kind: "asset",
	layer: "under-content",
	offsetMm,
	rotateDeg,
	sizeMm: 10,
});

const PLACEMENT_EXAMPLES: readonly PlacementExample[] = [
	{
		anchorIds: ["title-1", "illustration-1", "unit-1", "unit-2"],
		assetIds: ["atlas-compass", "paper-tape", "paper-torn-sheet"],
		decorations: [
			TITLE_COMPASS([0, 6], [-10, 10]),
			{
				anchorId: "unit-1",
				assetId: "paper-torn-sheet",
				color: "own",
				kind: "asset",
				layer: "under-content",
				offsetMm: [0, 0],
				rotateDeg: [0, 0],
				sizeMm: 30,
			},
			{
				anchorId: "illustration-1",
				fill: "border",
				kind: "frame",
				notchMm: 1,
				radiusMm: 0,
				shape: "torn",
				stroke: "accent",
				widthMm: 2,
			},
			{
				anchorId: "illustration-1",
				assetId: "paper-tape",
				color: "own",
				kind: "asset",
				layer: "over-image",
				offsetMm: [-3, -3],
				rotateDeg: [-6, 6],
				sizeMm: 6,
			},
			{
				color: "border",
				fromUnitId: "unit-1",
				kind: "connector",
				toUnitId: "unit-2",
				widthMm: 1,
			},
		],
		heading: HEADING,
		id: "reserved",
	},
	{
		anchorIds: ["title-1"],
		assetIds: ["atlas-compass"],
		decorations: [TITLE_COMPASS([6, 6], [45, 45])],
		heading: HEADING,
		id: "rotation-fallback",
	},
	{
		anchorIds: ["title-1"],
		assetIds: ["atlas-compass"],
		decorations: [TITLE_COMPASS([20, 6], [0, 0])],
		heading: HEADING,
		id: "collision",
	},
	{
		anchorIds: ["title-1"],
		assetIds: ["paper-tape"],
		decorations: [TITLE_COMPASS([0, 6], [0, 0])],
		heading: HEADING,
		id: "unregistered",
	},
	{
		anchorIds: ["title-1"],
		assetIds: ["atlas-compass"],
		decorations: [TITLE_COMPASS([0, 6], [-10, 10])],
		heading: LONG_HEADING,
		id: "long-title",
	},
];

function designFor(example: PlacementExample): ResolvedBookletDesign {
	return {
		comparisonKey: `paper-collage.paper-cut.${example.id}`,
		compositionId: example.id,
		decorAssetIds: example.assetIds,
		familyId: "paper-collage",
		fontFamilies: [],
		policyId: "legacy-full",
		paletteId: "paper-cut",
		renderKey: `paper-collage:${SEED_TOKEN}:legacy-full:${example.id}`,
		requestedTheme: {} as RequestedBookletTheme,
		seedToken: SEED_TOKEN,
	};
}

/** Placement codes stay stable; anything else surfaces its own message. */
function failureCode(error: unknown): string {
	if (error instanceof DecorPlacementError) {
		return error.code;
	}
	return error instanceof Error ? error.message : "unexpected";
}

type CaseState = {
	readonly checked: boolean;
	readonly decor: ResolvedFamilyDecor | null;
	readonly error: string | null;
};

const IDLE: CaseState = { checked: false, decor: null, error: null };

function PlacementCase({ example }: { readonly example: PlacementExample }) {
	const rootRef = useRef<HTMLDivElement>(null);
	const [state, setState] = useState<CaseState>(IDLE);

	// Pass 1 measures the laid-out page and resolves the decor; pass 2 confirms
	// the drawn layers match, which is the order the product readiness uses.
	useLayoutEffect(() => {
		const root = rootRef.current;
		const page = root?.querySelector<HTMLElement>("[data-booklet-page]");
		if (!root || !page || state.error !== null || state.checked) {
			return;
		}
		try {
			if (state.decor === null) {
				setState({
					checked: false,
					decor: resolveFamilyDecor({
						anchors: readDecorAnchors(page),
						assets: motifAssetsFor(example.assetIds),
						decorations: example.decorations,
						familyId: "paper-collage",
						pageId: example.id,
						protectedTexts: readProtectedTextRects(page),
						seedToken: SEED_TOKEN,
					}),
					error: null,
				});
				return;
			}
			prepareFamilyDecor(
				root,
				designFor(example),
				new Map([[example.id, example.decorations]]),
			);
			setState((current) => ({ ...current, checked: true }));
		} catch (error) {
			setState({ checked: false, decor: null, error: failureCode(error) });
		}
	}, [example, state]);

	return (
		<div
			className="decor-placement__case"
			data-decor-case={example.id}
			data-decor-error={state.error ?? undefined}
			data-decor-rotation-fallbacks={state.decor?.rotationFallbacks.join(" ")}
			data-decor-status={
				state.error !== null ? "error" : state.checked ? "ready" : "measuring"
			}
			ref={rootRef}
		>
			<article
				className="booklet-page decor-placement__page"
				data-booklet-page="true"
				data-page-id={example.id}
			>
				{state.decor ? (
					<FamilyDecorLayer
						decor={state.decor}
						layer="under-content"
						pageId={example.id}
						scope="output"
					/>
				) : null}
				<div className="booklet-page__content decor-placement__content">
					{example.anchorIds.map((anchorId) => {
						const anchor = ANCHOR_LAYOUT[anchorId];
						return (
							<div
								className="decor-placement__anchor"
								data-booklet-anchor={anchor.id}
								data-booklet-anchor-kind={anchor.kind}
								data-booklet-anchor-reserve={anchor.reserveMm}
								key={anchor.id}
								style={{
									height:
										anchor.heightMm === null
											? undefined
											: `${anchor.heightMm}mm`,
									left: `${anchor.leftMm}mm`,
									top: `${anchor.topMm}mm`,
									width: `${anchor.widthMm}mm`,
								}}
							>
								{anchor.kind === "title" ? (
									<h2
										className="decor-placement__title"
										data-booklet-text-role="day-title"
									>
										{example.heading}
									</h2>
								) : null}
								{anchor.kind === "illustration" ? (
									<img
										alt="旅程の挿絵"
										className="decor-placement__photo"
										src={PHOTO_SRC}
									/>
								) : null}
								{anchor.kind === "unit" ? (
									<p
										className="decor-placement__unit"
										data-booklet-text-role="spot-name"
									>
										{anchor.id === "unit-1" ? "歴史地区の散策" : "朝の市場"}
									</p>
								) : null}
							</div>
						);
					})}
				</div>
				{state.decor ? (
					<FamilyDecorLayer
						decor={state.decor}
						layer="over-image"
						pageId={example.id}
						scope="output"
					/>
				) : null}
			</article>
		</div>
	);
}

const PLACEMENT_CSS = `
.decor-placement { display: grid; gap: 8mm; justify-items: center; margin: 0; padding: 4mm; }
.decor-placement__page {
	padding: 0;
	background: #fffdf8;
	--booklet-itinerary-accent: #cf5b36;
	--booklet-itinerary-border: #b7a48a;
	--booklet-itinerary-muted: #6b6255;
}
.decor-placement__content { position: relative; }
.decor-placement__anchor { position: absolute; }
.decor-placement__title {
	margin: 0 0 0 18mm;
	color: #1d2733;
	font: 700 16pt/1.3 system-ui, sans-serif;
}
.decor-placement__photo { display: block; width: 100%; height: 100%; object-fit: cover; }
.decor-placement__unit { margin: 3mm; color: #1d2733; font: 10pt/1.5 system-ui, sans-serif; }
`;

function DecorPlacementFixture() {
	return (
		<>
			<style>{PLACEMENT_CSS}</style>
			<div className="decor-placement" data-decor-placement>
				{PLACEMENT_EXAMPLES.map((example) => (
					<PlacementCase example={example} key={example.id} />
				))}
			</div>
		</>
	);
}

const assetsRoot = document.querySelector("[data-decor-assets-root]");
const placementRoot = document.querySelector("[data-decor-placement-root]");
if (assetsRoot) {
	createRoot(assetsRoot).render(<DecorAssetsFixture />);
} else if (placementRoot) {
	createRoot(placementRoot).render(<DecorPlacementFixture />);
} else {
	throw new Error("装飾の検証領域がありません。");
}
