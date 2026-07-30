package service

import (
	"testing"
)

// setEnv はテスト用に環境変数を設定し、クラーンアップを登録するヘルパー。
func setEnv(t *testing.T, key, value string) {
	t.Helper()
	t.Setenv(key, value)
}

// TestLLMConfigFromEnv は環境変数から LLMConfig をパースするテスト。
// caarlos0/env/v10 は "1"/"true"/"t" を true に、それ以外を false にパースする。
func TestLLMConfigFromEnv(t *testing.T) {
	t.Run("正常系: 未設定時はデフォルト値（stub / WebSearch無効）になる", func(t *testing.T) {
		setEnv(t, "LLM_DRIVER", "")
		setEnv(t, "LLM_WEB_SEARCH", "")

		cfg, err := LLMConfigFromEnv()
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if cfg.Driver != "stub" {
			t.Errorf("expected default driver stub, got %q", cfg.Driver)
		}
		if cfg.WebSearchEnabled {
			t.Errorf("expected default WebSearchEnabled false, got true")
		}
	})

	t.Run("正常系: openai ドライバで WebSearch 有効化", func(t *testing.T) {
		setEnv(t, "LLM_DRIVER", "openai")
		setEnv(t, "LLM_WEB_SEARCH", "true")

		cfg, err := LLMConfigFromEnv()
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if cfg.Driver != "openai" {
			t.Errorf("expected driver openai, got %q", cfg.Driver)
		}
		if !cfg.WebSearchEnabled {
			t.Errorf("expected WebSearchEnabled true, got false")
		}
	})

	t.Run("境界値: LLM_DRIVER=openai で LLM_WEB_SEARCH 未設定なら無効", func(t *testing.T) {
		setEnv(t, "LLM_DRIVER", "openai")
		setEnv(t, "LLM_WEB_SEARCH", "")

		cfg, err := LLMConfigFromEnv()
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if cfg.Driver != "openai" {
			t.Errorf("expected driver openai, got %q", cfg.Driver)
		}
		if cfg.WebSearchEnabled {
			t.Errorf("expected WebSearchEnabled false, got true")
		}
	})

	t.Run("境界値: LLM_WEB_SEARCH=0 なら無効", func(t *testing.T) {
		setEnv(t, "LLM_DRIVER", "openai")
		setEnv(t, "LLM_WEB_SEARCH", "0")

		cfg, err := LLMConfigFromEnv()
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if cfg.WebSearchEnabled {
			t.Errorf("expected WebSearchEnabled false for \"0\", got true")
		}
	})
}
