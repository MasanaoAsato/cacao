import type { ThemeCatalogVersion, ThemeSeed } from "./types";

const THEME_VERSION: ThemeCatalogVersion = "v1";
const SEED_TOKEN_PATTERN = /^v1-([0-9a-f]{8})$/i;
const UINT32_MAX = 0xffffffff;

export type ParsedThemeSeed =
	| { readonly kind: "valid"; readonly seed: ThemeSeed; readonly token: string }
	| { readonly kind: "missing" | "invalid" };

export function fnv1a32(value: string): number {
	let hash = 0x811c9dc5;
	for (const byte of new TextEncoder().encode(value)) {
		hash ^= byte;
		hash = Math.imul(hash, 0x01000193);
	}

	return hash >>> 0;
}

export function createDefaultThemeSeed(journeyId: string): ThemeSeed {
	return {
		value: fnv1a32(`booklet-theme:v1:${journeyId}`),
		version: THEME_VERSION,
	};
}

export function formatThemeSeed(seed: ThemeSeed): string {
	return `${seed.version}-${seed.value.toString(16).padStart(8, "0")}`;
}

export function parseThemeSeed(value: string | null): ParsedThemeSeed {
	if (value === null) {
		return { kind: "missing" };
	}

	const match = SEED_TOKEN_PATTERN.exec(value);
	if (!match) {
		return { kind: "invalid" };
	}

	const numericValue = Number.parseInt(match[1], 16);
	if (
		!Number.isInteger(numericValue) ||
		numericValue < 0 ||
		numericValue > UINT32_MAX
	) {
		return { kind: "invalid" };
	}

	const seed = { value: numericValue, version: THEME_VERSION } as const;
	return { kind: "valid", seed, token: formatThemeSeed(seed) };
}

export function mulberry32(seed: number): () => number {
	let value = seed >>> 0;
	return () => {
		value = (value + 0x6d2b79f5) | 0;
		let result = Math.imul(value ^ (value >>> 15), 1 | value);
		result ^= result + Math.imul(result ^ (result >>> 7), 61 | result);
		return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
	};
}

export function createRerollSeed(
	current: ThemeSeed,
	isDifferentRecipe: (candidate: ThemeSeed) => boolean,
	randomValues: (
		values: Uint32Array<ArrayBufferLike>,
	) => Uint32Array<ArrayBufferLike> = (values) => {
		crypto.getRandomValues(values as unknown as Uint32Array<ArrayBuffer>);
		return values;
	},
): ThemeSeed | null {
	for (let attempt = 0; attempt < 256; attempt += 1) {
		const values = randomValues(new Uint32Array(1));
		const value = values[0];
		if (value === undefined || value === current.value) {
			continue;
		}

		const candidate = { value, version: THEME_VERSION } as const;
		if (isDifferentRecipe(candidate)) {
			return candidate;
		}
	}

	return null;
}
