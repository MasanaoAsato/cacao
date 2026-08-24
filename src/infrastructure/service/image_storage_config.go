package service

import (
	"fmt"
	"strings"

	"github.com/caarlos0/env/v10"
)

// ImageStorageConfig はバックエンド管理の画像保存先と受け入れ上限を表す。
type ImageStorageConfig struct {
	Driver    string `env:"IMAGE_STORAGE_DRIVER" envDefault:"filesystem"`
	Root      string `env:"IMAGE_STORAGE_ROOT" envDefault:"./var/journey-images"`
	MaxBytes  int64  `env:"IMAGE_MAX_BYTES" envDefault:"20971520"`
	MaxWidth  int    `env:"IMAGE_MAX_WIDTH" envDefault:"4096"`
	MaxHeight int    `env:"IMAGE_MAX_HEIGHT" envDefault:"4096"`
	MaxPixels int64  `env:"IMAGE_MAX_PIXELS" envDefault:"16777216"`
}

// ImageStorageConfigFromEnv は画像ストレージ設定を環境変数から読み込む。
func ImageStorageConfigFromEnv() (ImageStorageConfig, error) {
	var config ImageStorageConfig
	if err := env.Parse(&config); err != nil {
		return ImageStorageConfig{}, fmt.Errorf("parse image storage config: %w", err)
	}
	if err := config.validate(); err != nil {
		return ImageStorageConfig{}, err
	}
	return config, nil
}

func (c ImageStorageConfig) validate() error {
	if c.Driver != "filesystem" {
		return fmt.Errorf("unsupported image storage driver: %q", c.Driver)
	}
	if strings.TrimSpace(c.Root) == "" {
		return fmt.Errorf("image storage root must not be empty")
	}
	if c.MaxBytes < 1 {
		return fmt.Errorf("image maximum bytes must be positive")
	}
	if c.MaxWidth < 1 {
		return fmt.Errorf("image maximum width must be positive")
	}
	if c.MaxHeight < 1 {
		return fmt.Errorf("image maximum height must be positive")
	}
	if c.MaxPixels < 1 {
		return fmt.Errorf("image maximum pixels must be positive")
	}
	return nil
}
