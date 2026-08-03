package value_object

import "testing"

func TestNewTransportMode(t *testing.T) {
	t.Run("正常系: 全種別の生成", func(t *testing.T) {
		cases := []string{
			"walk", "train", "bus", "car", "taxi",
			"bicycle", "flight", "ferry", "other",
		}
		for _, s := range cases {
			m, err := NewTransportMode(s)
			if err != nil {
				t.Fatalf("unexpected error for %q: %v", s, err)
			}
			if m.String() != s {
				t.Fatalf("String() = %q, want %q", m.String(), s)
			}
		}
	})

	t.Run("異常系: 未知の文字列はエラー", func(t *testing.T) {
		if _, err := NewTransportMode("shinkansen"); err == nil {
			t.Fatal("expected error for unknown mode, got nil")
		}
	})

	t.Run("境界値系: 空文字はエラー", func(t *testing.T) {
		if _, err := NewTransportMode(""); err == nil {
			t.Fatal("expected error for empty string, got nil")
		}
	})
}
