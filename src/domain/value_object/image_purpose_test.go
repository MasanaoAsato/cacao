package value_object

import "testing"

func TestNewImagePurpose(t *testing.T) {
	t.Run("正常系 : 有効な目的", func(t *testing.T) {
		purposes := []string{"cover", "illustration"}
		for _, p := range purposes {
			purpose, err := NewImagePurpose(p)
			if err != nil {
				t.Fatalf("unexpected error for %q: %v", p, err)
			}
			if purpose.String() != p {
				t.Fatalf("String() = %q, want %q", purpose.String(), p)
			}
		}
	})

	t.Run("異常系 : 未知の目的", func(t *testing.T) {
		if _, err := NewImagePurpose("unknown"); err == nil {
			t.Fatal("expected error for unknown purpose, got nil")
		}
	})

	t.Run("境界値系 : 空文字", func(t *testing.T) {
		if _, err := NewImagePurpose(""); err == nil {
			t.Fatal("expected error for empty string, got nil")
		}
	})

}

func TestImagePurposeValidate(t *testing.T) {
	tests := []struct {
		name    string
		purpose ImagePurpose
		wantErr bool
	}{
		{
			name:    "正常系 : cover",
			purpose: ImagePurposeCover,
		},
		{
			name:    "正常系 : illustration",
			purpose: ImagePurposeIllustration,
		},
		{
			name:    "異常系 : 未知の目的",
			purpose: ImagePurpose("unknown"),
			wantErr: true,
		},
		{
			name:    "境界値系 : ゼロ値",
			purpose: ImagePurpose(""),
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.purpose.Validate()
			if (err != nil) != tt.wantErr {
				t.Fatalf("Validate() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}
