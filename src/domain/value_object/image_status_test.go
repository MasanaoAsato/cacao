package value_object

import "testing"

func TestNewImageStatus(t *testing.T) {
	t.Run("正常系 : 有効なステータス", func(t *testing.T) {
		statuses := []string{"pending", "processing", "ready", "failed"}
		for _, s := range statuses {
			status, err := NewImageStatus(s)
			if err != nil {
				t.Fatalf("unexpected error for %q: %v", s, err)
			}
			if status.String() != s {
				t.Fatalf("String() = %q, want %q", status.String(), s)
			}
		}
	})

	t.Run("異常系 : 未知のステータス", func(t *testing.T) {
		if _, err := NewImageStatus("unknown"); err == nil {
			t.Fatal("expected error for unknown status, got nil")
		}
	})

	t.Run("境界値系 : 空文字", func(t *testing.T) {
		if _, err := NewImageStatus(""); err == nil {
			t.Fatal("expected error for empty string, got nil")
		}
	})

}

func TestImageStatusValidate(t *testing.T) {
	tests := []struct {
		name    string
		status  ImageStatus
		wantErr bool
	}{
		{
			name:   "正常系 : pending",
			status: ImageStatusPending,
		},
		{
			name:   "正常系 : processing",
			status: ImageStatusProcessing,
		},
		{
			name:   "正常系 : ready",
			status: ImageStatusReady,
		},
		{
			name:   "正常系 : failed",
			status: ImageStatusFailed,
		},
		{
			name:    "異常系 : 未知のステータス",
			status:  ImageStatus("unknown"),
			wantErr: true,
		},
		{
			name:    "境界値系 : ゼロ値",
			status:  ImageStatus(""),
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.status.Validate()
			if (err != nil) != tt.wantErr {
				t.Fatalf("Validate() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}

}
