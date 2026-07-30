package service

import (
	"context"
	"fmt"

	"cacao/src/domain/entity"
	"cacao/src/domain/service"
	"cacao/src/infrastructure/service/prompt"

	"github.com/caarlos0/env/v10"
	"github.com/openai/openai-go/v3"
	"github.com/openai/openai-go/v3/option"
	"github.com/openai/openai-go/v3/responses"
	"github.com/openai/openai-go/v3/shared"
)

// OpenAIConfig は OpenAI クライアントの生成に必要な設定を環境変数から読み込む。
// 設計書 §6（Secret 管理方針）に準拠し、API Key とモデル名は環境変数経由で注入する。
type OpenAIConfig struct {
	APIKey string `env:"OPENAI_API_KEY"`
	Model  string `env:"OPENAI_MODEL"     envDefault:"gpt-4o-mini"`
}

// OpenAIConfigFromEnv は環境変数から OpenAI 用設定をパースして返す。
// database.ConfigFromEnv と同じパターンを採用し、main.go の Composition Root で呼ぶ。
func OpenAIConfigFromEnv() (OpenAIConfig, error) {
	var cfg OpenAIConfig
	if err := env.Parse(&cfg); err != nil {
		return OpenAIConfig{}, fmt.Errorf("failed to parse openai config from env: %w", err)
	}
	return cfg, nil
}

// NewOpenAIClient は OpenAI の公式 SDK クライアントを生成する。
// 設定は OpenAIConfig（環境変数由来）を用い、API Key の手渡しは行わない（設計書 §6準拠）。
func NewOpenAIClient(cfg OpenAIConfig) openai.Client {
	return openai.NewClient(option.WithAPIKey(cfg.APIKey))
}

// JourneyGeneratorOpenAI は OpenAI Responses API を用いる JourneyGenerator 実装。
// ドメイン層の service.JourneyGenerator interface を満たし、main.go（Composition Root）でスタブ実装と切り替えて注入する（設計書 §8）。
//
// webSearchEnabled が true のとき Web Search ツールを有効化し、ハルシネーション（架空の観光地名）を低減する。
// LLMConfig.WebSearchEnabled 経由で LLM_WEB_SEARCH 環境変数から制御される。
type JourneyGeneratorOpenAI struct {
	client           openai.Client
	model            openai.ChatModel
	webSearchEnabled bool
}

// JourneyGeneratorOpenAI がドメイン層の interface を満たすことをコンパイル時に保証する。
var _ service.JourneyGenerator = (*JourneyGeneratorOpenAI)(nil)

// NewJourneyGeneratorOpenAI は JourneyGeneratorOpenAI を生成する。
// client は NewOpenAIClient で生成した完成済みのものを受け取る（API Key の手渡しは行わない、設計書 §6 準拠）。
// model は文字列で受け取り SDK の ChatModel 型へキャストする。
// （openai.ChatModel は shared.ChatModel のエイリアスで、実体は string の typedef）
// webSearchEnabled は Responses API の Web Search ツールを有効化するかを制御する。
func NewJourneyGeneratorOpenAI(client openai.Client, model string, webSearchEnabled bool) *JourneyGeneratorOpenAI {
	return &JourneyGeneratorOpenAI{
		client:           client,
		model:            openai.ChatModel(model),
		webSearchEnabled: webSearchEnabled,
	}
}

// Generate は JourneyRequest をプロンプト化し、OpenAI Responses API に問い合わせ、
// 応答 JSON を service.GeneratedRoute へパースして返す。
// 処理の流れ:
//  1. prompt.BuildJourneyPrompt(request) でユーザープロンプトを組み立てる
//  2. g.client.Responses.New(ctx, params) に JSON モード（json_object）を指定して問い合わせる
//  3. prompt.ParseGeneratedRoute(resp.OutputText(), request) でパース・検証する
func (g *JourneyGeneratorOpenAI) Generate(ctx context.Context, request entity.JourneyRequest) (service.GeneratedRoute, error) {
	userInput, err := prompt.BuildJourneyPrompt(request)
	if err != nil {
		return service.GeneratedRoute{}, fmt.Errorf("build prompt: %w", err)
	}

	jsonObject := shared.NewResponseFormatJSONObjectParam()
	params := responses.ResponseNewParams{
		Instructions: openai.String(prompt.SystemInstruction()),
		Input:        responses.ResponseNewParamsInputUnion{OfString: openai.String(userInput)},
		Model:        g.model,
		Text: responses.ResponseTextConfigParam{
			Format: responses.ResponseFormatTextConfigUnionParam{
				OfJSONObject: &jsonObject,
			},
		},
	}

	// Web Search を有効化すると LLM が検索結果を踏まえて実在する観光地・施設名を回答に含めやすくなる。
	// SearchContextSize はデフォルトの medium（コストと精度のバランス）を採用する。
	if g.webSearchEnabled {
		params.Tools = []responses.ToolUnionParam{
			responses.ToolParamOfWebSearch(responses.WebSearchToolTypeWebSearch),
		}
	}

	resp, err := g.client.Responses.New(ctx, params)
	if err != nil {
		return service.GeneratedRoute{}, fmt.Errorf("openai responses: %w", err)
	}

	route, err := prompt.ParseGeneratedRoute(resp.OutputText(), request)
	if err != nil {
		return service.GeneratedRoute{}, fmt.Errorf("parse generated route: %w", err)
	}
	return route, nil
}
