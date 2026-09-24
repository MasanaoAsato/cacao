import type { MotifAsset } from "../../../theme/motifAssets";

export type MotifShapesProps = {
	readonly color: string | null;
	readonly definition: MotifAsset;
	readonly maskId: string;
};

/** Builds an SVG element id, dropping the characters ids may not contain. */
export function svgId(...parts: readonly string[]): string {
	return parts.join("-").replace(/[^a-z0-9-]/gi, "-");
}

/** Draws one SVG asset in its unit box, recoloured through a mask when asked. */
export function MotifShapes({ color, definition, maskId }: MotifShapesProps) {
	if (definition.recolor === "mask" && color) {
		return (
			<>
				<mask id={maskId}>
					<image
						height="1"
						href={definition.src}
						preserveAspectRatio="none"
						width={definition.aspect}
					/>
				</mask>
				<rect
					fill={color}
					height="1"
					mask={`url(#${maskId})`}
					width={definition.aspect}
				/>
			</>
		);
	}
	return (
		<image
			height="1"
			href={definition.src}
			preserveAspectRatio="none"
			width={definition.aspect}
		/>
	);
}
