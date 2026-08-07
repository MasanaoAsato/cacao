package getjourney

import "time"

// Input は GetJourney ユースケースの入力データ。
type Input struct {
	JourneyID string
}

// Output は GetJourney ユースケースの出力データ。
type Output struct {
	Journey JourneyDTO
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
	Legs  []LegDTO
}

// SpotDTO は Spot エンティティの読み取り専用表現。
type SpotDTO struct {
	ID            string
	Name          string
	Description   string
	StartAt       time.Time
	EstimatedCost MoneyDTO
}

type LegDTO struct {
	ID              string
	From            EndpointDTO
	To              EndpointDTO
	Mode            string
	DurationMinutes int
	EstimatedCost   MoneyDTO
}

// MoneyDTO は Money 値オブジェクトの読み取り専用表現。
type MoneyDTO struct {
	Amount   int
	Currency string
}

type EndpointDTO struct {
	SpotID string // スポット参照時はスポット ID、旅程外地点では空文字
	Label  string // 表示名。スポット参照時はユースケースがスポット名を解決して設定
}
