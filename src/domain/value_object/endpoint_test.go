package value_object

import (
	"testing"
)

func TestNewSpotEndpoint(t *testing.T) {
	t.Run("正常系: 有効なIDでスポット参照のEndpointを生成できる", func(t *testing.T) {
		id := NewID()

		e, err := NewSpotEndpoint(id)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if !e.IsSpot() {
			t.Fatal("IsSpot() = false, want true")
		}
		if !e.SpotID().Equals(id) {
			t.Fatalf("SpotID() = %v, want %v", e.SpotID(), id)
		}
	})

	t.Run("異常系: 空のIDはエラー", func(t *testing.T) {
		if _, err := NewSpotEndpoint(ID{}); err == nil {
			t.Fatal("expected error for empty id, got nil")
		}
	})
}

func TestNewNamedEndpoint(t *testing.T) {
	t.Run("正常系: ラベル指定で旅程外地点のEndpointを生成できる", func(t *testing.T) {
		e, err := NewNamedEndpoint("大阪（出発地）")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if e.IsSpot() {
			t.Fatal("IsSpot() = true, want false")
		}
		if !e.SpotID().IsEmpty() {
			t.Fatalf("SpotID() = %v, want empty", e.SpotID())
		}
	})

	t.Run("異常系: 空のラベルはエラー", func(t *testing.T) {
		if _, err := NewNamedEndpoint(""); err == nil {
			t.Fatal("expected error for empty label, got nil")
		}
	})
}

func TestEndpointEquals(t *testing.T) {
	t.Run("正常系: 同一スポット参照のEndpoint同士は等しい", func(t *testing.T) {
		id := NewID()
		e1, err := NewSpotEndpoint(id)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		e2, err := NewSpotEndpoint(id)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if !e1.Equals(e2) {
			t.Fatal("spot endpoints with same id should be equal")
		}
	})

	t.Run("正常系: 同一地点名のEndpoint同士は等しい", func(t *testing.T) {
		e1, err := NewNamedEndpoint("大阪（出発地）")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		e2, err := NewNamedEndpoint("大阪（出発地）")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if !e1.Equals(e2) {
			t.Fatal("named endpoints with same label should be equal")
		}
	})

	t.Run("異常系: 異なるスポットIDのEndpoint同士は等しくない", func(t *testing.T) {
		e1, err := NewSpotEndpoint(NewID())
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		e2, err := NewSpotEndpoint(NewID())
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if e1.Equals(e2) {
			t.Fatal("spot endpoints with different id should not be equal")
		}
	})

	t.Run("異常系: スポット参照と名前付き地点は等しくない", func(t *testing.T) {
		spot, err := NewSpotEndpoint(NewID())
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		named, err := NewNamedEndpoint("出発地")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if spot.Equals(named) {
			t.Fatal("spot endpoint and named endpoint should not be equal")
		}
	})
}
