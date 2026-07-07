package value_object

import (
	"fmt"
	"time"
)

// Period は旅程の期間を表す値オブジェクト。
// 開始日と終了日を保持し、期間の妥当性や日数を計算できる。
type Period struct {
	startDate time.Time
	endDate   time.Time
}

// NewPeriod は開始日と終了日から Period を生成する。
// 終了日は開始日以上である必要がある。
func NewPeriod(startDate, endDate time.Time) (Period, error) {
	start := normalizeDate(startDate)
	end := normalizeDate(endDate)

	if end.Before(start) {
		return Period{}, fmt.Errorf(
			"endDate %s must be on or after startDate %s",
			end.Format(time.DateOnly),
			start.Format(time.DateOnly),
		)
	}

	return Period{
		startDate: start,
		endDate:   end,
	}, nil
}

// normalizeDate は時刻部分を切り捨て、カレンダー日のみに正規化する。
func normalizeDate(t time.Time) time.Time {
	return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, t.Location())
}

// StartDate は開始日を返す。
func (p Period) StartDate() time.Time {
	return p.startDate
}

// EndDate は終了日を返す。
func (p Period) EndDate() time.Time {
	return p.endDate
}

// Days は滞在日数を返す（例: 1泊2日なら 2）。
func (p Period) Days() int {
	return int(p.endDate.Sub(p.startDate).Hours()/24) + 1
}

// Nights は宿泊数を返す（例: 1泊2日なら 1）。
func (p Period) Nights() int {
	return p.Days() - 1
}

// Equals は他の Period と等価かを判定する。
func (p Period) Equals(other Period) bool {
	return p.startDate.Equal(other.startDate) && p.endDate.Equal(other.endDate)
}
