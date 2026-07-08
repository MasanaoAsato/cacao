package entity

import (
	"fmt"

	"cacao/src/domain/value_object"
)

// JourneyRequest はユーザーが入力した旅程作成条件を表すエンティティ。
type JourneyRequest struct {
	id        value_object.ID
	departure value_object.Departure
	period    value_object.Period
	budget    value_object.Money
}

// NewJourneyRequest は JourneyRequest を生成する。
// id は空であってはならない。値オブジェクト側で妥当性検証済みなので、
// エンティティ側では id の空チェックのみ行う。
func NewJourneyRequest(id value_object.ID, departure value_object.Departure, period value_object.Period, budget value_object.Money) (JourneyRequest, error) {
	if id.IsEmpty() {
		return JourneyRequest{}, fmt.Errorf("journey request id must not be empty")
	}

	return JourneyRequest{
		id:        id,
		departure: departure,
		period:    period,
		budget:    budget,
	}, nil
}

// ID は旅程リクエストの識別子を返す。
func (r JourneyRequest) ID() value_object.ID {
	return r.id
}

// Departure は出発地点を返す。
func (r JourneyRequest) Departure() value_object.Departure {
	return r.departure
}

// Period は日程を返す。
func (r JourneyRequest) Period() value_object.Period {
	return r.period
}

// Budget は予算を返す。
func (r JourneyRequest) Budget() value_object.Money {
	return r.budget
}

// Equals は他の JourneyRequest と同一エンティティかを判定する。
func (r JourneyRequest) Equals(other JourneyRequest) bool {
	return r.id.Equals(other.id)
}
