package service

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"cacao/src/infrastructure/service/comfyui"

	"github.com/caarlos0/env/v10"
)

// ImageConfig は画像生成・worker・storageの運用設定を表す。
type ImageConfig struct {
	GeneratorDriver      string
	ComfyUIBaseURL       string
	ComfyUIWorkflowPath  string
	ComfyUIManifestPath  string
	OpenRouterAPIKey     string
	OpenRouterImageModel string
	GenerationTimeout    time.Duration
	WorkerConcurrency    int
	WorkerPollInterval   time.Duration
	WorkerLeaseDuration  time.Duration
	Storage              ImageStorageConfig
}

type imageConfigEnv struct {
	GeneratorDriver      string        `env:"IMAGE_GENERATOR_DRIVER" envDefault:"stub"`
	ComfyUIBaseURL       string        `env:"COMFYUI_BASE_URL"`
	ComfyUIWorkflowPath  string        `env:"COMFYUI_WORKFLOW_PATH" envDefault:"config/comfyui/journey_image_api.json"`
	ComfyUIManifestPath  string        `env:"COMFYUI_MANIFEST_PATH" envDefault:"config/comfyui/journey_image_manifest.json"`
	OpenRouterAPIKey     string        `env:"OPENROUTER_API_KEY"`
	OpenRouterImageModel string        `env:"OPENROUTER_IMAGE_MODEL"`
	GenerationTimeout    time.Duration `env:"IMAGE_GENERATION_TIMEOUT" envDefault:"180s"`
	WorkerConcurrency    int           `env:"IMAGE_WORKER_CONCURRENCY" envDefault:"1"`
	WorkerPollInterval   time.Duration `env:"IMAGE_WORKER_POLL_INTERVAL" envDefault:"1s"`
	WorkerLeaseDuration  time.Duration `env:"IMAGE_WORKER_LEASE_DURATION" envDefault:"240s"`
}

// ImageConfigFromEnv は画像関連の設定を環境変数から読み込み、相互条件まで検証する。
func ImageConfigFromEnv() (ImageConfig, error) {
	var raw imageConfigEnv
	if err := env.Parse(&raw); err != nil {
		return ImageConfig{}, fmt.Errorf("parse image config: %w", err)
	}

	storage, err := ImageStorageConfigFromEnv()
	if err != nil {
		return ImageConfig{}, fmt.Errorf("parse image storage config: %w", err)
	}

	config := ImageConfig{
		GeneratorDriver:      raw.GeneratorDriver,
		ComfyUIBaseURL:       raw.ComfyUIBaseURL,
		ComfyUIWorkflowPath:  raw.ComfyUIWorkflowPath,
		ComfyUIManifestPath:  raw.ComfyUIManifestPath,
		OpenRouterAPIKey:     strings.TrimSpace(raw.OpenRouterAPIKey),
		OpenRouterImageModel: strings.TrimSpace(raw.OpenRouterImageModel),
		GenerationTimeout:    raw.GenerationTimeout,
		WorkerConcurrency:    raw.WorkerConcurrency,
		WorkerPollInterval:   raw.WorkerPollInterval,
		WorkerLeaseDuration:  raw.WorkerLeaseDuration,
		Storage:              storage,
	}
	if err := config.validate(); err != nil {
		return ImageConfig{}, err
	}

	return config, nil
}

func (c ImageConfig) validate() error {
	if c.GenerationTimeout < time.Second {
		return fmt.Errorf("image generation timeout must be at least 1s")
	}
	if c.WorkerConcurrency < 1 || c.WorkerConcurrency > 4 {
		return fmt.Errorf("image worker concurrency must be between 1 and 4")
	}
	if c.WorkerPollInterval < 100*time.Millisecond {
		return fmt.Errorf("image worker poll interval must be at least 100ms")
	}
	if c.WorkerLeaseDuration <= c.GenerationTimeout {
		return fmt.Errorf("image worker lease duration must be longer than generation timeout")
	}

	switch c.GeneratorDriver {
	case defaultImageGeneratorDriver:
		return nil
	case "comfyui":
		return c.validateComfyUI()
	case "openrouter":
		return c.validateOpenRouter()
	default:
		return fmt.Errorf("unsupported image generator driver: %q", c.GeneratorDriver)
	}
}

func (c ImageConfig) validateComfyUI() error {
	if strings.TrimSpace(c.ComfyUIBaseURL) == "" {
		return fmt.Errorf("comfyui base URL must be set when image generator driver is comfyui")
	}
	if _, err := comfyui.NewClient(c.ComfyUIBaseURL); err != nil {
		return fmt.Errorf("validate comfyui base URL: %w", err)
	}
	if strings.TrimSpace(c.ComfyUIWorkflowPath) == "" {
		return fmt.Errorf("comfyui workflow path must not be empty")
	}
	if strings.TrimSpace(c.ComfyUIManifestPath) == "" {
		return fmt.Errorf("comfyui manifest path must not be empty")
	}
	if _, err := comfyui.NewWorkflow(c.ComfyUIWorkflowPath, c.ComfyUIManifestPath); err != nil {
		return fmt.Errorf("validate comfyui workflow: %w", err)
	}

	return nil
}

func (c ImageConfig) validateOpenRouter() error {
	if strings.TrimSpace(c.OpenRouterAPIKey) == "" {
		return errors.New("openrouter api key must be set when image generator driver is openrouter")
	}
	model := strings.TrimSpace(c.OpenRouterImageModel)
	if model == "" {
		return errors.New("openrouter image model must be set when image generator driver is openrouter")
	}
	if strings.HasPrefix(model, "~") {
		return errors.New("openrouter image model must be a model id without leading '~'")
	}
	if strings.HasPrefix(model, "http://") || strings.HasPrefix(model, "https://") {
		return errors.New("openrouter image model must be a model id, not a url")
	}

	return nil
}

const (
	defaultImageGeneratorDriver = "stub"
)
