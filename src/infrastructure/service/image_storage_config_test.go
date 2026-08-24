package service

import (
	"testing"
)

func TestImageStorageConfigFromEnv(t *testing.T) {
	t.Run("正常系: 環境変数を設定値として読み込む", func(t *testing.T) {
		t.Setenv("IMAGE_STORAGE_DRIVER", "filesystem")
		t.Setenv("IMAGE_STORAGE_ROOT", "/tmp/cacao-images")
		t.Setenv("IMAGE_MAX_BYTES", "100")
		t.Setenv("IMAGE_MAX_WIDTH", "10")
		t.Setenv("IMAGE_MAX_HEIGHT", "20")
		t.Setenv("IMAGE_MAX_PIXELS", "200")

		config, err := ImageStorageConfigFromEnv()
		if err != nil {
			t.Fatalf("ImageStorageConfigFromEnv() error = %v", err)
		}
		if config.Root != "/tmp/cacao-images" {
			t.Errorf("Root = %q, want %q", config.Root, "/tmp/cacao-images")
		}
		if config.Driver != "filesystem" {
			t.Errorf("Driver = %q, want filesystem", config.Driver)
		}
		if config.MaxBytes != 100 {
			t.Errorf("MaxBytes = %d, want %d", config.MaxBytes, 100)
		}
		if config.MaxWidth != 10 {
			t.Errorf("MaxWidth = %d, want %d", config.MaxWidth, 10)
		}
		if config.MaxHeight != 20 {
			t.Errorf("MaxHeight = %d, want %d", config.MaxHeight, 20)
		}
		if config.MaxPixels != 200 {
			t.Errorf("MaxPixels = %d, want %d", config.MaxPixels, 200)
		}
	})

	t.Run("異常系: 0以下の上限を拒否する", func(t *testing.T) {
		t.Setenv("IMAGE_STORAGE_DRIVER", "filesystem")
		t.Setenv("IMAGE_MAX_BYTES", "0")

		_, err := ImageStorageConfigFromEnv()
		if err == nil {
			t.Fatal("ImageStorageConfigFromEnv() error = nil, want error")
		}
	})

	t.Run("異常系: 未対応のドライバを拒否する", func(t *testing.T) {
		t.Setenv("IMAGE_STORAGE_DRIVER", "s3")

		_, err := ImageStorageConfigFromEnv()
		if err == nil {
			t.Fatal("ImageStorageConfigFromEnv() error = nil, want error")
		}
	})

	t.Run("境界値系: すべての上限が1でも受け入れる", func(t *testing.T) {
		t.Setenv("IMAGE_STORAGE_DRIVER", "filesystem")
		t.Setenv("IMAGE_STORAGE_ROOT", ".")
		t.Setenv("IMAGE_MAX_BYTES", "1")
		t.Setenv("IMAGE_MAX_WIDTH", "1")
		t.Setenv("IMAGE_MAX_HEIGHT", "1")
		t.Setenv("IMAGE_MAX_PIXELS", "1")

		config, err := ImageStorageConfigFromEnv()
		if err != nil {
			t.Fatalf("ImageStorageConfigFromEnv() error = %v", err)
		}
		if config.MaxBytes != 1 || config.MaxWidth != 1 ||
			config.MaxHeight != 1 || config.MaxPixels != 1 {
			t.Errorf("config = %+v, want all limits to be 1", config)
		}
	})
}
