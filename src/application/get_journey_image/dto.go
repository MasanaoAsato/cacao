package getjourneyimage

import "cacao/src/application/readmodel"

// Input は GetJourneyImage ユースケースの入力データである。
type Input struct {
	ImageID string
}

// Output は GetJourneyImage ユースケースの出力データである。
type Output struct {
	Image readmodel.JourneyImageDTO
}
