package entity

import (
	"fmt"
	"sort"
	"time"

	"cacao/src/domain/value_object"
)

// ItineraryDay は旅程内の1日分を表す集約内エンティティ。
type ItineraryDay struct {
	id    value_object.ID
	date  time.Time
	spots []Spot
}

// NewItineraryDay は ItineraryDay を生成する。
// 時刻部分は正規化され、日付のみを保持する。
// spots は startAt の昇順に整列される。
func NewItineraryDay(id value_object.ID, date time.Time, spots []Spot) (ItineraryDay, error) {
	if id.IsEmpty() {
		return ItineraryDay{}, fmt.Errorf("itinerary day id must not be empty")
	}

	normalized := normalizeDate(date)
	copied := make([]Spot, len(spots))
	copy(copied, spots)
	sort.Slice(copied, func(i, j int) bool {
		return copied[i].StartAt().Before(copied[j].StartAt())
	})

	return ItineraryDay{
		id:    id,
		date:  normalized,
		spots: copied,
	}, nil
}

func normalizeDate(t time.Time) time.Time {
	return value_object.NormalizeDate(t)
}

// ID は1日の識別子を返す。
func (d ItineraryDay) ID() value_object.ID {
	return d.id
}

// Date は日付を返す。時刻部分は常に 00:00:00 となる。
func (d ItineraryDay) Date() time.Time {
	return d.date
}

// Spots は訪問先の一覧を返す。返されるスライスはコピーなので、
// 呼び出し側が変更しても内部状態に影響しない。
func (d ItineraryDay) Spots() []Spot {
	copied := make([]Spot, len(d.spots))
	copy(copied, d.spots)
	return copied
}

// TotalCost はその日の spots の想定費用の合計を返す。
// 通貨が混在している場合はエラーを返す。
func (d ItineraryDay) TotalCost() (value_object.Money, error) {
	if len(d.spots) == 0 {
		currency, _ := value_object.NewCurrency("JPY")
		return value_object.NewMoney(0, currency)
	}

	base := d.spots[0].EstimatedCost()
	total := base.Amount()
	for _, spot := range d.spots[1:] {
		cost := spot.EstimatedCost()
		if !cost.Currency().Equals(base.Currency()) {
			return value_object.Money{}, fmt.Errorf("mixed currencies are not supported: %s and %s", base.Currency().Code(), cost.Currency().Code())
		}
		total += cost.Amount()
	}

	return value_object.NewMoney(total, base.Currency())
}

// Equals は他の ItineraryDay と同一エンティティかを判定する。
func (d ItineraryDay) Equals(other ItineraryDay) bool {
	return d.id.Equals(other.id)
}
