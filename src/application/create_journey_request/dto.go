package createjourneyrequest

import "time"

// Input は CreateJourneyRequest ユースケースの入力データ。
type Input struct {
	DepartureCity    string
	DepartureCountry string
	StartDate        time.Time
	EndDate          time.Time
	Amount           int
	Currency         string
}

// Output は CreateJourneyRequest ユースケースの出力データ。
type Output struct {
	RequestID string
}
