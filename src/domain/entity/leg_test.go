package entity

import (
	"testing"
	"time"

	"cacao/src/domain/value_object"
)

func newSpotEndpoint(t *testing.T) value_object.Endpoint {
	t.Helper()
	id := value_object.NewID()
	e, err := value_object.NewSpotEndpoint(id)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	return e
}

func newNamedEndpoint(t *testing.T, label string) value_object.Endpoint {
	t.Helper()
	e, err := value_object.NewNamedEndpoint(label)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	return e
}

func newMoney(t *testing.T, amount int) value_object.Money {
	t.Helper()
	currency, err := value_object.NewCurrency("JPY")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	m, err := value_object.NewMoney(amount, currency)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	return m
}

func TestNewLeg(t *testing.T) {
	t.Run("正常系: Leg を生成してゲッターが正しい値を返す", func(t *testing.T) {
		id := value_object.NewID()
		from := newNamedEndpoint(t, "大阪（出発地）")
		to := newSpotEndpoint(t)
		mode, _ := value_object.NewTransportMode("train")
		money := newMoney(t, 240)

		leg, err := NewLeg(id, from, to, mode, 25*time.Minute, money)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if !leg.ID().Equals(id) {
			t.Fatal("ID mismatch")
		}
		if !leg.From().Equals(from) {
			t.Fatal("From mismatch")
		}
		if !leg.To().Equals(to) {
			t.Fatal("To mismatch")
		}
		if leg.Mode() != mode {
			t.Fatal("Mode mismatch")
		}
		if leg.Duration() != 25*time.Minute {
			t.Fatalf("Duration = %v, want %v", leg.Duration(), 25*time.Minute)
		}
		if !leg.Cost().Equals(money) {
			t.Fatal("Cost mismatch")
		}
	})

	t.Run("異常系: 空のIDはエラー", func(t *testing.T) {
		to := newSpotEndpoint(t)
		mode, _ := value_object.NewTransportMode("train")

		if _, err := NewLeg(value_object.ID{}, newNamedEndpoint(t, "出発地"), to, mode, 10*time.Minute, newMoney(t, 100)); err == nil {
			t.Fatal("expected error for empty id, got nil")
		}
	})

	t.Run("異常系: from と to が同一の場合はエラー", func(t *testing.T) {
		id := value_object.NewID()
		spot := newSpotEndpoint(t)
		mode, _ := value_object.NewTransportMode("walk")

		if _, err := NewLeg(id, spot, spot, mode, 5*time.Minute, newMoney(t, 0)); err == nil {
			t.Fatal("expected error when from == to, got nil")
		}
	})

	t.Run("境界値系: duration 0 はエラー", func(t *testing.T) {
		id := value_object.NewID()
		mode, _ := value_object.NewTransportMode("train")

		if _, err := NewLeg(id, newNamedEndpoint(t, "出発地"), newSpotEndpoint(t), mode, 0, newMoney(t, 100)); err == nil {
			t.Fatal("expected error for zero duration, got nil")
		}
	})

	t.Run("境界値系: duration 1分は正常 / cost 0円は正常", func(t *testing.T) {
		id := value_object.NewID()
		mode, _ := value_object.NewTransportMode("walk")

		leg, err := NewLeg(id, newNamedEndpoint(t, "出発地"), newSpotEndpoint(t), mode, 1*time.Minute, newMoney(t, 0))
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if leg.Duration() != 1*time.Minute {
			t.Fatalf("Duration = %v, want %v", leg.Duration(), 1*time.Minute)
		}
	})
}

func TestLegEquals(t *testing.T) {
	t.Run("正常系: 同一IDならEqualsはtrue", func(t *testing.T) {
		id := value_object.NewID()
		mode, _ := value_object.NewTransportMode("train")

		leg1, _ := NewLeg(id, newNamedEndpoint(t, "A"), newSpotEndpoint(t), mode, 10*time.Minute, newMoney(t, 100))
		// 別の属性で同じIDのLegは作れないので、別インスタンスだが同じIDのものを比較
		leg2 := leg1
		if !leg1.Equals(leg2) {
			t.Fatal("same id should be equal")
		}
	})

	t.Run("異常系: 別IDならEqualsはfalse", func(t *testing.T) {
		mode, _ := value_object.NewTransportMode("train")

		leg1, _ := NewLeg(value_object.NewID(), newNamedEndpoint(t, "A"), newSpotEndpoint(t), mode, 10*time.Minute, newMoney(t, 100))
		leg2, _ := NewLeg(value_object.NewID(), newNamedEndpoint(t, "A"), newSpotEndpoint(t), mode, 10*time.Minute, newMoney(t, 100))
		if leg1.Equals(leg2) {
			t.Fatal("different id should not be equal")
		}
	})
}
