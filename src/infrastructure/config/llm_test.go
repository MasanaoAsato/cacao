package config

import (
	"strings"
	"testing"
	"time"
)

func TestLLMFromEnv(t *testing.T) {
	t.Run("正常系: 未設定時は stub / WebSearch 無効", func(t *testing.T) {
		t.Setenv("LLM_DRIVER", "")
		t.Setenv("LLM_WEB_SEARCH", "")

		config, err := LLMFromEnv()
		if err != nil {
			t.Fatalf("LLMFromEnv() error = %v", err)
		}
		if config.Driver != LLMDriverStub || config.WebSearchEnabled {
			t.Errorf("config = %+v, want stub without web search", config)
		}
	})

	t.Run("正常系: openai ドライバで WebSearch 有効化", func(t *testing.T) {
		t.Setenv("LLM_DRIVER", "openai")
		t.Setenv("LLM_WEB_SEARCH", "true")

		config, err := LLMFromEnv()
		if err != nil {
			t.Fatalf("LLMFromEnv() error = %v", err)
		}
		if config.Driver != LLMDriverOpenAI || !config.WebSearchEnabled {
			t.Errorf("config = %+v", config)
		}
	})

	t.Run("境界値系: LLM_WEB_SEARCH=0 は無効", func(t *testing.T) {
		t.Setenv("LLM_DRIVER", "openrouter")
		t.Setenv("LLM_WEB_SEARCH", "0")

		config, err := LLMFromEnv()
		if err != nil {
			t.Fatalf("LLMFromEnv() error = %v", err)
		}
		if config.Driver != LLMDriverOpenRouter || config.WebSearchEnabled {
			t.Errorf("config = %+v", config)
		}
	})

	t.Run("異常系: 未対応ドライバ", func(t *testing.T) {
		t.Setenv("LLM_DRIVER", "gemini")
		if _, err := LLMFromEnv(); err == nil {
			t.Fatal("LLMFromEnv() error = nil, want error")
		}
	})
}

func TestOpenAIFromEnv(t *testing.T) {
	t.Run("正常系: 既定モデル", func(t *testing.T) {
		t.Setenv("OPENAI_API_KEY", " sk-test ")
		t.Setenv("OPENAI_MODEL", "")

		config, err := OpenAIFromEnv()
		if err != nil {
			t.Fatalf("OpenAIFromEnv() error = %v", err)
		}
		if config.APIKey != "sk-test" || config.Model != "gpt-4o-mini" {
			t.Errorf("config = %+v", config)
		}
	})

	t.Run("異常系: API キー欠落", func(t *testing.T) {
		t.Setenv("OPENAI_API_KEY", "")
		if _, err := OpenAIFromEnv(); err == nil {
			t.Fatal("OpenAIFromEnv() error = nil, want error")
		}
	})
}

func TestOpenRouterFromEnv(t *testing.T) {
	const apiKey = "test-openrouter-api-key"

	t.Run("正常系: すべて設定", func(t *testing.T) {
		t.Setenv("OPENROUTER_API_KEY", apiKey)
		t.Setenv("OPENROUTER_MODEL", "openai/gpt-4o-mini")
		t.Setenv("OPENROUTER_REQUEST_TIMEOUT", "250ms")

		config, err := OpenRouterFromEnv()
		if err != nil {
			t.Fatalf("OpenRouterFromEnv() error = %v", err)
		}
		if config.APIKey != apiKey || config.Model != "openai/gpt-4o-mini" || config.RequestTimeout != 250*time.Millisecond {
			t.Errorf("config = %+v", config)
		}
	})

	t.Run("正常系: タイムアウト未設定は既定値", func(t *testing.T) {
		t.Setenv("OPENROUTER_API_KEY", apiKey)
		t.Setenv("OPENROUTER_MODEL", "openai/gpt-4o-mini")
		t.Setenv("OPENROUTER_REQUEST_TIMEOUT", "")

		config, err := OpenRouterFromEnv()
		if err != nil {
			t.Fatalf("OpenRouterFromEnv() error = %v", err)
		}
		if config.RequestTimeout != DefaultOpenRouterRequestTimeout {
			t.Errorf("RequestTimeout = %s, want %s", config.RequestTimeout, DefaultOpenRouterRequestTimeout)
		}
	})

	tests := []struct {
		name    string
		apiKey  string
		model   string
		timeout string
		want    string
	}{
		{name: "異常系: API キー欠落", apiKey: "", model: "openai/gpt-4o-mini", timeout: "1s", want: "api key"},
		{name: "異常系: モデル欠落", apiKey: apiKey, model: "", timeout: "1s", want: "model"},
		{name: "異常系: モデルが URL", apiKey: apiKey, model: "https://openrouter.ai/z-ai/glm-5.2:free", timeout: "1s", want: "not a url"},
		{name: "異常系: モデルが ~ 始まり", apiKey: apiKey, model: "~z-ai/glm-5.2:free", timeout: "1s", want: "leading"},
		{name: "異常系: タイムアウトが不正", apiKey: apiKey, model: "openai/gpt-4o-mini", timeout: "not-duration", want: "parse openrouter config"},
		{name: "境界値系: タイムアウトが負", apiKey: apiKey, model: "openai/gpt-4o-mini", timeout: "-1s", want: "timeout"},
	}
	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			t.Setenv("OPENROUTER_API_KEY", testCase.apiKey)
			t.Setenv("OPENROUTER_MODEL", testCase.model)
			t.Setenv("OPENROUTER_REQUEST_TIMEOUT", testCase.timeout)

			_, err := OpenRouterFromEnv()
			if err == nil {
				t.Fatal("OpenRouterFromEnv() error = nil, want error")
			}
			if !strings.Contains(err.Error(), testCase.want) {
				t.Errorf("error = %q, want message containing %q", err, testCase.want)
			}
			if strings.Contains(err.Error(), apiKey) {
				t.Error("error contains API key")
			}
		})
	}
}
