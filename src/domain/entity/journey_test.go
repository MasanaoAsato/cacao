package entity

import (
	"strings"
	"testing"
	"time"

	"cacao/src/domain/value_object"
)

func mustNewItineraryDay(t *testing.T, date time.Time, spots []Spot) ItineraryDay {
	t.Helper()
	id := value_object.NewID()
	day, err := NewItineraryDay(id, date, spots)
	if err != nil {
		t.Fatalf("failed to create itinerary day: %v", err)
	}
	return day
}

func defaultPeriod(t *testing.T) value_object.Period {
	t.Helper()
	return mustNewPeriod(t, time.Date(2026, 7, 7, 0, 0, 0, 0, time.UTC), time.Date(2026, 7, 9, 0, 0, 0, 0, time.UTC))
}

func TestNewJourney(t *testing.T) {
	t.Run("正常系: 有効な Journey", func(t *testing.T) {
		id := value_object.NewID()
		requestID := value_object.NewID()
		day1 := mustNewItineraryDay(t, time.Date(2026, 7, 7, 0, 0, 0, 0, time.UTC), []Spot{mustNewSpot(t, "タワー", 1000, "JPY")})
		day2 := mustNewItineraryDay(t, time.Date(2026, 7, 8, 0, 0, 0, 0, time.UTC), []Spot{mustNewSpot(t, "博物館", 1500, "JPY")})

		period := defaultPeriod(t)
		journey, err := NewJourney(id, requestID, period, []ItineraryDay{day2, day1})
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

		// 日付順に整列されていることを確認
		days := journey.Days()
		if !days[0].Date().Equal(time.Date(2026, 7, 7, 0, 0, 0, 0, time.UTC)) {
			t.Fatalf("first day = %v, want 2026-07-07", days[0].Date())
		}
		if !days[1].Date().Equal(time.Date(2026, 7, 8, 0, 0, 0, 0, time.UTC)) {
			t.Fatalf("second day = %v, want 2026-07-08", days[1].Date())
		}
	})

	t.Run("異常系: 空の journey id", func(t *testing.T) {
		requestID := value_object.NewID()
		day := mustNewItineraryDay(t, time.Date(2026, 7, 7, 0, 0, 0, 0, time.UTC), []Spot{mustNewSpot(t, "タワー", 1000, "JPY")})

		_, err := NewJourney(value_object.ID{}, requestID, defaultPeriod(t), []ItineraryDay{day})
		if err == nil {
			t.Fatal("expected error for empty journey id, got nil")
		}
		if !strings.Contains(err.Error(), "journey id") {
			t.Fatalf("expected journey id error, got %v", err)
		}
	})

	t.Run("異常系: 空の request id", func(t *testing.T) {
		id := value_object.NewID()
		day := mustNewItineraryDay(t, time.Date(2026, 7, 7, 0, 0, 0, 0, time.UTC), []Spot{mustNewSpot(t, "タワー", 1000, "JPY")})

		_, err := NewJourney(id, value_object.ID{}, defaultPeriod(t), []ItineraryDay{day})
		if err == nil {
			t.Fatal("expected error for empty request id, got nil")
		}
		if !strings.Contains(err.Error(), "request id") {
			t.Fatalf("expected request id error, got %v", err)
		}
	})

	t.Run("異常系: 空の days", func(t *testing.T) {
		id := value_object.NewID()
		requestID := value_object.NewID()

		if _, err := NewJourney(id, requestID, defaultPeriod(t), nil); err == nil {
			t.Fatal("expected error for empty days, got nil")
		}
	})

	t.Run("異常系: 重複する日付", func(t *testing.T) {
		id := value_object.NewID()
		requestID := value_object.NewID()
		day1 := mustNewItineraryDay(t, time.Date(2026, 7, 7, 0, 0, 0, 0, time.UTC), []Spot{mustNewSpot(t, "タワー", 1000, "JPY")})
		day2 := mustNewItineraryDay(t, time.Date(2026, 7, 7, 10, 30, 0, 0, time.UTC), []Spot{mustNewSpot(t, "博物館", 1500, "JPY")})

		_, err := NewJourney(id, requestID, defaultPeriod(t), []ItineraryDay{day1, day2})
		if err == nil {
			t.Fatal("expected error for duplicate dates, got nil")
		}
		if !strings.Contains(err.Error(), "duplicate") {
			t.Fatalf("expected duplicate date error, got %v", err)
		}
	})

	t.Run("異常系: period 外の日付", func(t *testing.T) {
		id := value_object.NewID()
		requestID := value_object.NewID()
		period := mustNewPeriod(t, time.Date(2026, 7, 7, 0, 0, 0, 0, time.UTC), time.Date(2026, 7, 7, 0, 0, 0, 0, time.UTC))
		day := mustNewItineraryDay(t, time.Date(2026, 7, 8, 0, 0, 0, 0, time.UTC), []Spot{mustNewSpot(t, "タワー", 1000, "JPY")})

		_, err := NewJourney(id, requestID, period, []ItineraryDay{day})
		if err == nil {
			t.Fatal("expected error for out-of-period date, got nil")
		}
		if !strings.Contains(err.Error(), "out of request period") {
			t.Fatalf("expected out of period error, got %v", err)
		}
	})
}

