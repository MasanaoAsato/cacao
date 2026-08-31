const RFC3339_PATTERN =
	/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

type Rfc3339Parts = {
	readonly day: string;
	readonly hour: string;
	readonly minute: string;
	readonly month: string;
	readonly year: string;
};

function daysInMonth(year: number, month: number): number {
	if (month === 2) {
		const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
		return leapYear ? 29 : 28;
	}
	return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function parseRfc3339(value: string): Rfc3339Parts {
	const match = RFC3339_PATTERN.exec(value);
	if (!match) {
		throw new Error(`RFC 3339形式ではない日時「${value}」です。`);
	}

	const [, year, month, day, hour, minute, second, offset] = match;
	if (!year || !month || !day || !hour || !minute || !second || !offset) {
		throw new Error(`RFC 3339形式ではない日時「${value}」です。`);
	}

	const yearNumber = Number(year);
	const monthNumber = Number(month);
	const dayNumber = Number(day);
	const hourNumber = Number(hour);
	const minuteNumber = Number(minute);
	const secondNumber = Number(second);
	const offsetHour = offset === "Z" ? 0 : Number(offset.slice(1, 3));
	const offsetMinute = offset === "Z" ? 0 : Number(offset.slice(4, 6));
	if (
		yearNumber < 1 ||
		monthNumber < 1 ||
		monthNumber > 12 ||
		dayNumber < 1 ||
		dayNumber > daysInMonth(yearNumber, monthNumber) ||
		hourNumber > 23 ||
		minuteNumber > 59 ||
		secondNumber > 59 ||
		offsetHour > 23 ||
		offsetMinute > 59
	) {
		throw new Error(`RFC 3339形式ではない日時「${value}」です。`);
	}

	return { day, hour, minute, month, year };
}

export function formatBookletDate(value: string): string {
	const { day, month, year } = parseRfc3339(value);
	return `${year}/${month}/${day}`;
}

export function formatBookletDateTime(value: string): string {
	const { day, hour, minute, month, year } = parseRfc3339(value);
	return `${year}/${month}/${day} ${hour}:${minute}`;
}
