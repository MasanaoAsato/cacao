package service

import (
	"cacao/src/domain/value_object"
	"time"
)

// GeneratedRoute は旅程生成の結果を表す中間表現。
// ユースケースが entity.Journey へ詰め替える際の橋渡しとなる。
type GeneratedRoute struct {
	Days []GeneratedDay
}

type GeneratedDay struct {
	Date  time.Time
	Spots []GeneratedSpot
}

type GeneratedSpot struct {
	Name          string
	Description   string
	StartAt       time.Time
	EstimatedCost value_object.Money
}
