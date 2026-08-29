import type { CreateJourneyRequestPayload } from "../../api/journeyRequests";

export type JourneyCreationFormValues = {
	departure_city: string;
	departure_country: string;
	destination_city: string;
	destination_country: string;
	start_date: string;
	end_date: string;
	amount: string;
	currency: string;
};

export type JourneyCreationFormField = keyof JourneyCreationFormValues;

export type JourneyCreationFormErrors = Partial<
	Record<JourneyCreationFormField, string>
>;

export const initialJourneyCreationFormValues: JourneyCreationFormValues = {
	amount: "",
	currency: "JPY",
	departure_city: "",
	departure_country: "Japan",
	destination_city: "",
	destination_country: "Japan",
	end_date: "",
	start_date: "",
};

export class JourneyCreationValidationError extends Error {
	readonly fieldErrors: JourneyCreationFormErrors;

	constructor(fieldErrors: JourneyCreationFormErrors) {
		super("入力内容を確認してください。");
		this.name = "JourneyCreationValidationError";
		this.fieldErrors = fieldErrors;
	}
}

function isValidCalendarDate(value: string): boolean {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
	if (!match) {
		return false;
	}

	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	if (year < 1 || month < 1 || month > 12 || day < 1) {
		return false;
	}

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

	return day <= (daysInMonth ?? 0);
}

function validateRequired(value: string, label: string): string | undefined {
	return value.trim().length > 0 ? undefined : `${label}を入力してください。`;
}

function validateAmount(value: string): string | undefined {
	if (!/^\d+$/.test(value)) {
		return "予算は1以上の整数で入力してください。";
	}

	const amount = Number(value);
	if (!Number.isSafeInteger(amount) || amount < 1) {
		return "予算は1以上の安全な整数で入力してください。";
	}

	return undefined;
}

function validateCurrency(value: string): string | undefined {
	return /^[a-zA-Z]{3}$/.test(value.trim())
		? undefined
		: "通貨は英字3文字で入力してください。";
}

export function validateJourneyCreationForm(
	values: JourneyCreationFormValues,
): JourneyCreationFormErrors {
	const errors: JourneyCreationFormErrors = {};
	const requiredFields: ReadonlyArray<
		readonly [JourneyCreationFormField, string]
	> = [
		["departure_city", "出発都市"],
		["departure_country", "出発国"],
		["destination_city", "目的地都市"],
		["start_date", "開始日"],
		["end_date", "終了日"],
	];

	for (const [field, label] of requiredFields) {
		const error = validateRequired(values[field], label);
		if (error) {
			errors[field] = error;
		}
	}

	if (values.start_date.trim() && !isValidCalendarDate(values.start_date)) {
		errors.start_date = "開始日は実在する日付を選択してください。";
	}
	if (values.end_date.trim() && !isValidCalendarDate(values.end_date)) {
		errors.end_date = "終了日は実在する日付を選択してください。";
	}
	if (
		isValidCalendarDate(values.start_date) &&
		isValidCalendarDate(values.end_date) &&
		values.end_date < values.start_date
	) {
		errors.end_date = "終了日は開始日以降の日付を選択してください。";
	}

	const amountError = validateAmount(values.amount.trim());
	if (amountError) {
		errors.amount = amountError;
	}
	const currencyError = validateCurrency(values.currency);
	if (currencyError) {
		errors.currency = currencyError;
	}

	return errors;
}

function toStartOfDayUtc(value: string): string {
	return `${value}T00:00:00Z`;
}

export function toJourneyRequestPayload(
	values: JourneyCreationFormValues,
): CreateJourneyRequestPayload {
	const errors = validateJourneyCreationForm(values);
	if (Object.keys(errors).length > 0) {
		throw new JourneyCreationValidationError(errors);
	}

	return {
		amount: Number(values.amount.trim()),
		currency: values.currency.trim().toUpperCase(),
		departure_city: values.departure_city.trim(),
		departure_country: values.departure_country.trim(),
		destination_city: values.destination_city.trim(),
		destination_country: values.destination_country.trim(),
		end_date: toStartOfDayUtc(values.end_date),
		start_date: toStartOfDayUtc(values.start_date),
	};
}
