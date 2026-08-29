import { describe, expect, it } from "vitest";
import {
	initialJourneyCreationFormValues,
	JourneyCreationValidationError,
	toJourneyRequestPayload,
	validateJourneyCreationForm,
} from "./form";

const validValues = {
	...initialJourneyCreationFormValues,
	amount: "90000",
	departure_city: "千葉",
	destination_city: "宇都宮",
	end_date: "2026-10-25",
	start_date: "2026-10-23",
};

describe("journey creation form", () => {
	it("正常系: フォーム値をAPIのJSONへ変換する", () => {
		expect(toJourneyRequestPayload(validValues)).toEqual({
			amount: 90000,
			currency: "JPY",
			departure_city: "千葉",
			departure_country: "Japan",
			destination_city: "宇都宮",
			destination_country: "Japan",
			end_date: "2026-10-25T00:00:00Z",
			start_date: "2026-10-23T00:00:00Z",
		});
	});

	it("異常系: 空欄、逆順の日付、非整数の予算を拒否する", () => {
		const errors = validateJourneyCreationForm({
			...validValues,
			amount: "1.5",
			departure_city: "",
			end_date: "2026-10-22",
		});

		expect(errors.departure_city).toContain("出発都市");
		expect(errors.end_date).toContain("開始日以降");
		expect(errors.amount).toContain("整数");
		expect(() =>
			toJourneyRequestPayload({
				...validValues,
				currency: "円",
			}),
		).toThrow(JourneyCreationValidationError);
	});

	it("境界値系: 同日かつ予算1を受け付ける", () => {
		const values = {
			...validValues,
			amount: "1",
			end_date: "2026-10-23",
		};

		expect(validateJourneyCreationForm(values)).toEqual({});
		expect(toJourneyRequestPayload(values)).toMatchObject({
			amount: 1,
			end_date: "2026-10-23T00:00:00Z",
			start_date: "2026-10-23T00:00:00Z",
		});
	});

	it("異常系: 暦に存在しない日付と安全整数外の予算を拒否する", () => {
		const errors = validateJourneyCreationForm({
			...validValues,
			amount: "9007199254740992",
			start_date: "2026-02-29",
		});

		expect(errors.start_date).toContain("実在する日付");
		expect(errors.amount).toContain("安全な整数");
	});
});
