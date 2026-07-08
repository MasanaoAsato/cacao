package entity

import (
	"strings"
	"testing"
	"time"

	"cacao/src/domain/value_object"
)

func mustNewDeparture(t *testing.T, city, country string) value_object.Departure {
	t.Helper()
	d, err := value_object.NewDeparture(city, country)
	if err != nil {
		t.Fatalf("failed to create departure: %v", err)
	}
	return d
}

func mustNewPeriod(t *testing.T, start, end time.Time) value_object.Period {
	t.Helper()
	p, err := value_object.NewPeriod(start, end)
	if err != nil {
		t.Fatalf("failed to create period: %v", err)
	}
	return p
}

func TestNewJourneyRequest(t *testing.T) {
	t.Run("正常系: 有効な JourneyRequest", func(t *testing.T) {
		id := value_object.NewID()
		departure := mustNewDeparture(t, "東京", "日本")
		period := mustNewPeriod(t, time.Date(2026, 7, 7, 0, 0, 0, 0, time.UTC), time.Date(2026, 7, 9, 0, 0, 0, 0, time.UTC))
		budget := mustNewMoney(t, 50000, "JPY")

		req, err := NewJourneyRequest(id, departure, period, budget)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if !req.ID().Equals(id) {
			t.Fatal("ID mismatch")
		}
		if !req.Departure().Equals(departure) {
			t.Fatal("Departure mismatch")
		}
		if !req.Period().Equals(period) {
			t.Fatal("Period mismatch")
		}
		if !req.Budget().Equals(budget) {
			t.Fatal("Budget mismatch")
		}
	})

	t.Run("異常系: 空の ID", func(t *testing.T) {
		departure := mustNewDeparture(t, "東京", "日本")
		period := mustNewPeriod(t, time.Date(2026, 7, 7, 0, 0, 0, 0, time.UTC), time.Date(2026, 7, 9, 0, 0, 0, 0, time.UTC))
		budget := mustNewMoney(t, 50000, "JPY")

		_, err := NewJourneyRequest(value_object.ID{}, departure, period, budget)
		if err == nil {
			t.Fatal("expected error for empty id, got nil")
		}
		if !strings.Contains(err.Error(), "id") {
			t.Fatalf("expected id-related error, got %v", err)
		}
	})
}

func TestJourneyRequest_Equals(t *testing.T) {
	idA := value_object.NewID()
	idB := value_object.NewID()
	departure := mustNewDeparture(t, "東京", "日本")
	period := mustNewPeriod(t, time.Date(2026, 7, 7, 0, 0, 0, 0, time.UTC), time.Date(2026, 7, 9, 0, 0, 0, 0, time.UTC))
	budget := mustNewMoney(t, 50000, "JPY")

	t.Run("正常系: 同じ ID は同一", func(t *testing.T) {
		req1, _ := NewJourneyRequest(idA, departure, period, budget)
		req2, _ := NewJourneyRequest(idA, mustNewDeparture(t, "大阪", "日本"), mustNewPeriod(t, time.Date(2026, 8, 1, 0, 0, 0, 0, time.UTC), time.Date(2026, 8, 3, 0, 0, 0, 0, time.UTC)), mustNewMoney(t, 100000, "JPY"))

		if !req1.Equals(req2) {
			t.Fatal("expected requests with same id to be equal")
		}
	})

	t.Run("正常系: 異なる ID は別物", func(t *testing.T) {
		req1, _ := NewJourneyRequest(idA, departure, period, budget)
		req2, _ := NewJourneyRequest(idB, departure, period, budget)

		if req1.Equals(req2) {
			t.Fatal("expected requests with different ids to be not equal")
		}
	})
}
