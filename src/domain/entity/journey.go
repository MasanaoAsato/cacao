package entity

import (
	"fmt"
	"slices"
	"time"

	"cacao/src/domain/value_object"
)

// Journey はLLMが生成した旅程全体を表す集約ルートエンティティ。
type Journey struct {
	id        value_object.ID
	requestID value_object.ID
	days      []ItineraryDay
}

// NewJourney は Journey を生成する。
// days は日付順に整列され、重複しないこと、かつ period の範囲内に収まることが求められる。
func NewJourney(id, requestID value_object.ID, period value_object.Period, days []ItineraryDay) (Journey, error) {
	if id.IsEmpty() {
		return Journey{}, fmt.Errorf("journey id must not be empty")
	}
	if requestID.IsEmpty() {
		return Journey{}, fmt.Errorf("request id must not be empty")
	}
	if len(days) == 0 {
		return Journey{}, fmt.Errorf("journey must have at least one day")
	}

	sorted := make([]ItineraryDay, len(days))
	copy(sorted, days)
	slices.SortFunc(sorted, func(a, b ItineraryDay) int {
		return a.Date().Compare(b.Date())
	})

	seen := make(map[time.Time]struct{}, len(sorted))
	for _, day := range sorted {
		if _, ok := seen[day.Date()]; ok {
			return Journey{}, fmt.Errorf("duplicate date: %s", day.Date().Format(time.DateOnly))
		}
		if day.Date().Before(period.StartDate()) || day.Date().After(period.EndDate()) {
			return Journey{}, fmt.Errorf("day %s is out of request period %s to %s",
				day.Date().Format(time.DateOnly),
				period.StartDate().Format(time.DateOnly),
				period.EndDate().Format(time.DateOnly),
			)
		}
		seen[day.Date()] = struct{}{}
	}

	return Journey{
		id:        id,
		requestID: requestID,
		days:      sorted,
	}, nil
}

// ID は旅程の識別子を返す。
func (j Journey) ID() value_object.ID {
	return j.id
}

// RequestID は元となった JourneyRequest の識別子を返す。
func (j Journey) RequestID() value_object.ID {
	return j.requestID
}

// Days は日程の一覧を返す。返されるスライスはコピーなので、
// 呼び出し側が変更しても内部状態に影響しない。
func (j Journey) Days() []ItineraryDay {
	copied := make([]ItineraryDay, len(j.days))
	copy(copied, j.days)
	return copied
}

// DayCount は旅程に含まれる日数を返す。
func (j Journey) DayCount() int {
	return len(j.days)
}

// TotalCost は旅程全体の想定費用の合計を返す。
// 日をまたいで通貨が混在している場合はエラーを返す。
func (j Journey) TotalCost() (value_object.Money, error) {
	if len(j.days) == 0 {
		currency, _ := value_object.NewCurrency("JPY")
		return value_object.NewMoney(0, currency)
	}

	first, err := j.days[0].TotalCost()
	if err != nil {
		return value_object.Money{}, fmt.Errorf("day %s: %w", j.days[0].Date().Format(time.DateOnly), err)
	}

	total := first.Amount()
	for _, day := range j.days[1:] {
		cost, err := day.TotalCost()
		if err != nil {
			return value_object.Money{}, fmt.Errorf("day %s: %w", day.Date().Format(time.DateOnly), err)
		}
		if !cost.Currency().Equals(first.Currency()) {
			return value_object.Money{}, fmt.Errorf("mixed currencies are not supported: %s and %s", first.Currency().Code(), cost.Currency().Code())
		}
		total += cost.Amount()
	}

	return value_object.NewMoney(total, first.Currency())
}

// Equals は他の Journey と同一エンティティかを判定する。
func (j Journey) Equals(other Journey) bool {
	return j.id.Equals(other.id)
}
