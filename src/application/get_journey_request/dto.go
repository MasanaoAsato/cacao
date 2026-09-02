package getjourneyrequest

import "cacao/src/application/readmodel"

// Input は GetJourneyRequest ユースケースの入力データ。
type Input struct {
	RequestID string
}

// Output は GetJourneyRequest ユースケースの出力データ。
type Output struct {
	Request readmodel.JourneyRequestDTO
}
