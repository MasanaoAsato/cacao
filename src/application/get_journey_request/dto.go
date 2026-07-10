package getjourneyrequest

import "time"

// Input は GetJourneyRequest ユースケースの入力データ。
type Input struct {
	RequestID string
}

// Output は GetJourneyRequest ユースケースの出力データ。
type Output struct {
	Request JourneyRequestDTO
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
