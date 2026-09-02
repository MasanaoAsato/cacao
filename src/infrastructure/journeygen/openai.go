package journeygen

import (
	"cacao/src/infrastructure/config"
	"context"
	"fmt"

	"cacao/src/domain/entity"
	"cacao/src/domain/service"
	"cacao/src/infrastructure/journeygen/journeyprompt"

	"github.com/openai/openai-go/v3"
	"github.com/openai/openai-go/v3/option"
	"github.com/openai/openai-go/v3/responses"
)

// NewOpenAIClient は OpenAI の公式 SDK クライアントを生成する。
// 設定は config.OpenAI（環境変数由来）を用い、API Key の手渡しは行わない（設計書 §6準拠）。
func NewOpenAIClient(cfg config.OpenAI) openai.Client {
	return openai.NewClient(option.WithAPIKey(cfg.APIKey))
}

// OpenAIGenerator は OpenAI Responses API を用いる JourneyGenerator 実装。
// ドメイン層の service.JourneyGenerator interface を満たし、main.go（Composition Root）でスタブ実装と切り替えて注入する（設計書 §8）。
//
// webSearchEnabled が true のとき Web Search ツールを有効化し、ハルシネーション（架空の観光地名）を低減する。
// LLMConfig.WebSearchEnabled 経由で LLM_WEB_SEARCH 環境変数から制御される。
type OpenAIGenerator struct {
	client           openai.Client
	model            openai.ChatModel
	webSearchEnabled bool
}

// OpenAIGenerator がドメイン層の interface を満たすことをコンパイル時に保証する。
var _ service.JourneyGenerator = (*OpenAIGenerator)(nil)

// NewOpenAIGenerator は OpenAIGenerator を生成する。
// client は NewOpenAIClient で生成した完成済みのものを受け取る（API Key の手渡しは行わない、設計書 §6 準拠）。
// model は文字列で受け取り SDK の ChatModel 型へキャストする。
// （openai.ChatModel は shared.ChatModel のエイリアスで、実体は string の typedef）
// webSearchEnabled は Responses API の Web Search ツールを有効化するかを制御する。
func NewOpenAIGenerator(client openai.Client, model string, webSearchEnabled bool) *OpenAIGenerator {
	return &OpenAIGenerator{
		client:           client,
		model:            openai.ChatModel(model),
		webSearchEnabled: webSearchEnabled,
	}
}

// Generate は JourneyRequest をプロンプト化し、OpenAI Responses API に問い合わせ、
// 応答 JSON を service.GeneratedRoute へパースして返す。
// 処理の流れ:
//  1. journeyprompt.BuildJourneyPrompt(request) でユーザープロンプトを組み立てる
//  2. g.client.Responses.New(ctx, params) に Structured Outputs（json_schema）を指定して問い合わせる
//  3. journeyprompt.ParseGeneratedRoute(resp.OutputText(), request) でパース・検証する
//
// なお JSON モード（json_object）は Web Search ツールと併用できない（API が 400 を返す）ため、
// 併用可能な Structured Outputs（json_schema）を採用している。
func (g *OpenAIGenerator) Generate(ctx context.Context, request entity.JourneyRequest) (service.GeneratedRoute, error) {
	userInput, err := journeyprompt.BuildJourneyPrompt(request)
	if err != nil {
		return service.GeneratedRoute{}, fmt.Errorf("build prompt: %w", err)
	}

	// strict: true でスキーマ準拠を保証させる。スキーマはプロンプトの出力形式と
	// 一体で管理するため prompt パッケージから取得する。
	jsonSchema := responses.ResponseFormatTextJSONSchemaConfigParam{
		Name:        "journey_route",
		Description: openai.String("条件に合う旅行の旅程。days に日ごとのスポット一覧を格納する。"),
		Schema:      journeyprompt.RouteJSONSchema(),
		Strict:      openai.Bool(true),
	}
	params := responses.ResponseNewParams{
		Instructions: openai.String(journeyprompt.SystemInstruction()),
		Input:        responses.ResponseNewParamsInputUnion{OfString: openai.String(userInput)},
		Model:        g.model,
		Text: responses.ResponseTextConfigParam{
			Format: responses.ResponseFormatTextConfigUnionParam{
				OfJSONSchema: &jsonSchema,
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

	route, err := journeyprompt.ParseGeneratedRoute(resp.OutputText(), request)
	if err != nil {
		return service.GeneratedRoute{}, fmt.Errorf("parse generated route: %w", err)
	}
	return route, nil
}
