package entity

import (
	"strings"
	"testing"
	"time"

	"cacao/src/domain/value_object"
)

func mustNewMoney(t *testing.T, amount int, code string) value_object.Money {
	t.Helper()
	currency, err := value_object.NewCurrency(code)
	if err != nil {
		t.Fatalf("failed to create currency: %v", err)
	}
	money, err := value_object.NewMoney(amount, currency)
	if err != nil {
		t.Fatalf("failed to create money: %v", err)
	}
	return money
}

func TestNewSpot(t *testing.T) {
	t.Run("正常系: 有効な Spot", func(t *testing.T) {
		id := value_object.NewID()
		cost := mustNewMoney(t, 1000, "JPY")
		startAt := time.Date(2026, 7, 7, 10, 0, 0, 0, time.UTC)

		spot, err := NewSpot(id, "東京タワー", "展望台に登る", startAt, cost)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if !spot.ID().Equals(id) {
			t.Fatalf("ID mismatch")
		}
		if spot.Name() != "東京タワー" {
			t.Fatalf("Name() = %q, want %q", spot.Name(), "東京タワー")
		}
		if spot.Description() != "展望台に登る" {
			t.Fatalf("Description() = %q, want %q", spot.Description(), "展望台に登る")
		}
		if !spot.StartAt().Equal(startAt) {
			t.Fatalf("StartAt() = %v, want %v", spot.StartAt(), startAt)
		}
		if !spot.EstimatedCost().Equals(cost) {
			t.Fatalf("EstimatedCost() mismatch")
		}
	})

	t.Run("異常系: 空の ID", func(t *testing.T) {
		cost := mustNewMoney(t, 1000, "JPY")

		_, err := NewSpot(value_object.ID{}, "東京タワー", "展望台", time.Now(), cost)
		if err == nil {
			t.Fatal("expected error for empty id, got nil")
		}
		if !strings.Contains(err.Error(), "id") {
			t.Fatalf("expected id-related error, got %v", err)
		}
	})

	t.Run("異常系: 空の名前", func(t *testing.T) {
		id := value_object.NewID()
		cost := mustNewMoney(t, 1000, "JPY")

		_, err := NewSpot(id, "", "説明", time.Now(), cost)
		if err == nil {
			t.Fatal("expected error for empty name, got nil")
		}
		if !strings.Contains(err.Error(), "name") {
			t.Fatalf("expected name-related error, got %v", err)
		}
	})

	t.Run("境界値:  estimatedCost が 0", func(t *testing.T) {
		id := value_object.NewID()
		cost := mustNewMoney(t, 0, "JPY")

		spot, err := NewSpot(id, "無料公園", "入場無料", time.Now(), cost)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if spot.EstimatedCost().Amount() != 0 {
			t.Fatalf("Amount() = %d, want 0", spot.EstimatedCost().Amount())
		}
	})
}

func TestSpot_Equals(t *testing.T) {
	cost := mustNewMoney(t, 1000, "JPY")
	idA := value_object.NewID()
	idB := value_object.NewID()

	t.Run("正常系: 同じ ID の Spot は同一", func(t *testing.T) {
		spot1, _ := NewSpot(idA, "東京タワー", "展望台", time.Now(), cost)
		spot2, _ := NewSpot(idA, "別名", "別の説明", time.Now(), cost)

		if !spot1.Equals(spot2) {
			t.Fatal("expected spots with same id to be equal")
		}
	})

	t.Run("正常系: 異なる ID の Spot は別物", func(t *testing.T) {
		spot1, _ := NewSpot(idA, "東京タワー", "展望台", time.Now(), cost)
		spot2, _ := NewSpot(idB, "東京タワー", "展望台", time.Now(), cost)

		if spot1.Equals(spot2) {
			t.Fatal("expected spots with different ids to be not equal")
		}
	})
}
