package value_object

import "testing"

func TestNewImageAssetReference(t *testing.T) {
	tests := []struct {
		name       string
		storageKey string
		mediaType  string
		width      int
		height     int
		wantErr    bool
	}{
		{
			name:       "正常系 : PNG画像",
			storageKey: "journey-images/example.png",
			mediaType:  "image/png",
			width:      1200,
			height:     800,
		},
		{
			name:       "正常系 : JPEG画像",
			storageKey: "journey-images/example.jpg",
			mediaType:  "image/jpeg",
			width:      1,
			height:     1,
		},
		{
			name:       "境界値系 : storage keyが空文字",
			storageKey: "",
			mediaType:  "image/png",
			width:      1200,
			height:     800,
			wantErr:    true,
		},
		{
			name:       "異常系 : storage keyが絶対パス",
			storageKey: "/var/lib/cacao/image.png",
			mediaType:  "image/png",
			width:      1200,
			height:     800,
			wantErr:    true,
		},
		{
			name:       "異常系 : storage keyが配信URL",
			storageKey: "https://example.com/journey-images/example.png",
			mediaType:  "image/png",
			width:      1200,
			height:     800,
			wantErr:    true,
		},
		{
			name:       "異常系 : 非対応のメディアタイプ",
			storageKey: "journey-images/example.webp",
			mediaType:  "image/webp",
			width:      1200,
			height:     800,
			wantErr:    true,
		},
		{
			name:       "境界値系 : widthが0",
			storageKey: "journey-images/example.png",
			mediaType:  "image/png",
			width:      0,
			height:     800,
			wantErr:    true,
		},
		{
			name:       "境界値系 : heightが0",
			storageKey: "journey-images/example.png",
			mediaType:  "image/png",
			width:      1200,
			height:     0,
			wantErr:    true,
		},
		{
			name:       "異常系 : widthが負数",
			storageKey: "journey-images/example.png",
			mediaType:  "image/png",
			width:      -1,
			height:     800,
			wantErr:    true,
		},
		{
			name:       "異常系 : heightが負数",
			storageKey: "journey-images/example.png",
			mediaType:  "image/png",
			width:      1200,
			height:     -1,
			wantErr:    true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			reference, err := NewImageAssetReference(
				tt.storageKey,
				tt.mediaType,
				tt.width,
				tt.height,
			)
			if (err != nil) != tt.wantErr {
				t.Fatalf("NewImageAssetReference() error = %v, wantErr %v", err, tt.wantErr)
			}
			if tt.wantErr {
				return
			}

			if reference.StorageKey() != tt.storageKey {
				t.Errorf("StorageKey() = %q, want %q", reference.StorageKey(), tt.storageKey)
			}
			if reference.MediaType() != tt.mediaType {
				t.Errorf("MediaType() = %q, want %q", reference.MediaType(), tt.mediaType)
			}
			if reference.Width() != tt.width {
				t.Errorf("Width() = %d, want %d", reference.Width(), tt.width)
			}
			if reference.Height() != tt.height {
				t.Errorf("Height() = %d, want %d", reference.Height(), tt.height)
			}
			if err := reference.Validate(); err != nil {
				t.Errorf("Validate() error = %v", err)
			}
		})
	}
}

func TestImageAssetReferenceValidate(t *testing.T) {
	var reference ImageAssetReference
	if err := reference.Validate(); err == nil {
		t.Fatal("Validate() error = nil, want error for zero value")
	}
}
