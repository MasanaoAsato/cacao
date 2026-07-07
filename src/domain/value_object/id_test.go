package value_object

import (
	"testing"

	"github.com/google/uuid"
)

func TestNewID(t *testing.T) {
	i := NewID()

	// ランダムに生成されるので、ゼロ値 (UUID_nil) でないことを検証
	if i.Value() == uuid.Nil {
		t.Fatal("NewID() returned nil uuid")
	}
	if i.Value().Version() != 4 {
		t.Fatalf("got version %d, want 4", i.Value().Version())
	}
}

func TestNewIDFromString(t *testing.T) {
	t.Run("正常系: 有効なUUID文字列", func(t *testing.T) {
		original := NewID()
		got, err := NewIDFromString(original.String())
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if !got.Equals(original) {
			t.Fatalf("got %v, want %v", got, original)
		}
	})

	t.Run("異常系: 不正な文字列", func(t *testing.T) {
		if _, err := NewIDFromString("not-a-uuid"); err == nil {
			t.Fatal("expected error for invalid string, got nil")
		}
	})

	t.Run("境界値: 空文字列", func(t *testing.T) {
		if _, err := NewIDFromString(""); err == nil {
			t.Fatal("expected error for empty string, got nil")
		}
	})
}
