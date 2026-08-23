package requestjourneyimages

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
	Images           []JourneyImageDTO
}

// JourneyImageDTO は画像集約の読み取り専用表現である。
type JourneyImageDTO struct {
	ID             string
	Slot           SlotDTO
	Status         string
	AttemptCount   int
	HasContent     bool
	MediaType      string
	Width          int
	Height         int
	HasFailureCode bool
	FailureCode    string
}

// SlotDTO は画像スロットの読み取り専用表現である。
type SlotDTO struct {
	Purpose string
	Ordinal int
}
