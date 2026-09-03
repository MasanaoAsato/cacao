package listjourneys

import "cacao/src/application/readmodel"

// Input は ListJourneys ユースケースの入力データ。
type Input struct{}

// Output は ListJourneys ユースケースの出力データ。
type Output struct {
	Journeys []readmodel.JourneyDTO
}
