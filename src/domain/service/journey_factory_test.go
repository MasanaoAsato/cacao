package service

import (
	"testing"
	"time"

	"cacao/src/domain/value_object"
)

func mustNewMoney(t *testing.T, amount int, code string) value_object.Money {
	t.Helper()
	currency, _ := value_object.NewCurrency(code)
	money, _ := value_object.NewMoney(amount, currency)
	return money
}

func defaultPeriod(t *testing.T) value_object.Period {
	t.Helper()
	p, _ := value_object.NewPeriod(
		time.Date(2026, 7, 7, 0, 0, 0, 0, time.UTC),
		time.Date(2026, 7, 9, 0, 0, 0, 0, time.UTC),
	)
	return p
}

func TestNewJourneyFromGenerated(t *testing.T) {
	id := value_object.NewID()
	requestID := value_object.NewID()
	period := defaultPeriod(t)

	t.Run("正常系: GeneratedRoute から Journey が組み立てられる", func(t *testing.T) {
		route := GeneratedRoute{
			Days: []GeneratedDay{
				{
					Date: time.Date(2026, 7, 8, 0, 0, 0, 0, time.UTC),
					Spots: []GeneratedSpot{
						{
							Name:          "後から",
							Description:   "並べ替え確認",
							StartAt:       time.Date(2026, 7, 8, 14, 0, 0, 0, time.UTC),
							EstimatedCost: mustNewMoney(t, 1500, "JPY"),
						},
					},
				},
				{
					Date: time.Date(2026, 7, 7, 0, 0, 0, 0, time.UTC),
					Spots: []GeneratedSpot{
						{
							Name:          "先頭",
							Description:   "並べ替え確認",
							StartAt:       time.Date(2026, 7, 7, 10, 0, 0, 0, time.UTC),
							EstimatedCost: mustNewMoney(t, 1000, "JPY"),
						},
					},
				},
			},
		}

		journey, err := NewJourneyFromGenerated(id, requestID, period, route)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if !journey.ID().Equals(id) {
			t.Fatal("ID mismatch")
		}
		if !journey.RequestID().Equals(requestID) {
			t.Fatal("RequestID mismatch")
		}
		if journey.DayCount() != 2 {
			t.Fatalf("DayCount() = %d, want 2", journey.DayCount())
		}

		// 日付順に並んでいることを確認
		days := journey.Days()
		if !days[0].Date().Equal(time.Date(2026, 7, 7, 0, 0, 0, 0, time.UTC)) {
			t.Fatalf("first day = %v, want 2026-07-07", days[0].Date())
		}
		if !days[1].Date().Equal(time.Date(2026, 7, 8, 0, 0, 0, 0, time.UTC)) {
			t.Fatalf("second day = %v, want 2026-07-08", days[1].Date())
		}
	})

	t.Run("異常系: 空のルート", func(t *testing.T) {
		route := GeneratedRoute{Days: []GeneratedDay{}}
		if _, err := NewJourneyFromGenerated(id, requestID, period, route); err == nil {
			t.Fatal("expected error for empty route, got nil")
		}
	})

	t.Run("異常系: Period 外の日付", func(t *testing.T) {
		route := GeneratedRoute{
			Days: []GeneratedDay{
				{
					Date: time.Date(2026, 7, 10, 0, 0, 0, 0, time.UTC),
					Spots: []GeneratedSpot{
						{
							Name:          "範囲外",
							Description:   "エラー",
							StartAt:       time.Date(2026, 7, 10, 10, 0, 0, 0, time.UTC),
							EstimatedCost: mustNewMoney(t, 1000, "JPY"),
						},
					},
				},
			},
		}
		if _, err := NewJourneyFromGenerated(id, requestID, period, route); err == nil {
			t.Fatal("expected error for out-of-period date, got nil")
		}
	})

	t.Run("異常系: Spot の名前が空", func(t *testing.T) {
		route := GeneratedRoute{
			Days: []GeneratedDay{
				{
					Date: time.Date(2026, 7, 7, 0, 0, 0, 0, time.UTC),
					Spots: []GeneratedSpot{
						{
							Name:          "",
							Description:   "無効",
							StartAt:       time.Date(2026, 7, 7, 10, 0, 0, 0, time.UTC),
							EstimatedCost: mustNewMoney(t, 1000, "JPY"),
						},
					},
				},
			},
		}
		if _, err := NewJourneyFromGenerated(id, requestID, period, route); err == nil {
			t.Fatal("expected error for empty spot name, got nil")
		}
	})

	t.Run("境界値: 期間最初と最後の日が含まれる", func(t *testing.T) {
		route := GeneratedRoute{
			Days: []GeneratedDay{
				{
					Date: time.Date(2026, 7, 7, 0, 0, 0, 0, time.UTC),
					Spots: []GeneratedSpot{
						{
							Name:          "開始日",
							Description:   "最初",
							StartAt:       time.Date(2026, 7, 7, 10, 0, 0, 0, time.UTC),
							EstimatedCost: mustNewMoney(t, 0, "JPY"),
						},
					},
				},
				{
					Date: time.Date(2026, 7, 9, 0, 0, 0, 0, time.UTC),
					Spots: []GeneratedSpot{
						{
							Name:          "最終日",
							Description:   "最後",
							StartAt:       time.Date(2026, 7, 9, 10, 0, 0, 0, time.UTC),
							EstimatedCost: mustNewMoney(t, 0, "JPY"),
						},
					},
				},
			},
		}

		journey, err := NewJourneyFromGenerated(id, requestID, period, route)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if journey.DayCount() != 2 {
			t.Fatalf("DayCount() = %d, want 2", journey.DayCount())
		}
	})
}
