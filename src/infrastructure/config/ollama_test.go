package config

import (
	"strings"
	"testing"
	"time"
)

func TestOllamaFromEnv(t *testing.T) {
	t.Run("normalizes defaults and trailing slash", func(t *testing.T) {
		t.Setenv("OLLAMA_BASE_URL", " http://127.0.0.1:11434/ ")
		t.Setenv("OLLAMA_MODEL", " llama3.2 ")
		t.Setenv("OLLAMA_REQUEST_TIMEOUT", "")

		config, err := OllamaFromEnv()
		if err != nil {
			t.Fatalf("OllamaFromEnv() error = %v", err)
		}
		if config.BaseURL != DefaultOllamaBaseURL {
			t.Errorf("BaseURL = %q, want %q", config.BaseURL, DefaultOllamaBaseURL)
		}
		if config.Model != "llama3.2" {
			t.Errorf("Model = %q, want llama3.2", config.Model)
		}
		if config.Think {
			t.Error("Think = true, want false by default")
		}
		if config.RequestTimeout != DefaultOllamaRequestTimeout {
			t.Errorf("RequestTimeout = %s, want %s", config.RequestTimeout, DefaultOllamaRequestTimeout)
		}
	})

	tests := []struct {
		name    string
		baseURL string
		model   string
		timeout string
		want    string
	}{
		{name: "missing model", baseURL: DefaultOllamaBaseURL, want: "model"},
		{name: "path is rejected", baseURL: "http://127.0.0.1:11434/api", model: "llama3.2", want: "path"},
		{name: "userinfo is rejected", baseURL: "http://user@127.0.0.1:11434", model: "llama3.2", want: "userinfo"},
		{name: "zero timeout", baseURL: DefaultOllamaBaseURL, model: "llama3.2", timeout: "-1s", want: "timeout"},
	}
	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			t.Setenv("OLLAMA_BASE_URL", testCase.baseURL)
			t.Setenv("OLLAMA_MODEL", testCase.model)
			t.Setenv("OLLAMA_REQUEST_TIMEOUT", testCase.timeout)

			_, err := OllamaFromEnv()
			if err == nil || !strings.Contains(err.Error(), testCase.want) {
				t.Errorf("OllamaFromEnv() error = %v, want %q", err, testCase.want)
			}
		})
	}
}

func TestOllamaFromEnvEnablesThinkingWhenRequested(t *testing.T) {
	t.Setenv("OLLAMA_MODEL", "llama3.2")
	t.Setenv("OLLAMA_THINK", "true")

	config, err := OllamaFromEnv()
	if err != nil {
		t.Fatalf("OllamaFromEnv() error = %v", err)
	}
	if !config.Think {
		t.Error("Think = false, want true")
	}
}

func TestOllamaFromEnvRejectsInvalidThinkingValue(t *testing.T) {
	t.Setenv("OLLAMA_MODEL", "llama3.2")
	t.Setenv("OLLAMA_THINK", "sometimes")

	if _, err := OllamaFromEnv(); err == nil {
		t.Fatal("OllamaFromEnv() error = nil, want invalid boolean error")
	}
}

func TestSearXNGFromEnv(t *testing.T) {
	t.Run("uses defaults", func(t *testing.T) {
		t.Setenv("SEARXNG_BASE_URL", "")
		t.Setenv("SEARXNG_REQUEST_TIMEOUT", "")
		t.Setenv("SEARXNG_RESULT_LIMIT", "")

		config, err := SearXNGFromEnv()
		if err != nil {
			t.Fatalf("SearXNGFromEnv() error = %v", err)
		}
		if config.BaseURL != DefaultSearXNGBaseURL || config.RequestTimeout != DefaultSearXNGRequestTimeout || config.ResultLimit != DefaultSearXNGResultLimit {
			t.Errorf("config = %+v, want defaults", config)
		}
	})

	for _, resultLimit := range []int{MinSearXNGResultLimit, MaxSearXNGResultLimit} {
		t.Run("accepts result limit "+string(rune('0'+resultLimit)), func(t *testing.T) {
			config := SearXNG{BaseURL: DefaultSearXNGBaseURL, RequestTimeout: time.Second, ResultLimit: resultLimit}
			if err := config.Validate(); err != nil {
				t.Errorf("Validate() error = %v", err)
			}
		})
	}

	tests := []SearXNG{
		{BaseURL: DefaultSearXNGBaseURL, RequestTimeout: 0, ResultLimit: 5},
		{BaseURL: DefaultSearXNGBaseURL, RequestTimeout: time.Second, ResultLimit: 0},
		{BaseURL: DefaultSearXNGBaseURL, RequestTimeout: time.Second, ResultLimit: 11},
	}
	for _, testCase := range tests {
		if err := testCase.Validate(); err == nil {
			t.Errorf("Validate(%+v) error = nil, want error", testCase)
		}
	}
}
