package getjourney

import "cacao/src/application/readmodel"

// Input は GetJourney ユースケースの入力データ。
type Input struct {
	JourneyID string
}

// Output は GetJourney ユースケースの出力データ。
type Output struct {
	Journey readmodel.JourneyDTO
}
