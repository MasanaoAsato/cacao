package listjourneyimages

import "cacao/src/application/readmodel"

// Input は ListJourneyImages ユースケースの入力データである。
type Input struct {
	RequestID string
}

// Output は ListJourneyImages ユースケースの出力データである。
type Output struct {
	JourneyRequestID string
	Images           []readmodel.JourneyImageDTO
}
