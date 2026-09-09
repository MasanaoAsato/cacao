import type { MotifDefinition } from "../../../theme/types";

export type MotifShapesProps = {
	readonly color: string | null;
	readonly definition: MotifDefinition;
	readonly maskId: string;
};

function paint(
	value: "color" | "none",
	color: string | null,
): string | undefined {
	return value === "none" ? "none" : (color ?? undefined);
}

/** Draws one motif in its unit box, including external SVG artwork as a mask. */
export function MotifShapes({ color, definition, maskId }: MotifShapesProps) {
	if (definition.kind === "asset") {
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

	return (
		<>
			{definition.shapes.map((shape, index) => {
				const key = `${definition.id}-${index}`;
				const common = {
					fill: paint(shape.fill, color),
					stroke: paint(shape.stroke, color),
					strokeWidth: shape.strokeWidth,
				};
				switch (shape.kind) {
					case "circle":
						return (
							<circle
								key={key}
								cx={shape.cx}
								cy={shape.cy}
								r={shape.r}
								{...common}
							/>
						);
					case "rect":
						return (
							<rect
								key={key}
								height={shape.height}
								width={shape.width}
								x={shape.x}
								y={shape.y}
								{...common}
							/>
						);
					default:
						return (
							<path
								key={key}
								d={shape.d}
								strokeDasharray={
									shape.dashed
										? `${shape.strokeWidth * 3} ${shape.strokeWidth * 3}`
										: undefined
								}
								{...common}
							/>
						);
				}
			})}
		</>
	);
}