func TestJourney_TotalCost(t *testing.T) {
	t.Run("正常系: 旅程全体の合計", func(t *testing.T) {
		id := value_object.NewID()
		requestID := value_object.NewID()
		day1 := mustNewItineraryDay(t, time.Date(2026, 7, 7, 0, 0, 0, 0, time.UTC), []Spot{
			mustNewSpot(t, "タワー", 1000, "JPY"),
		})
		day2 := mustNewItineraryDay(t, time.Date(2026, 7, 8, 0, 0, 0, 0, time.UTC), []Spot{
			mustNewSpot(t, "博物館", 2000, "JPY"),
			mustNewSpot(t, "公園", 500, "JPY"),
		})

		journey, _ := NewJourney(id, requestID, defaultPeriod(t), []ItineraryDay{day1, day2})
		total, err := journey.TotalCost()
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if total.Amount() != 3500 {
			t.Fatalf("Amount() = %d, want 3500", total.Amount())
		}
	})

	t.Run("異常系: 日をまたいだ通貨混在", func(t *testing.T) {
		id := value_object.NewID()
		requestID := value_object.NewID()
		day1 := mustNewItineraryDay(t, time.Date(2026, 7, 7, 0, 0, 0, 0, time.UTC), []Spot{mustNewSpot(t, "タワー", 1000, "JPY")})
		day2 := mustNewItineraryDay(t, time.Date(2026, 7, 8, 0, 0, 0, 0, time.UTC), []Spot{mustNewSpot(t, "美術館", 10, "USD")})

		journey, _ := NewJourney(id, requestID, defaultPeriod(t), []ItineraryDay{day1, day2})
		if _, err := journey.TotalCost(); err == nil {
			t.Fatal("expected error for mixed currencies across days, got nil")
		}
	})
}

func TestJourney_Days_Immutability(t *testing.T) {
	id := value_object.NewID()
	requestID := value_object.NewID()
	day := mustNewItineraryDay(t, time.Date(2026, 7, 7, 0, 0, 0, 0, time.UTC), []Spot{mustNewSpot(t, "タワー", 1000, "JPY")})

	journey, _ := NewJourney(id, requestID, defaultPeriod(t), []ItineraryDay{day})
	days := journey.Days()
	days[0] = mustNewItineraryDay(t, time.Date(2099, 1, 1, 0, 0, 0, 0, time.UTC), nil)

	if !journey.Days()[0].Date().Equal(time.Date(2026, 7, 7, 0, 0, 0, 0, time.UTC)) {
		t.Fatal("Days() returned mutable internal slice")
	}
}

func TestJourney_Equals(t *testing.T) {
	idA := value_object.NewID()
	idB := value_object.NewID()
	requestID := value_object.NewID()
	day := mustNewItineraryDay(t, time.Date(2026, 7, 7, 0, 0, 0, 0, time.UTC), []Spot{mustNewSpot(t, "タワー", 1000, "JPY")})

	t.Run("正常系: 同じ ID は同一", func(t *testing.T) {
		j1, _ := NewJourney(idA, requestID, defaultPeriod(t), []ItineraryDay{day})
		j2, _ := NewJourney(idA, value_object.NewID(), defaultPeriod(t), []ItineraryDay{mustNewItineraryDay(t, time.Date(2026, 7, 7, 0, 0, 0, 0, time.UTC), nil)})

		if !j1.Equals(j2) {
			t.Fatal("expected journeys with same id to be equal")
		}
	})

	t.Run("正常系: 異なる ID は別物", func(t *testing.T) {
		j1, _ := NewJourney(idA, requestID, defaultPeriod(t), []ItineraryDay{day})
		j2, _ := NewJourney(idB, requestID, defaultPeriod(t), []ItineraryDay{day})

		if j1.Equals(j2) {
			t.Fatal("expected journeys with different ids to be not equal")
		}
	})
}
