package config

import (
	"errors"
	"fmt"
	"net/url"
	"strings"
	"time"

	"github.com/caarlos0/env/v10"
)

// 旅程生成（LLM）ドライバ名。
const (
	LLMDriverStub       = "stub"
	LLMDriverOpenAI     = "openai"
	LLMDriverOpenRouter = "openrouter"
	LLMDriverOllama     = "ollama"
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
	case LLMDriverStub, LLMDriverOpenAI, LLMDriverOpenRouter, LLMDriverOllama:
		return config, nil
	default:
		return LLM{}, fmt.Errorf("unsupported LLM_DRIVER: %q", config.Driver)
	}
}

const (
	DefaultOllamaBaseURL         = "http://127.0.0.1:11434"
	DefaultOllamaRequestTimeout  = 180 * time.Second
	DefaultSearXNGBaseURL        = "http://127.0.0.1:8888"
	DefaultSearXNGRequestTimeout = 10 * time.Second
	DefaultSearXNGResultLimit    = 5
	MinSearXNGResultLimit        = 1
	MaxSearXNGResultLimit        = 10
)

// Ollama はローカルの Ollama Chat API を使うための設定。
type Ollama struct {
	BaseURL        string        `env:"OLLAMA_BASE_URL" envDefault:"http://127.0.0.1:11434"`
	Model          string        `env:"OLLAMA_MODEL"`
	Think          bool          `env:"OLLAMA_THINK" envDefault:"false"`
	RequestTimeout time.Duration `env:"OLLAMA_REQUEST_TIMEOUT"`
}

// OllamaFromEnv は環境変数から Ollama 設定を読み込み、構文を検証する。
func OllamaFromEnv() (Ollama, error) {
	var config Ollama
	if err := env.Parse(&config); err != nil {
		return Ollama{}, fmt.Errorf("parse ollama config: %w", err)
	}
	if config.RequestTimeout == 0 {
		config.RequestTimeout = DefaultOllamaRequestTimeout
	}
	config.BaseURL = strings.TrimSpace(config.BaseURL)
	config.Model = strings.TrimSpace(config.Model)
	if err := config.Validate(); err != nil {
		return Ollama{}, fmt.Errorf("invalid ollama config: %w", err)
	}
	return config, nil
}

// Validate は Ollama の接続先、モデル、タイムアウトを検証する。
func (c *Ollama) Validate() error {
	baseURL, err := normalizeHTTPBaseURL(c.BaseURL, "ollama base URL")
	if err != nil {
		return err
	}
	c.BaseURL = baseURL
	if c.Model == "" {
		return errors.New("ollama model must not be empty")
	}
	if c.RequestTimeout <= 0 {
		return errors.New("ollama request timeout must be greater than zero")
	}
	return nil
}

// SearXNG はローカル SearXNG JSON API の設定。
type SearXNG struct {
	BaseURL        string        `env:"SEARXNG_BASE_URL" envDefault:"http://127.0.0.1:8888"`
	RequestTimeout time.Duration `env:"SEARXNG_REQUEST_TIMEOUT"`
	ResultLimit    int           `env:"SEARXNG_RESULT_LIMIT" envDefault:"5"`
}

// SearXNGFromEnv は環境変数から SearXNG 設定を読み込み、構文を検証する。
func SearXNGFromEnv() (SearXNG, error) {
	var config SearXNG
	if err := env.Parse(&config); err != nil {
		return SearXNG{}, fmt.Errorf("parse searxng config: %w", err)
	}
	if config.RequestTimeout == 0 {
		config.RequestTimeout = DefaultSearXNGRequestTimeout
	}
	config.BaseURL = strings.TrimSpace(config.BaseURL)
	if err := config.Validate(); err != nil {
		return SearXNG{}, fmt.Errorf("invalid searxng config: %w", err)
	}
	return config, nil
}

// Validate は SearXNG の接続先、タイムアウト、結果件数を検証する。
func (c *SearXNG) Validate() error {
	baseURL, err := normalizeHTTPBaseURL(c.BaseURL, "searxng base URL")
	if err != nil {
		return err
	}
	c.BaseURL = baseURL
	if c.RequestTimeout <= 0 {
		return errors.New("searxng request timeout must be greater than zero")
	}
	if c.ResultLimit < MinSearXNGResultLimit || c.ResultLimit > MaxSearXNGResultLimit {
		return fmt.Errorf(
			"searxng result limit must be between %d and %d",
			MinSearXNGResultLimit,
			MaxSearXNGResultLimit,
		)
	}
	return nil
}

func normalizeHTTPBaseURL(rawURL, label string) (string, error) {
	parsed, err := url.Parse(strings.TrimSpace(rawURL))
	if err != nil {
		return "", fmt.Errorf("%s is invalid: %w", label, err)
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return "", fmt.Errorf("%s must use http or https", label)
	}
	if parsed.Host == "" {
		return "", fmt.Errorf("%s must have a host", label)
	}
	if parsed.User != nil || parsed.RawQuery != "" || parsed.Fragment != "" {
		return "", fmt.Errorf("%s must not contain userinfo, query, or fragment", label)
	}
	if parsed.Path != "" && parsed.Path != "/" {
		return "", fmt.Errorf("%s must not contain a path", label)
	}
	parsed.Path = ""
	return strings.TrimSuffix(parsed.String(), "/"), nil
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
