package entity

import (
	"sort"
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

// mustNewLegsForSpots は spots と連鎖（§6.2）する leg 列を生成するテストヘルパー。
// 指定した legCosts で各 leg の cost を上書きできる。len(legCosts) は len(spots) に等しいこと。
// legs は spots を StartAt 昇順にソートした順で構築する（NewItineraryDay 内のソートと一致させるため）。
func mustNewLegsForSpots(t *testing.T, spots []Spot, legCosts []value_object.Money) []Leg {
	t.Helper()
	if len(legCosts) != len(spots) {
		t.Fatalf("len(legCosts)=%d must match len(spots)=%d", len(legCosts), len(spots))
	}

	// StartAt 昇順にソートした spots コピーを作る
	sorted := make([]Spot, len(spots))
	copy(sorted, spots)
	sort.Slice(sorted, func(i, j int) bool {
		return sorted[i].StartAt().Before(sorted[j].StartAt())
	})

	mode, err := value_object.NewTransportMode("walk")
	if err != nil {
		t.Fatalf("failed to create transport mode: %v", err)
	}

	legs := make([]Leg, len(sorted))
	for i, spot := range sorted {
		var from value_object.Endpoint
		if i == 0 {
			from, err = value_object.NewNamedEndpoint("出発地")
			if err != nil {
				t.Fatalf("failed to create named endpoint: %v", err)
			}
		} else {
			from, err = value_object.NewSpotEndpoint(sorted[i-1].ID())
			if err != nil {
				t.Fatalf("failed to create spot endpoint: %v", err)
			}
		}
		to, err := value_object.NewSpotEndpoint(spot.ID())
		if err != nil {
			t.Fatalf("failed to create spot endpoint: %v", err)
		}

		leg, err := NewLeg(value_object.NewID(), from, to, mode, time.Minute, legCosts[i])
		if err != nil {
			t.Fatalf("failed to create leg %d: %v", i+1, err)
		}
		legs[i] = leg
	}
	return legs
}

// legCostsSameCurrencyは同一通貨の leg cost 列を生成する微小なテストヘルパー。
func legCostsSameCurrency(t *testing.T, spots []Spot, amounts []int, code string) []value_object.Money {
	t.Helper()
	if len(amounts) != len(spots) {
		t.Fatalf("len(amounts)=%d must match len(spots)=%d", len(amounts), len(spots))
	}
	costs := make([]value_object.Money, len(amounts))
	for i, a := range amounts {
		costs[i] = mustNewMoney(t, a, code)
	}
	return costs
}

func TestNewItineraryDay(t *testing.T) {
	t.Run("正常系: 有効な1日", func(t *testing.T) {
		id := value_object.NewID()
		date := time.Date(2026, 7, 7, 10, 30, 0, 0, time.UTC)
		spot := mustNewSpot(t, "東京タワー", 1000, "JPY")
		legs := mustNewLegsForSpots(t, []Spot{spot}, legCostsSameCurrency(t, []Spot{spot}, []int{0}, "JPY"))

		day, err := NewItineraryDay(id, date, []Spot{spot}, legs)
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
		if len(day.Legs()) != 1 {
			t.Fatalf("Legs() length = %d, want 1", len(day.Legs()))
		}
	})

	t.Run("異常系: spots 空", func(t *testing.T) {
		id := value_object.NewID()
		_, err := NewItineraryDay(id, time.Date(2026, 7, 7, 0, 0, 0, 0, time.UTC), nil, nil)
		if err == nil {
			t.Fatal("expected error for empty spots, got nil")
		}
		if !strings.Contains(err.Error(), "at least one spot") {
			t.Fatalf("expected spots-required error, got %v", err)
		}
	})

	t.Run("異常系: spots と legs の件数不一致", func(t *testing.T) {
		id := value_object.NewID()
		spot := mustNewSpot(t, "タワー", 1000, "JPY")
		// 1 spot に対し legs 0 件
		_, err := NewItineraryDay(id, time.Date(2026, 7, 7, 0, 0, 0, 0, time.UTC), []Spot{spot}, nil)
		if err == nil {
			t.Fatal("expected error for count mismatch, got nil")
		}
		if !strings.Contains(err.Error(), "must match") {
			t.Fatalf("expected count mismatch error, got %v", err)
		}
	})

	t.Run("異常系: legs[0].From がスポット Endpoint", func(t *testing.T) {
		id := value_object.NewID()
		// 2 spot 用意し、legs[0].To は spot2 に向けたまま legs[0].From を spot1 にする
		// （spot 1個だと from==to で NewLeg に弾かれてしまうため）
		spot1 := mustNewSpotAt(t, "朝", 1000, "JPY", time.Date(2026, 7, 7, 10, 0, 0, 0, time.UTC))
		spot2 := mustNewSpotAt(t, "昼", 1500, "JPY", time.Date(2026, 7, 7, 14, 0, 0, 0, time.UTC))
		legs := mustNewLegsForSpots(t, []Spot{spot1, spot2}, legCostsSameCurrency(t, []Spot{spot1, spot2}, []int{0, 0}, "JPY"))

		// legs[0].From をスポット Endpoint に書き換えて違反を作る。
		// legs[0].To はソート後先頭 spot(spot1, 10時) を指すので from==to を避けるため
		// badFrom には spot2 を使う。
		badFrom, err := value_object.NewSpotEndpoint(spot2.ID())
		if err != nil {
			t.Fatalf("failed to create spot endpoint: %v", err)
		}
		rebuilt, err := NewLeg(value_object.NewID(), badFrom, legs[0].To(), legs[0].Mode(), legs[0].Duration(), legs[0].Cost())
		if err != nil {
			t.Fatalf("failed to rebuild leg: %v", err)
		}
		legs[0] = rebuilt

		_, err = NewItineraryDay(id, time.Date(2026, 7, 7, 0, 0, 0, 0, time.UTC), []Spot{spot1, spot2}, legs)
		if err == nil {
			t.Fatal("expected error for legs[0].From being spot endpoint, got nil")
		}
		if !strings.Contains(err.Error(), "leg 1: from must be a named endpoint") {
			t.Fatalf("expected named endpoint error, got %v", err)
		}
	})

	t.Run("異常系: legs[i].To がスポット i を指していない", func(t *testing.T) {
		id := value_object.NewID()
		spot1 := mustNewSpotAt(t, "朝", 1000, "JPY", time.Date(2026, 7, 7, 10, 0, 0, 0, time.UTC))
		spot2 := mustNewSpotAt(t, "昼", 1500, "JPY", time.Date(2026, 7, 7, 14, 0, 0, 0, time.UTC))
		legs := mustNewLegsForSpots(t, []Spot{spot1, spot2}, legCostsSameCurrency(t, []Spot{spot1, spot2}, []int{0, 0}, "JPY"))
		// legs[1].To を spot1 に変えて連鎖を�す（spot2 を指すべきところ）
		badTo, err := value_object.NewSpotEndpoint(spot1.ID())
		if err != nil {
			t.Fatalf("failed to create spot endpoint: %v", err)
		}
		// legs[1].From は spot1 なので from==to で NewLeg に弾かれないよう badFrom を named endpoint に変える
		badFrom, err := value_object.NewNamedEndpoint("宿泊地")
		if err != nil {
			t.Fatalf("failed to create named endpoint: %v", err)
		}
		rebuilt, err := NewLeg(value_object.NewID(), badFrom, badTo, legs[1].Mode(), legs[1].Duration(), legs[1].Cost())
		if err != nil {
			t.Fatalf("failed to rebuild leg: %v", err)
		}
		legs[1] = rebuilt

		_, err = NewItineraryDay(id, time.Date(2026, 7, 7, 0, 0, 0, 0, time.UTC), []Spot{spot1, spot2}, legs)
		if err == nil {
			t.Fatal("expected error for legs[i].To mismatch, got nil")
		}
		if !strings.Contains(err.Error(), "leg 2: to must point to spot") {
			t.Fatalf("expected to-mismatch error, got %v", err)
		}
	})

	t.Run("異常系: legs[i>0].From が直前スポットでない", func(t *testing.T) {
		id := value_object.NewID()
		spot1 := mustNewSpotAt(t, "朝", 1000, "JPY", time.Date(2026, 7, 7, 10, 0, 0, 0, time.UTC))
		spot2 := mustNewSpotAt(t, "昼", 1500, "JPY", time.Date(2026, 7, 7, 14, 0, 0, 0, time.UTC))
		legs := mustNewLegsForSpots(t, []Spot{spot1, spot2}, legCostsSameCurrency(t, []Spot{spot1, spot2}, []int{0, 0}, "JPY"))
		// legs[1].From を名前付き Endpoint に変えて違反を作る
		badFrom, err := value_object.NewNamedEndpoint("宿泊地")
		if err != nil {
			t.Fatalf("failed to create named endpoint: %v", err)
		}
		rebuilt, err := NewLeg(value_object.NewID(), badFrom, legs[1].To(), legs[1].Mode(), legs[1].Duration(), legs[1].Cost())
		if err != nil {
			t.Fatalf("failed to rebuild leg: %v", err)
		}
		legs[1] = rebuilt

		_, err = NewItineraryDay(id, time.Date(2026, 7, 7, 0, 0, 0, 0, time.UTC), []Spot{spot1, spot2}, legs)
		if err == nil {
			t.Fatal("expected error for legs[i>0].From not previous spot, got nil")
		}
		if !strings.Contains(err.Error(), "leg 2: from must point to previous spot") {
			t.Fatalf("expected from-mismatch error, got %v", err)
		}
	})
}

func TestItineraryDay_TotalCost(t *testing.T) {
	t.Run("正常系: spots のみ legs 0 円の合計", func(t *testing.T) {
		id := value_object.NewID()
		spot1 := mustNewSpot(t, "タワー", 1000, "JPY")
		spot2 := mustNewSpot(t, "博物館", 1500, "JPY")
		legs := mustNewLegsForSpots(t, []Spot{spot1, spot2}, legCostsSameCurrency(t, []Spot{spot1, spot2}, []int{0, 0}, "JPY"))

		day, _ := NewItineraryDay(id, time.Date(2026, 7, 7, 0, 0, 0, 0, time.UTC), []Spot{spot1, spot2}, legs)
		total, err := day.TotalCost()
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if total.Amount() != 2500 {
			t.Fatalf("Amount() = %d, want 2500", total.Amount())
		}
	})

	t.Run("正常系: spots と legs の合計", func(t *testing.T) {
		id := value_object.NewID()
		spot1 := mustNewSpot(t, "タワー", 1000, "JPY")
		spot2 := mustNewSpot(t, "博物館", 1500, "JPY")
		legs := mustNewLegsForSpots(t, []Spot{spot1, spot2}, legCostsSameCurrency(t, []Spot{spot1, spot2}, []int{240, 360}, "JPY"))

		day, _ := NewItineraryDay(id, time.Date(2026, 7, 7, 0, 0, 0, 0, time.UTC), []Spot{spot1, spot2}, legs)
		total, err := day.TotalCost()
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		// spots(1000 + 1500) + legs(240 + 360) = 3100
		if total.Amount() != 3100 {
			t.Fatalf("Amount() = %d, want 3100", total.Amount())
		}
		if total.Currency().Code() != "JPY" {
			t.Fatalf("Currency().Code() = %q, want JPY", total.Currency().Code())
		}
	})

	t.Run("境界値: spots は0円・legs も0円 (=1日全て0円)", func(t *testing.T) {
		id := value_object.NewID()
		spot := mustNewSpot(t, "公園", 0, "JPY")
		legs := mustNewLegsForSpots(t, []Spot{spot}, legCostsSameCurrency(t, []Spot{spot}, []int{0}, "JPY"))

		day, _ := NewItineraryDay(id, time.Date(2026, 7, 7, 0, 0, 0, 0, time.UTC), []Spot{spot}, legs)
		total, err := day.TotalCost()
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if total.Amount() != 0 {
			t.Fatalf("Amount() = %d, want 0", total.Amount())
		}
		if total.Currency().Code() != "JPY" {
			t.Fatalf("Currency().Code() = %q, want JPY", total.Currency().Code())
		}
	})

	t.Run("異常系: spots 内の通貨混在", func(t *testing.T) {
		id := value_object.NewID()
		spot1 := mustNewSpot(t, "タワー", 1000, "JPY")
		spot2 := mustNewSpot(t, "美術館", 10, "USD")
		legs := mustNewLegsForSpots(t, []Spot{spot1, spot2}, legCostsSameCurrency(t, []Spot{spot1, spot2}, []int{0, 0}, "JPY"))

		day, _ := NewItineraryDay(id, time.Date(2026, 7, 7, 0, 0, 0, 0, time.UTC), []Spot{spot1, spot2}, legs)
		_, err := day.TotalCost()
		if err == nil {
			t.Fatal("expected error for mixed currencies, got nil")
		}
		if !strings.Contains(err.Error(), "mixed currencies") {
			t.Fatalf("expected mixed currencies error, got %v", err)
		}
	})

	t.Run("異常系: legs 内の通貨混在", func(t *testing.T) {
		id := value_object.NewID()
		spot1 := mustNewSpot(t, "タワー", 1000, "JPY")
		spot2 := mustNewSpot(t, "博物館", 1500, "JPY")
		legCosts := []value_object.Money{
			mustNewMoney(t, 240, "JPY"),
			mustNewMoney(t, 3, "USD"),
		}
		legs := mustNewLegsForSpots(t, []Spot{spot1, spot2}, legCosts)

		day, _ := NewItineraryDay(id, time.Date(2026, 7, 7, 0, 0, 0, 0, time.UTC), []Spot{spot1, spot2}, legs)
		if _, err := day.TotalCost(); err == nil {
			t.Fatal("expected error for mixed currencies in legs, got nil")
		}
	})

	t.Run("異常系: spots と legs 間の通貨混在", func(t *testing.T) {
		id := value_object.NewID()
		spot := mustNewSpot(t, "タワー", 1000, "JPY")
		legs := mustNewLegsForSpots(t, []Spot{spot}, []value_object.Money{mustNewMoney(t, 3, "USD")})

		day, _ := NewItineraryDay(id, time.Date(2026, 7, 7, 0, 0, 0, 0, time.UTC), []Spot{spot}, legs)
		if _, err := day.TotalCost(); err == nil {
			t.Fatal("expected error for mixed currencies between spots and legs, got nil")
		}
	})

	t.Run("正常系: spots は startAt の昇順に整列される", func(t *testing.T) {
		id := value_object.NewID()
		spot1 := mustNewSpotAt(t, "朝", 1000, "JPY", time.Date(2026, 7, 7, 14, 0, 0, 0, time.UTC))
		spot2 := mustNewSpotAt(t, "昼", 1000, "JPY", time.Date(2026, 7, 7, 10, 0, 0, 0, time.UTC))
		spot3 := mustNewSpotAt(t, "夜", 1000, "JPY", time.Date(2026, 7, 7, 18, 0, 0, 0, time.UTC))
		spots := []Spot{spot1, spot2, spot3}
		legs := mustNewLegsForSpots(t, spots, legCostsSameCurrency(t, spots, []int{0, 0, 0}, "JPY"))

		day, _ := NewItineraryDay(id, time.Date(2026, 7, 7, 0, 0, 0, 0, time.UTC), spots, legs)
		sorted := day.Spots()

		if !sorted[0].StartAt().Equal(time.Date(2026, 7, 7, 10, 0, 0, 0, time.UTC)) {
			t.Fatalf("first spot startAt = %v, want 10:00", sorted[0].StartAt())
		}
		if !sorted[1].StartAt().Equal(time.Date(2026, 7, 7, 14, 0, 0, 0, time.UTC)) {
			t.Fatalf("second spot startAt = %v, want 14:00", sorted[1].StartAt())
		}
		if !sorted[2].StartAt().Equal(time.Date(2026, 7, 7, 18, 0, 0, 0, time.UTC)) {
			t.Fatalf("third spot startAt = %v, want 18:00", sorted[2].StartAt())
		}
	})

	t.Run("異常系: 空の ID", func(t *testing.T) {
		spot := mustNewSpot(t, "タワー", 1000, "JPY")
		legs := mustNewLegsForSpots(t, []Spot{spot}, legCostsSameCurrency(t, []Spot{spot}, []int{0}, "JPY"))
		_, err := NewItineraryDay(value_object.ID{}, time.Date(2026, 7, 7, 0, 0, 0, 0, time.UTC), []Spot{spot}, legs)
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
	legs := mustNewLegsForSpots(t, []Spot{spot}, legCostsSameCurrency(t, []Spot{spot}, []int{0}, "JPY"))
	day, _ := NewItineraryDay(id, time.Date(2026, 7, 7, 0, 0, 0, 0, time.UTC), []Spot{spot}, legs)

	spots := day.Spots()
	spots[0] = mustNewSpot(t, "上書き", 9999, "JPY")

	if day.Spots()[0].Name() != "東京タワー" {
		t.Fatal("Spots() returned mutable internal slice")
	}
}

// TestItineraryDay_TotalLegCost は廃止された。
// TotalLegCost() は設計書 09 §6.1 の方針（TotalCost への統合）に従い
// TotalCost() に統合されたため、 Legs 関連のケースは
// TestItineraryDay_TotalCost に移植済み。
