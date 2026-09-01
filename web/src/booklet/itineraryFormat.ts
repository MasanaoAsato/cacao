const DATE_PREFIX = /^(\d{4})-(\d{2})-(\d{2})T/;
const TIME_PART = /T(\d{2}:\d{2})/;

const TRANSPORT_MODE_LABELS: Readonly<Record<string, string>> = {
	bicycle: "自転車",
	bus: "バス",
	car: "車",
	ferry: "フェリー",
	flight: "飛行機",
	other: "その他",
	taxi: "タクシー",
	train: "電車",
	walk: "徒歩",
};

function fallbackDateTime(value: string): string {
	return value.replace("T", " ");
}

export function formatBookletDate(value: string): string {
	const match = DATE_PREFIX.exec(value);
	return match
		? `${match[1]}/${match[2]}/${match[3]}`
		: fallbackDateTime(value);
}

export function formatBookletTime(value: string): string {
	const match = TIME_PART.exec(value);
	return match?.[1] ?? fallbackDateTime(value);
}

export function formatTransportMode(value: string): string {
	return TRANSPORT_MODE_LABELS[value] ?? value;
}
