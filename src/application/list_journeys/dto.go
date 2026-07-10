package listjourneys

import "time"

// Input は ListJourneys ユースケースの入力データ。
type Input struct{}

// Output は ListJourneys ユースケースの出力データ。
type Output struct {
	Journeys []JourneyDTO
}

// JourneyDTO は Journey エンティティの読み取り専用表現。
type JourneyDTO struct {
	ID        string
	RequestID string
	DayCount  int
	Days      []ItineraryDayDTO
}

// ItineraryDayDTO は ItineraryDay エンティティの読み取り専用表現。
type ItineraryDayDTO struct {
	ID    string
	Date  time.Time
	Spots []SpotDTO
}

// SpotDTO は Spot エンティティの読み取り専用表現。
type SpotDTO struct {
	ID            string
	Name          string
	Description   string
	StartAt       time.Time
	EstimatedCost MoneyDTO
}

// MoneyDTO は Money 値オブジェクトの読み取り専用表現。
type MoneyDTO struct {
	Amount   int
	Currency string
}
