package requestjourneyimages

import "cacao/src/application/readmodel"

// Input は RequestJourneyImages ユースケースの入力データである。
type Input struct {
	RequestID string
	Slots     []SlotInput
}

// SlotInput は要求する画像スロットを表す。
type SlotInput struct {
	Purpose string
	Ordinal int
}

// Output は RequestJourneyImages ユースケースの出力データである。
type Output struct {
	JourneyRequestID string
	Images           []readmodel.JourneyImageDTO
}
