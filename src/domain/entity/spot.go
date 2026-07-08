package entity

import (
	"fmt"
	"time"

	"cacao/src/domain/value_object"
)

// Spot は1日の旅程に含まれる訪問先やアクティビティを表す集約内エンティティ。
type Spot struct {
	id            value_object.ID
	name          string
	description   string
	startAt       time.Time
	estimatedCost value_object.Money
}

// NewSpot は Spot を生成する。
// name は空文字不可。startAt は訪問開始時刻。estimatedCost は有効な Money 値オブジェクト。
func NewSpot(id value_object.ID, name, description string, startAt time.Time, estimatedCost value_object.Money) (Spot, error) {
	if id.IsEmpty() {
		return Spot{}, fmt.Errorf("spot id must not be empty")
	}
	if name == "" {
		return Spot{}, fmt.Errorf("spot name must not be empty")
	}

	return Spot{
		id:            id,
		name:          name,
		description:   description,
		startAt:       startAt,
		estimatedCost: estimatedCost,
	}, nil
}

// ID は Spot の識別子を返す。
func (s Spot) ID() value_object.ID {
	return s.id
}

// Name は訪問先名を返す。
func (s Spot) Name() string {
	return s.name
}

// Description は訪問先の説明を返す。
func (s Spot) Description() string {
	return s.description
}

// StartAt は訪問開始時刻を返す。
func (s Spot) StartAt() time.Time {
	return s.startAt
}

// EstimatedCost は想定費用を返す。
func (s Spot) EstimatedCost() value_object.Money {
	return s.estimatedCost
}

// Equals は他の Spot と同一エンティティかを判定する。
// エンティティの同一性は ID で判定する。
func (s Spot) Equals(other Spot) bool {
	return s.id.Equals(other.id)
}
