package entity

import (
	"strings"
	"testing"
	"time"

	"cacao/src/domain/value_object"
)

func mustNewSpot(t *testing.T, name string, amount int, code string) Spot {
	t.Helper()
	id := value_object.NewID()
	cost := mustNewMoney(t, amount, code)
	spot, err := NewSpot(id, name, "description", time.Now(), cost)
	if err != nil {
		t.Fatalf("failed to create spot: %v", err)
	}
	return spot
}

func mustNewSpotAt(t *testing.T, name string, amount int, code string, startAt time.Time) Spot {
	t.Helper()
	id := value_object.NewID()
	cost := mustNewMoney(t, amount, code)
	spot, err := NewSpot(id, name, "description", startAt, cost)
	if err != nil {
		t.Fatalf("failed to create spot: %v", err)
	}
	return spot
}

func TestNewItineraryDay(t *testing.T) {
	t.Run("正常系: 有効な1日", func(t *testing.T) {
		id := value_object.NewID()
		date := time.Date(2026, 7, 7, 10, 30, 0, 0, time.UTC)
		spot := mustNewSpot(t, "東京タワー", 1000, "JPY")

		day, err := NewItineraryDay(id, date, []Spot{spot})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if !day.ID().Equals(id) {
			t.Fatal("ID mismatch")
		}

		wantDate := time.Date(2026, 7, 7, 0, 0, 0, 0, time.UTC)
		if !day.Date().Equal(wantDate) {
			t.Fatalf("Date() = %v, want %v", day.Date(), wantDate)
		}

		if len(day.Spots()) != 1 {
			t.Fatalf("Spots() length = %d, want 1", len(day.Spots()))
		}
	})
}

func TestItineraryDay_TotalCost(t *testing.T) {
	t.Run("正常系: 空の場合は0円", func(t *testing.T) {
		id := value_object.NewID()
		day, _ := NewItineraryDay(id, time.Date(2026, 7, 7, 0, 0, 0, 0, time.UTC), nil)

		total, err := day.TotalCost()
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if total.Amount() != 0 {
			t.Fatalf("Amount() = %d, want 0", total.Amount())
		}
	})

	t.Run("正常系: 同一通貨の合計", func(t *testing.T) {
		id := value_object.NewID()
		spot1 := mustNewSpot(t, "タワー", 1000, "JPY")
		spot2 := mustNewSpot(t, "博物館", 1500, "JPY")

		day, _ := NewItineraryDay(id, time.Date(2026, 7, 7, 0, 0, 0, 0, time.UTC), []Spot{spot1, spot2})
		total, err := day.TotalCost()
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if total.Amount() != 2500 {
			t.Fatalf("Amount() = %d, want 2500", total.Amount())
		}
	})

	t.Run("異常系: 通貨混在", func(t *testing.T) {
		id := value_object.NewID()
		spot1 := mustNewSpot(t, "タワー", 1000, "JPY")
		spot2 := mustNewSpot(t, "美術館", 10, "USD")

		day, _ := NewItineraryDay(id, time.Date(2026, 7, 7, 0, 0, 0, 0, time.UTC), []Spot{spot1, spot2})
		_, err := day.TotalCost()
		if err == nil {
			t.Fatal("expected error for mixed currencies, got nil")
		}
		if !strings.Contains(err.Error(), "mixed currencies") {
			t.Fatalf("expected mixed currencies error, got %v", err)
		}
	})

	t.Run("正常系: spots は startAt の昇順に整列される", func(t *testing.T) {
		id := value_object.NewID()
		spot1 := mustNewSpotAt(t, "朝", 1000, "JPY", time.Date(2026, 7, 7, 14, 0, 0, 0, time.UTC))
		spot2 := mustNewSpotAt(t, "昼", 1000, "JPY", time.Date(2026, 7, 7, 10, 0, 0, 0, time.UTC))
		spot3 := mustNewSpotAt(t, "夜", 1000, "JPY", time.Date(2026, 7, 7, 18, 0, 0, 0, time.UTC))

		day, _ := NewItineraryDay(id, time.Date(2026, 7, 7, 0, 0, 0, 0, time.UTC), []Spot{spot1, spot2, spot3})
		spots := day.Spots()

		if !spots[0].StartAt().Equal(time.Date(2026, 7, 7, 10, 0, 0, 0, time.UTC)) {
			t.Fatalf("first spot startAt = %v, want 10:00", spots[0].StartAt())
		}
		if !spots[1].StartAt().Equal(time.Date(2026, 7, 7, 14, 0, 0, 0, time.UTC)) {
			t.Fatalf("second spot startAt = %v, want 14:00", spots[1].StartAt())
		}
		if !spots[2].StartAt().Equal(time.Date(2026, 7, 7, 18, 0, 0, 0, time.UTC)) {
			t.Fatalf("third spot startAt = %v, want 18:00", spots[2].StartAt())
		}
	})

	t.Run("異常系: 空の ID", func(t *testing.T) {
		_, err := NewItineraryDay(value_object.ID{}, time.Date(2026, 7, 7, 0, 0, 0, 0, time.UTC), nil)
		if err == nil {
			t.Fatal("expected error for empty id, got nil")
		}
		if !strings.Contains(err.Error(), "id") {
			t.Fatalf("expected id-related error, got %v", err)
		}
	})
}

func TestItineraryDay_Spots_Immutability(t *testing.T) {
	id := value_object.NewID()
	spot := mustNewSpot(t, "東京タワー", 1000, "JPY")
	day, _ := NewItineraryDay(id, time.Date(2026, 7, 7, 0, 0, 0, 0, time.UTC), []Spot{spot})

	spots := day.Spots()
	spots[0] = mustNewSpot(t, "上書き", 9999, "JPY")

	if day.Spots()[0].Name() != "東京タワー" {
		t.Fatal("Spots() returned mutable internal slice")
	}
}
