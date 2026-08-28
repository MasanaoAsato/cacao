export type ApiRequestOptions = {
	readonly fetchImpl?: typeof fetch;
	readonly signal?: AbortSignal;
};

export class ApiError extends Error {
	readonly status: number | undefined;

	constructor(
		message: string,
		options?: { readonly cause?: unknown; readonly status?: number },
	) {
		super(message, options);
		this.name = "ApiError";
		this.status = options?.status;
	}
}

export class ApiResponseError extends ApiError {
	constructor(message: string) {
		super(message);
		this.name = "ApiResponseError";
	}
}

export type JsonParser<T> = (value: unknown) => T;

export async function requestJson<T>(
	path: string,
	parser: JsonParser<T>,
	options: ApiRequestOptions & {
		readonly body?: unknown;
		readonly headers?: HeadersInit;
		readonly method?: string;
	} = {},
): Promise<T> {
	const fetchImpl = options.fetchImpl ?? globalThis.fetch;
	const headers = new Headers(options.headers);
	const requestInit: RequestInit = {
		headers,
		method: options.method ?? "GET",
		signal: options.signal,
	};

	if (options.body !== undefined) {
		headers.set("Content-Type", "application/json");
		requestInit.body = JSON.stringify(options.body);
	}

	let response: Response;
	try {
		response = await fetchImpl(path, requestInit);
	} catch (error) {
		throw new ApiError("APIへの接続に失敗しました。", { cause: error });
	}

	if (!response.ok) {
		throw new ApiError(
			`APIリクエストに失敗しました（HTTP ${response.status}）。`,
			{
				status: response.status,
			},
		);
	}

	let payload: unknown;
	try {
		payload = await response.json();
	} catch (error) {
		throw new ApiError("APIレスポンスのJSONを読み取れませんでした。", {
			cause: error,
			status: response.status,
		});
	}

	try {
		return parser(payload);
	} catch (error) {
		if (error instanceof ApiError) {
			throw error;
		}

		throw new ApiResponseError("APIレスポンスの形式が不正です。");
	}
}

export function readRecord(
	value: unknown,
	context: string,
): Record<string, unknown> {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		throw new ApiResponseError(
			`${context}はオブジェクトである必要があります。`,
		);
	}

	return value as Record<string, unknown>;
}

export function readArray(value: unknown, context: string): readonly unknown[] {
	if (!Array.isArray(value)) {
		throw new ApiResponseError(`${context}は配列である必要があります。`);
	}

	return value;
}

export function readString(
	record: Record<string, unknown>,
	key: string,
	context: string,
): string {
	const value = record[key];
	if (typeof value !== "string") {
		throw new ApiResponseError(
			`${context}.${key}は文字列である必要があります。`,
		);
	}

	return value;
}

export function readNonEmptyString(
	record: Record<string, unknown>,
	key: string,
	context: string,
): string {
	const value = readString(record, key, context);
	if (value.trim().length === 0) {
		throw new ApiResponseError(`${context}.${key}は空にできません。`);
	}

	return value;
}

export function readNullableString(
	record: Record<string, unknown>,
	key: string,
	context: string,
): string | null {
	const value = record[key];
	if (value === null) {
		return null;
	}
	if (typeof value !== "string") {
		throw new ApiResponseError(
			`${context}.${key}は文字列またはnullである必要があります。`,
		);
	}

	return value;
}

export function readInteger(
	record: Record<string, unknown>,
	key: string,
	context: string,
	options: { readonly min?: number } = {},
): number {
	const value = record[key];
	if (
		typeof value !== "number" ||
		!Number.isInteger(value) ||
		(options.min !== undefined && value < options.min)
	) {
		throw new ApiResponseError(`${context}.${key}は整数として不正です。`);
	}

	return value;
}

export function readNullableInteger(
	record: Record<string, unknown>,
	key: string,
	context: string,
): number | null {
	const value = record[key];
	if (value === null) {
		return null;
	}
	if (typeof value !== "number" || !Number.isInteger(value)) {
		throw new ApiResponseError(
			`${context}.${key}は整数またはnullである必要があります。`,
		);
	}

	return value;
}

const rfc3339Pattern =
	/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

export function readRfc3339(
	record: Record<string, unknown>,
	key: string,
	context: string,
): string {
	const value = readString(record, key, context);
	if (!isRfc3339(value)) {
		throw new ApiResponseError(
			`${context}.${key}はRFC 3339日時として不正です。`,
		);
	}

	return value;
}

export function isRfc3339(value: string): boolean {
	const match = rfc3339Pattern.exec(value);
	if (!match) {
		return false;
	}

	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	const hour = Number(match[4]);
	const minute = Number(match[5]);
	const second = Number(match[6]);
	const offset = match[7];
	const offsetHour = offset === "Z" ? 0 : Number(offset.slice(1, 3));
	const offsetMinute = offset === "Z" ? 0 : Number(offset.slice(4, 6));
	const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
	const daysInMonth = [
		31,
		leapYear ? 29 : 28,
		31,
		30,
		31,
		30,
		31,
		31,
		30,
		31,
		30,
		31,
	][month - 1];

	return (
		month >= 1 &&
		month <= 12 &&
		day >= 1 &&
		day <= (daysInMonth ?? 0) &&
		hour >= 0 &&
		hour <= 23 &&
		minute >= 0 &&
		minute <= 59 &&
		second >= 0 &&
		second <= 59 &&
		offsetHour >= 0 &&
		offsetHour <= 23 &&
		offsetMinute >= 0 &&
		offsetMinute <= 59 &&
		!Number.isNaN(Date.parse(value))
	);
}
