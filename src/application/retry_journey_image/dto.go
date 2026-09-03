package retryjourneyimage

import "cacao/src/application/readmodel"

// Input は RetryJourneyImage ユースケースの入力データである。
type Input struct {
	ImageID string
}

// Output は RetryJourneyImage ユースケースの出力データである。
type Output struct {
	Image readmodel.JourneyImageDTO
}
