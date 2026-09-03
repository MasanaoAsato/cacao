package config

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/caarlos0/env/v10"
)

// 画像生成ドライバ名。main の生成器ファクトリと設定検証の両方がこの定数を参照する。
const (
	ImageGeneratorStub       = "stub"
	ImageGeneratorComfyUI    = "comfyui"
	ImageGeneratorOpenRouter = "openrouter"
)

// 画像ストレージドライバ名。
const ImageStorageFilesystem = "filesystem"

// 画像生成タイムアウトと worker lease の既定値。
// 設計書で定めた値をここ1箇所で持ち、env 未設定時に適用する。
const (
	DefaultImageGenerationTimeout = 180 * time.Second
	DefaultImageLeaseDuration     = 240 * time.Second
)

// 画像 worker 設定の許容範囲。
const (
	MinImageGenerationTimeout  = time.Second
	MinImageWorkerPollInterval = 100 * time.Millisecond
	MinImageWorkerConcurrency  = 1
	MaxImageWorkerConcurrency  = 4
)

// Image は画像生成・worker・storage の運用設定を表す。
type Image struct {
	GeneratorDriver   string        `env:"IMAGE_GENERATOR_DRIVER" envDefault:"stub"`
	GenerationTimeout time.Duration `env:"IMAGE_GENERATION_TIMEOUT"`
	ComfyUI           ComfyUI
	OpenRouterImage   OpenRouterImage
	Worker            ImageWorker
	Storage           ImageStorage
}

// ComfyUI は ComfyUI ドライバの接続設定。
type ComfyUI struct {
	BaseURL      string `env:"COMFYUI_BASE_URL"`
	WorkflowPath string `env:"COMFYUI_WORKFLOW_PATH" envDefault:"config/comfyui/journey_image_api.json"`
	ManifestPath string `env:"COMFYUI_MANIFEST_PATH" envDefault:"config/comfyui/journey_image_manifest.json"`
}

// OpenRouterImage は OpenRouter 画像生成ドライバの設定。
type OpenRouterImage struct {
	APIKey string `env:"OPENROUTER_API_KEY"`
	Model  string `env:"OPENROUTER_IMAGE_MODEL"`
}

// ImageWorker は画像生成 worker の動作設定。
type ImageWorker struct {
	Concurrency   int           `env:"IMAGE_WORKER_CONCURRENCY" envDefault:"1"`
	PollInterval  time.Duration `env:"IMAGE_WORKER_POLL_INTERVAL" envDefault:"1s"`
	LeaseDuration time.Duration `env:"IMAGE_WORKER_LEASE_DURATION"`
}

// ImageStorage は画像保存先と受け入れ上限の設定。
type ImageStorage struct {
	Driver string `env:"IMAGE_STORAGE_DRIVER" envDefault:"filesystem"`
	Root   string `env:"IMAGE_STORAGE_ROOT" envDefault:"./var/journey-images"`
	Limits ImageLimits
}

// ImageLimits は受け入れる生成画像の上限。生成器とストレージの両方が同じ値を使う。
type ImageLimits struct {
	MaxBytes  int64 `env:"IMAGE_MAX_BYTES" envDefault:"20971520"`
	MaxWidth  int   `env:"IMAGE_MAX_WIDTH" envDefault:"4096"`
	MaxHeight int   `env:"IMAGE_MAX_HEIGHT" envDefault:"4096"`
	MaxPixels int64 `env:"IMAGE_MAX_PIXELS" envDefault:"16777216"`
}

// ImageFromEnv は画像関連の設定を環境変数から読み込み、既定値の補完と検証を行う。
func ImageFromEnv() (Image, error) {
	var config Image
	if err := env.Parse(&config); err != nil {
		return Image{}, fmt.Errorf("parse image config: %w", err)
	}
	config = config.normalized()
	if err := config.Validate(); err != nil {
		return Image{}, err
	}
	return config, nil
}

func (c Image) normalized() Image {
	if c.GenerationTimeout == 0 {
		c.GenerationTimeout = DefaultImageGenerationTimeout
	}
	if c.Worker.LeaseDuration == 0 {
		c.Worker.LeaseDuration = DefaultImageLeaseDuration
	}
	c.ComfyUI.BaseURL = strings.TrimSpace(c.ComfyUI.BaseURL)
	c.ComfyUI.WorkflowPath = strings.TrimSpace(c.ComfyUI.WorkflowPath)
	c.ComfyUI.ManifestPath = strings.TrimSpace(c.ComfyUI.ManifestPath)
	c.OpenRouterImage.APIKey = strings.TrimSpace(c.OpenRouterImage.APIKey)
	c.OpenRouterImage.Model = strings.TrimSpace(c.OpenRouterImage.Model)
	return c
}

