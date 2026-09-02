package config

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/caarlos0/env/v10"
)

// 旅程生成（LLM）ドライバ名。
const (
	LLMDriverStub       = "stub"
	LLMDriverOpenAI     = "openai"
	LLMDriverOpenRouter = "openrouter"
)

// LLM は旅程生成の実装を切り替えるドライバ選択情報を保持する。
// WebSearchEnabled は LLM 実装で Web Search ツールを有効化するかを制御する
// （ハルシネーションによる架空の観光地名を減らす目的）。
type LLM struct {
	Driver           string `env:"LLM_DRIVER" envDefault:"stub"`
	WebSearchEnabled bool   `env:"LLM_WEB_SEARCH" envDefault:"false"`
}

// LLMFromEnv は環境変数から LLM ドライバ設定を読み込む。
func LLMFromEnv() (LLM, error) {
	var config LLM
	if err := env.Parse(&config); err != nil {
		return LLM{}, fmt.Errorf("parse llm config: %w", err)
	}
	config.Driver = strings.TrimSpace(config.Driver)
	if config.Driver == "" {
		config.Driver = LLMDriverStub
	}
	switch config.Driver {
	case LLMDriverStub, LLMDriverOpenAI, LLMDriverOpenRouter:
		return config, nil
	default:
		return LLM{}, fmt.Errorf("unsupported LLM_DRIVER: %q", config.Driver)
	}
}

// OpenAI は OpenAI クライアントの生成に必要な設定。API キーは環境変数経由でのみ注入する。
type OpenAI struct {
	APIKey string `env:"OPENAI_API_KEY"`
	Model  string `env:"OPENAI_MODEL" envDefault:"gpt-4o-mini"`
}

// OpenAIFromEnv は環境変数から OpenAI 設定を読み込み、必須値を検証する。
func OpenAIFromEnv() (OpenAI, error) {
	var config OpenAI
	if err := env.Parse(&config); err != nil {
		return OpenAI{}, fmt.Errorf("parse openai config: %w", err)
	}
	config.APIKey = strings.TrimSpace(config.APIKey)
	config.Model = strings.TrimSpace(config.Model)
	if err := config.Validate(); err != nil {
		return OpenAI{}, fmt.Errorf("invalid openai config: %w", err)
	}
	return config, nil
}

// Validate は API キーとモデル名が設定されていることを検証する。
func (c OpenAI) Validate() error {
	if c.APIKey == "" {
		return errors.New("openai api key must not be empty")
	}
	if c.Model == "" {
		return errors.New("openai model must not be empty")
	}
	return nil
}

// DefaultOpenRouterRequestTimeout は OpenRouter 旅程生成のリクエストタイムアウト既定値。
const DefaultOpenRouterRequestTimeout = 60 * time.Second

// OpenRouter は OpenRouter で旅程を生成するための設定。
type OpenRouter struct {
	APIKey         string        `env:"OPENROUTER_API_KEY"`
	Model          string        `env:"OPENROUTER_MODEL"`
	RequestTimeout time.Duration `env:"OPENROUTER_REQUEST_TIMEOUT"`
}

// OpenRouterFromEnv は環境変数から OpenRouter 設定を読み込み、必須値を検証する。
func OpenRouterFromEnv() (OpenRouter, error) {
	var config OpenRouter
	if err := env.Parse(&config); err != nil {
		return OpenRouter{}, fmt.Errorf("parse openrouter config: %w", err)
	}
	config.APIKey = strings.TrimSpace(config.APIKey)
	config.Model = strings.TrimSpace(config.Model)
	if config.RequestTimeout == 0 {
		config.RequestTimeout = DefaultOpenRouterRequestTimeout
	}
	if err := config.Validate(); err != nil {
		return OpenRouter{}, fmt.Errorf("invalid openrouter config: %w", err)
	}
	return config, nil
}

// Validate は API キー、モデル ID、タイムアウトを検証する。
func (c OpenRouter) Validate() error {
	if c.APIKey == "" {
		return errors.New("openrouter api key must not be empty")
	}
	if err := validateOpenRouterModel(c.Model, "openrouter model"); err != nil {
		return err
	}
	if c.RequestTimeout <= 0 {
		return errors.New("openrouter request timeout must be greater than zero")
	}
	return nil
}
