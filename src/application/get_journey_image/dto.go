package getjourneyimage

// Input は GetJourneyImage ユースケースの入力データである。
type Input struct {
	ImageID string
}

// Output は GetJourneyImage ユースケースの出力データである。
type Output struct {
	Image JourneyImageDTO
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
