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

export function formatTransportMode(value: string): string {
	return TRANSPORT_MODE_LABELS[value] ?? value;
}
