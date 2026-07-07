package value_object

import "testing"

func TestNewCurrency(t *testing.T) {
	t.Run("正常系: JPY", func(t *testing.T) {
		c, err := NewCurrency("JPY")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if c.Code() != "JPY" {
			t.Fatalf("got %q, want %q", c.Code(), "JPY")
		}
	})

	t.Run("正常系: 小文字は大文字に正規化される", func(t *testing.T) {
		c, err := NewCurrency("usd")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if c.Code() != "USD" {
			t.Fatalf("got %q, want %q", c.Code(), "USD")
		}
	})

	t.Run("正常系: 前後の空白は除去される", func(t *testing.T) {
		c, err := NewCurrency("  jpy  ")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if c.Code() != "JPY" {
			t.Fatalf("got %q, want %q", c.Code(), "JPY")
		}
	})

	t.Run("異常系: 2文字はNG", func(t *testing.T) {
		if _, err := NewCurrency("JP"); err == nil {
			t.Fatal("expected error for 2-letter code, got nil")
		}
	})

	t.Run("異常系: 4文字はNG", func(t *testing.T) {
		if _, err := NewCurrency("JPYY"); err == nil {
			t.Fatal("expected error for 4-letter code, got nil")
		}
	})

	t.Run("異常系: 数字を含む", func(t *testing.T) {
		if _, err := NewCurrency("J1Y"); err == nil {
			t.Fatal("expected error for code with digits, got nil")
		}
	})

	t.Run("異常系: 数字のみ", func(t *testing.T) {
		if _, err := NewCurrency("123"); err == nil {
			t.Fatal("expected error for digits-only code, got nil")
		}
	})

	t.Run("異常系: 記号を含む", func(t *testing.T) {
		if _, err := NewCurrency("J-Y"); err == nil {
			t.Fatal("expected error for code with symbol, got nil")
		}
	})

	t.Run("境界値: 空文字列", func(t *testing.T) {
		if _, err := NewCurrency(""); err == nil {
			t.Fatal("expected error for empty code, got nil")
		}
	})
}

func TestCurrency_Equals(t *testing.T) {
	jpy1, _ := NewCurrency("JPY")
	jpy2, _ := NewCurrency("jpy") // 正規化済みなら同一
	usd, _ := NewCurrency("USD")

	if !jpy1.Equals(jpy2) {
		t.Fatal("JPY and jpy should be equal after normalization")
	}
	if jpy1.Equals(usd) {
		t.Fatal("JPY and USD should not be equal")
	}
}
