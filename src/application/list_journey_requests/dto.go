package listjourneyrequests

import "time"

// Input は ListJourneyRequests ユースケースの入力データ。
type Input struct{}

// Output は ListJourneyRequests ユースケースの出力データ。
type Output struct {
	Requests []JourneyRequestDTO
}

// JourneyRequestDTO は JourneyRequest エンティティの読み取り専用表現。
type JourneyRequestDTO struct {
	ID        string
	Departure string
	Period    PeriodDTO
	Budget    MoneyDTO
}

// PeriodDTO は Period 値オブジェクトの読み取り専用表現。
type PeriodDTO struct {
	StartDate time.Time
	EndDate   time.Time
}

// MoneyDTO は Money 値オブジェクトの読み取り専用表現。
type MoneyDTO struct {
	Amount   int
	Currency string
}
