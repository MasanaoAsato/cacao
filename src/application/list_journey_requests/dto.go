package listjourneyrequests

import "cacao/src/application/readmodel"

// Input は ListJourneyRequests ユースケースの入力データ。
type Input struct{}

// Output は ListJourneyRequests ユースケースの出力データ。
type Output struct {
	Requests []readmodel.JourneyRequestDTO
}
