package value_object

import "testing"

func TestNewMoney(t *testing.T) {
	jpy, _ := NewCurrency("JPY")

	t.Run("正常系: 0円", func(t *testing.T) {
		m, err := NewMoney(0, jpy)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if m.Amount() != 0 {
			t.Fatalf("got %d, want 0", m.Amount())
		}
	})

	t.Run("正常系: 正の金額", func(t *testing.T) {
		m, err := NewMoney(10000, jpy)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if m.Amount() != 10000 {
			t.Fatalf("got %d, want 10000", m.Amount())
		}
	})

	t.Run("異常系: 負の金額", func(t *testing.T) {
		if _, err := NewMoney(-100, jpy); err == nil {
			t.Fatal("expected error for negative amount, got nil")
		}
	})

	t.Run("境界値: -1", func(t *testing.T) {
		if _, err := NewMoney(-1, jpy); err == nil {
			t.Fatal("expected error for amount=-1, got nil")
		}
	})

	t.Run("境界値: math.MinInt", func(t *testing.T) {
		if _, err := NewMoney(-9223372036854775808, jpy); err == nil {
			t.Fatal("expected error for math.MinInt, got nil")
		}
	})
}

func TestMoney_Equals(t *testing.T) {
	jpy, _ := NewCurrency("JPY")
	usd, _ := NewCurrency("USD")

	m1, _ := NewMoney(1000, jpy)
	m2, _ := NewMoney(1000, jpy)
	m3, _ := NewMoney(1000, usd)
	m4, _ := NewMoney(2000, jpy)

	if !m1.Equals(m2) {
		t.Fatal("same amount and currency should be equal")
	}
	if m1.Equals(m3) {
		t.Fatal("different currency should not be equal")
	}
	if m1.Equals(m4) {
		t.Fatal("different amount should not be equal")
	}
}
