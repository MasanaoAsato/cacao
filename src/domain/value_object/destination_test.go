package value_object

import "testing"

func TestNewDestination(t *testing.T) {
	t.Run("正常系: 都市と国", func(t *testing.T) {
		d, err := NewDestination("Tokyo", "Japan")
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
		d, err := NewDestination("Tokyo", "")
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
		if _, err := NewDestination("", "Japan"); err == nil {
			t.Fatal("expected error for empty city")
		}
	})
}

func TestDestination_Equals(t *testing.T) {
	d1, _ := NewDestination("Tokyo", "Japan")
	d2, _ := NewDestination("Tokyo", "Japan")
	d3, _ := NewDestination("Osaka", "Japan")
	d4, _ := NewDestination("Tokyo", "")

	if !d1.Equals(d2) {
		t.Fatal("same destination should be equal")
	}
	if d1.Equals(d3) {
		t.Fatal("different city should not be equal")
	}
	if d1.Equals(d4) {
		t.Fatal("different country should not be equal")
	}
}

func TestDestination_String(t *testing.T) {
	d1, _ := NewDestination("Tokyo", "Japan")
	if d1.String() != "Tokyo, Japan" {
		t.Fatalf("got %q, want Tokyo, Japan", d1.String())
	}

	d2, _ := NewDestination("Tokyo", "")
	if d2.String() != "Tokyo" {
		t.Fatalf("got %q, want Tokyo", d2.String())
	}
}
