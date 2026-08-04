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
	leg   []Leg
}

// NewItineraryDay は ItineraryDay を生成する。
// 時刻部分は正規化され、日付のみを保持する。
// spots は startAt の昇順に整列される。
//
// 不変条件（設計書 09 §6.2）:
//   - spots は1つ以上必須（空日程は不可）
//   - len(legs) == len(spots)（各スポットに「到着区間」がちょうど1本）
//   - legs[i].To() はソート後の spots[i] を指すスポット Endpoint であること
//   - legs[0].From() は名前付き Endpoint（IsSpot() == false）であること
//   - legs[i>0].From() は spots[i-1] を指すスポット Endpoint であること
//
// legs は再ソートしない。呼び出し元が spots とペアで整列済みのものを渡す契約（設計判断 §6.2）。
func NewItineraryDay(id value_object.ID, date time.Time, spots []Spot, leg []Leg) (ItineraryDay, error) {
	if id.IsEmpty() {
		return ItineraryDay{}, fmt.Errorf("itinerary day id must not be empty")
	}
	if len(spots) == 0 {
		return ItineraryDay{}, fmt.Errorf("itinerary day must have at least one spot")
	}
	if len(spots) != len(leg) {
		return ItineraryDay{}, fmt.Errorf("the number of spots and legs must match: got %d spots and %d legs", len(spots), len(leg))
	}

	normalized := normalizeDate(date)

	sortedSpots := make([]Spot, len(spots))
	copy(sortedSpots, spots)
	sort.Slice(sortedSpots, func(i, j int) bool {
		return sortedSpots[i].StartAt().Before(sortedSpots[j].StartAt())
	})

	for i, l := range leg {
		// ルール2: legs[i].To() はソート後の spots[i] を指すスポット Endpoint
		to := l.To()
		if !to.IsSpot() || !to.SpotID().Equals(sortedSpots[i].ID()) {
			return ItineraryDay{}, fmt.Errorf("leg %d: to must point to spot %q", i+1, sortedSpots[i].Name())
		}

		from := l.From()
		if i == 0 {
			// ルール3: legs[0].From() は名前付き Endpoint（旅程外地点）
			if from.IsSpot() {
				return ItineraryDay{}, fmt.Errorf("leg 1: from must be a named endpoint (origin or accommodation), got spot endpoint")
			}
		} else {
			// ルール4: legs[i>0].From() は spots[i-1] を指すスポット Endpoint
			if !from.IsSpot() || !from.SpotID().Equals(sortedSpots[i-1].ID()) {
				return ItineraryDay{}, fmt.Errorf("leg %d: from must point to previous spot %q", i+1, sortedSpots[i-1].Name())
			}
		}
	}

	return ItineraryDay{
		id:    id,
		date:  normalized,
		spots: sortedSpots,
		leg:   leg,
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
	sortedSpots := make([]Spot, len(d.spots))
	copy(sortedSpots, d.spots)
	return sortedSpots
}

func (d ItineraryDay) Legs() []Leg {
	copiedLegs := make([]Leg, len(d.leg))
	copy(copiedLegs, d.leg)
	return copiedLegs
}

func (d ItineraryDay) TotalTravelDuration() time.Duration {
	var total time.Duration
	for _, leg := range d.leg {
		total += leg.Duration()
	}
	return total
}

// TotalCost はその日のスポット費用と移動費用の合計を返す。
// 通貨が混在している場合はエラーを返す。
// spots も legs も空の場合は 0 JPY を返す。
func (d ItineraryDay) TotalCost() (value_object.Money, error) {
	if len(d.spots) == 0 && len(d.leg) == 0 {
		currency, err := value_object.NewCurrency("JPY")
		if err != nil {
			return value_object.Money{}, fmt.Errorf("create default currency: %w", err)
		}
		return value_object.NewMoney(0, currency)
	}

	// 基準通貨を決める。スポットが存在すれば最初のスポットの通貨、
	// そうでなければ最初の Leg の通貨を使う。
	var base value_object.Currency
	if len(d.spots) > 0 {
		base = d.spots[0].EstimatedCost().Currency()
	} else {
		base = d.leg[0].Cost().Currency()
	}

	total := 0
	for _, spot := range d.spots {
		cost := spot.EstimatedCost()
		if !cost.Currency().Equals(base) {
			return value_object.Money{}, fmt.Errorf(
				"mixed currencies are not supported: %s and %s",
				base.Code(),
				cost.Currency().Code(),
			)
		}
		total += cost.Amount()
	}

	for _, leg := range d.leg {
		cost := leg.Cost()
		if !cost.Currency().Equals(base) {
			return value_object.Money{}, fmt.Errorf(
				"mixed currencies are not supported: %s and %s",
				base.Code(),
				cost.Currency().Code(),
			)
		}
		total += cost.Amount()
	}

	return value_object.NewMoney(total, base)
}

// Equals は他の ItineraryDay と同一エンティティかを判定する。
func (d ItineraryDay) Equals(other ItineraryDay) bool {
	return d.id.Equals(other.id)
}
