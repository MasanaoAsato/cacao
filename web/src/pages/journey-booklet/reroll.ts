import type { ThemeSeed } from "../../theme/types";

export type RandomValuesSource = (
	values: Uint32Array<ArrayBuffer>,
) => Uint32Array<ArrayBuffer>;

const cryptoRandomValues: RandomValuesSource = (values) =>
	crypto.getRandomValues(values);

/**
 * Draws one Uint32 from crypto and formats it as a v2 seed. Neither the
 * current seed nor its design is excluded, and no history is kept, so the
 * same seed or look may come back; that is a normal draw.
 */
export function selectRerollSeed(
	getRandomValues: RandomValuesSource = cryptoRandomValues,
): ThemeSeed {
	const values = getRandomValues(
		new Uint32Array(new ArrayBuffer(Uint32Array.BYTES_PER_ELEMENT)),
	);
	const value = values[0];
	if (value === undefined) {
		throw new Error("しおりデザインの乱数を取得できませんでした。");
	}
	return { value, version: "v2" };
}
