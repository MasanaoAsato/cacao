package value_object

import "testing"

func TestNewDeparture(t *testing.T) {
	t.Run("正常系: 都市と国", func(t *testing.T) {
		d, err := NewDeparture("Tokyo", "Japan")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if d.City() != "Tokyo" {
			t.Fatalf("got %q, want Tokyo", d.City())
		}
		if d.Country() != "Japan" {
			t.Fatalf("got %q, want Japan", d.Country())
		}
	})

	t.Run("正常系: 国は空でもOK", func(t *testing.T) {
		d, err := NewDeparture("Tokyo", "")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if d.City() != "Tokyo" {
			t.Fatalf("got %q, want Tokyo", d.City())
		}
	})

	t.Run("正常系: 前後の空白は除去される", func(t *testing.T) {
		d, err := NewDeparture("  Tokyo  ", "  Japan  ")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if d.City() != "Tokyo" {
			t.Fatalf("got %q, want Tokyo", d.City())
		}
		if d.Country() != "Japan" {
			t.Fatalf("got %q, want Japan", d.Country())
		}
	})

	t.Run("異常系: 都市が空", func(t *testing.T) {
		if _, err := NewDeparture("", "Japan"); err == nil {
			t.Fatal("expected error for empty city")
		}
	})

	t.Run("異常系: 都市が空白のみ", func(t *testing.T) {
		if _, err := NewDeparture("   ", "Japan"); err == nil {
			t.Fatal("expected error for whitespace-only city")
		}
	})
}

func TestDeparture_Equals(t *testing.T) {
	d1, _ := NewDeparture("Tokyo", "Japan")
	d2, _ := NewDeparture("Tokyo", "Japan")
	d3, _ := NewDeparture("Osaka", "Japan")
	d4, _ := NewDeparture("Tokyo", "")

	if !d1.Equals(d2) {
		t.Fatal("same departure should be equal")
	}
	if d1.Equals(d3) {
		t.Fatal("different city should not be equal")
	}
	if d1.Equals(d4) {
		t.Fatal("different country should not be equal")
	}
}

func TestDeparture_String(t *testing.T) {
	d1, _ := NewDeparture("Tokyo", "Japan")
	if d1.String() != "Tokyo, Japan" {
		t.Fatalf("got %q, want Tokyo, Japan", d1.String())
	}

	d2, _ := NewDeparture("Tokyo", "")
	if d2.String() != "Tokyo" {
		t.Fatalf("got %q, want Tokyo", d2.String())
	}
}