// Validate は数値の範囲と、選択されたドライバに必要な設定が揃っているかを検証する。
// ドライバ固有の接続確認（URL 解析やファイル読込）は生成器のコンストラクタが行う。
func (c Image) Validate() error {
	if c.GenerationTimeout < MinImageGenerationTimeout {
		return fmt.Errorf("image generation timeout must be at least %s", MinImageGenerationTimeout)
	}
	if err := c.Worker.validate(c.GenerationTimeout); err != nil {
		return err
	}
	if err := c.Storage.Validate(); err != nil {
		return err
	}

	switch c.GeneratorDriver {
	case ImageGeneratorStub:
		return nil
	case ImageGeneratorComfyUI:
		return c.ComfyUI.Validate()
	case ImageGeneratorOpenRouter:
		return c.OpenRouterImage.Validate()
	default:
		return fmt.Errorf("unsupported image generator driver: %q", c.GeneratorDriver)
	}
}

func (w ImageWorker) validate(generationTimeout time.Duration) error {
	if w.Concurrency < MinImageWorkerConcurrency || w.Concurrency > MaxImageWorkerConcurrency {
		return fmt.Errorf(
			"image worker concurrency must be between %d and %d",
			MinImageWorkerConcurrency,
			MaxImageWorkerConcurrency,
		)
	}
	if w.PollInterval < MinImageWorkerPollInterval {
		return fmt.Errorf("image worker poll interval must be at least %s", MinImageWorkerPollInterval)
	}
	if w.LeaseDuration <= generationTimeout {
		return fmt.Errorf("image worker lease duration must be longer than generation timeout")
	}
	return nil
}

// Validate は ComfyUI ドライバに必要な値が設定されているかを検証する。
func (c ComfyUI) Validate() error {
	if c.BaseURL == "" {
		return fmt.Errorf("comfyui base URL must be set when image generator driver is comfyui")
	}
	if c.WorkflowPath == "" {
		return fmt.Errorf("comfyui workflow path must not be empty")
	}
	if c.ManifestPath == "" {
		return fmt.Errorf("comfyui manifest path must not be empty")
	}
	return nil
}

// Validate は OpenRouter 画像生成に必要な API キーとモデル ID を検証する。
func (c OpenRouterImage) Validate() error {
	if strings.TrimSpace(c.APIKey) == "" {
		return errors.New("openrouter api key must be set when image generator driver is openrouter")
	}
	return validateOpenRouterModel(c.Model, "openrouter image model")
}

// Validate はストレージドライバと上限値を検証する。
func (c ImageStorage) Validate() error {
	if c.Driver != ImageStorageFilesystem {
		return fmt.Errorf("unsupported image storage driver: %q", c.Driver)
	}
	if strings.TrimSpace(c.Root) == "" {
		return fmt.Errorf("image storage root must not be empty")
	}
	return c.Limits.Validate()
}

// Validate は上限値がすべて正であることを検証する。
func (l ImageLimits) Validate() error {
	if l.MaxBytes < 1 {
		return fmt.Errorf("image maximum bytes must be positive")
	}
	if l.MaxWidth < 1 {
		return fmt.Errorf("image maximum width must be positive")
	}
	if l.MaxHeight < 1 {
		return fmt.Errorf("image maximum height must be positive")
	}
	if l.MaxPixels < 1 {
		return fmt.Errorf("image maximum pixels must be positive")
	}
	return nil
}

// validateOpenRouterModel は OpenRouter のモデル ID として使えない値を弾く。
// 旅程生成と画像生成の両方で同じルールを使う。
func validateOpenRouterModel(model, label string) error {
	model = strings.TrimSpace(model)
	if model == "" {
		return fmt.Errorf("%s must not be empty", label)
	}
	if strings.HasPrefix(model, "~") {
		return fmt.Errorf("%s must be a model id without leading '~'", label)
	}
	if strings.HasPrefix(model, "http://") || strings.HasPrefix(model, "https://") {
		return fmt.Errorf("%s must be a model id, not a url", label)
	}
	return nil
}
