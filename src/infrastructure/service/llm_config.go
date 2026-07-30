package service

import (
	"fmt"

	"github.com/caarlos0/env/v10"
)

// LLMConfig は旅程生成の実装を切り替えるドライバ選択情報を保持する。
// main.go の Composition Root で参照し、LLM_DRIVER で実装を選択する（設計書 §8）。
// "openai" のとき OpenAI 本番実装、"stub" のときスタブ実装を使用する。
// 未設定時は envDefault により "stub" となり、API Key なしのローカル開発でも動作する。
//
// WebSearchEnabled は OpenAI 実装時に Responses API の Web Search ツールを有効化するかを制御する。
// ハルシネーション（架空の観光地名）を減らすために使用する。
// "1"/"true" で有効、それ以外は無効。未設定時は envDefault により無効。
type LLMConfig struct {
	Driver          string `env:"LLM_DRIVER"          envDefault:"stub"`
	WebSearchEnabled bool  `env:"LLM_WEB_SEARCH"  envDefault:"false"`
}

// LLMConfigFromEnv は環境変数から LLM ドライバ設定をパースして返す。
// database.ConfigFromEnv / OpenAIConfigFromEnv と同じパターンを採用し、
// main.go の Composition Root で呼ぶ。未設定時は envDefault により "stub" となる。
func LLMConfigFromEnv() (LLMConfig, error) {
	var cfg LLMConfig
	if err := env.Parse(&cfg); err != nil {
		return LLMConfig{}, fmt.Errorf("failed to parse llm config from env: %w", err)
	}
	return cfg, nil
}
