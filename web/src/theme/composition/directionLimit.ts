/** Build-time setting for the maximum number of effective directions in a booklet. */
export function parseDirectionLimit(raw: string | undefined): number {
	if (raw === undefined) return 1;
	if (!/^[1-9]\d*$/.test(raw))
		throw new Error(
			"VITE_BOOKLET_MAX_DIRECTIONSには1以上の整数を指定してください。",
		);
	const value = Number(raw);
	if (!Number.isSafeInteger(value))
		throw new Error(
			"VITE_BOOKLET_MAX_DIRECTIONSが安全な整数の範囲を超えています。",
		);
	return value;
}
