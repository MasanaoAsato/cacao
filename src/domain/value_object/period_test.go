package value_object

import (
	"testing"
	"time"
)

func mustParseDate(s string) time.Time {
	t, err := time.Parse(time.DateOnly, s)
	if err != nil {
		panic(err)
	}
	return t
}

func TestNewPeriod(t *testing.T) {
	t.Run("正常系: 同日", func(t *testing.T) {
		start := mustParseDate("2026-07-07")
		end := mustParseDate("2026-07-07")
		p, err := NewPeriod(start, end)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if !p.StartDate().Equal(start) {
			t.Fatal("startDate mismatch")
		}
	})

	t.Run("正常系: 複数日", func(t *testing.T) {
		start := mustParseDate("2026-07-07")
		end := mustParseDate("2026-07-09")
		p, err := NewPeriod(start, end)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if p.Days() != 3 {
			t.Fatalf("got %d days, want 3", p.Days())
		}
		if p.Nights() != 2 {
			t.Fatalf("got %d nights, want 2", p.Nights())
		}
	})

	t.Run("異常系: 終了日が開始日より前", func(t *testing.T) {
		start := mustParseDate("2026-07-09")
		end := mustParseDate("2026-07-07")
		if _, err := NewPeriod(start, end); err == nil {
			t.Fatal("expected error when endDate before startDate")
		}
	})

	t.Run("境界値: 終了日が開始日の1日前", func(t *testing.T) {
		start := mustParseDate("2026-07-08")
		end := mustParseDate("2026-07-07")
		if _, err := NewPeriod(start, end); err == nil {
			t.Fatal("expected error for adjacent invalid date")
		}
	})

	t.Run("境界値: 時刻部分は切り捨てられる", func(t *testing.T) {
		start := time.Date(2026, 7, 7, 23, 59, 59, 0, time.UTC)
		end := time.Date(2026, 7, 7, 0, 0, 0, 0, time.UTC)
		p, err := NewPeriod(start, end)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if p.Days() != 1 {
			t.Fatalf("got %d days, want 1", p.Days())
		}
	})
}

func TestPeriod_Equals(t *testing.T) {
	p1, _ := NewPeriod(mustParseDate("2026-07-07"), mustParseDate("2026-07-09"))
	p2, _ := NewPeriod(mustParseDate("2026-07-07"), mustParseDate("2026-07-09"))
	p3, _ := NewPeriod(mustParseDate("2026-07-07"), mustParseDate("2026-07-08"))

	if !p1.Equals(p2) {
		t.Fatal("same period should be equal")
	}
	if p1.Equals(p3) {
		t.Fatal("different period should not be equal")
	}
}
