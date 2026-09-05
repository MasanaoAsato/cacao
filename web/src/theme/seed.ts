import type { ThemeCatalogVersion, ThemeSeed } from "./types";

const THEME_VERSION: ThemeCatalogVersion = "v2";
const SEED_TOKEN_PATTERN = /^v2-([0-9a-f]{8})$/i;
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
		value: fnv1a32(`booklet-theme:v2:${journeyId}`),
		version: THEME_VERSION,
	};
}

export function formatThemeSeed(
	seed: ThemeSeed,
): `${ThemeCatalogVersion}-${string}` {
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
	return () => {
		seed += 0x6d2b79f5;
		let value = seed;
		value = Math.imul(value ^ (value >>> 15), value | 1);
		value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
		return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
	};
}

export function axisRandom(seedToken: string, axis: string): number {
	return mulberry32(fnv1a32(`${seedToken}:${axis}`))();
}

export function createRerollSeed(
	current: ThemeSeed,
	isDifferentTheme: (candidate: ThemeSeed) => boolean,
	getRandomValues: (
		values: Uint32Array<ArrayBuffer>,
	) => Uint32Array<ArrayBuffer> = (values) => {
		crypto.getRandomValues(values);
		return values;
	},
): ThemeSeed {
	for (let attempt = 0; attempt < 256; attempt += 1) {
		const values = getRandomValues(
			new Uint32Array(new ArrayBuffer(Uint32Array.BYTES_PER_ELEMENT)),
		);
		const candidate = { value: values[0], version: THEME_VERSION } as const;
		if (candidate.value !== current.value && isDifferentTheme(candidate)) {
			return candidate;
		}
	}
	throw new Error("異なるしおりデザインのシードを作成できませんでした。");
}
