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
	Legs  []GeneratedLeg
}

type GeneratedSpot struct {
	Name          string
	Description   string
	StartAt       time.Time
	EstimatedCost value_object.Money
}

// GeneratedLeg は LLM が出力した1区間の移動情報。
// legs[i] は「spots[i] に到着する移動」を表す位置ベースの対応関係（設計書 09 §7.1）。
type GeneratedLeg struct {
	// FromLabel は区間の起点名。各日の先頭区間（legs[0]）でのみ必須。
	// 2本目以降は無視され、起点は直前スポットに自動的に定まる。
	FromLabel string
	Mode      value_object.TransportMode
	Duration  time.Duration
	Cost      value_object.Money
}
