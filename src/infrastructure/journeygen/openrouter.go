package journeygen

import (
	"cacao/src/infrastructure/config"
	"cacao/src/infrastructure/openrouterclient"
	"context"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"cacao/src/domain/entity"
	"cacao/src/domain/service"
	"cacao/src/infrastructure/journeygen/journeyprompt"
	"cacao/src/observability"

	openrouter "github.com/OpenRouterTeam/go-sdk"
	"github.com/OpenRouterTeam/go-sdk/models/components"
	"github.com/OpenRouterTeam/go-sdk/models/operations"
	"github.com/OpenRouterTeam/go-sdk/optionalnullable"
)

type openRouterChatClient interface {
	Send(
		ctx context.Context,
		chatRequest components.ChatRequest,
		xOpenRouterMetadata *components.MetadataLevel,
		opts ...operations.Option,
	) (*operations.SendChatCompletionRequestResponse, error)
}

// OpenRouterGenerator は OpenRouter Chat Completions API を用いる JourneyGenerator 実装。
type OpenRouterGenerator struct {
	client             openRouterChatClient
	config             config.OpenRouter
	isWebSearchEnabled bool
	logger             *slog.Logger
}

// NewOpenRouterGenerator は公式SDKを利用する本番用の旅程生成器を生成する。
func NewOpenRouterGenerator(
	config config.OpenRouter,
	isWebSearchEnabled bool,
) *OpenRouterGenerator {
	return newOpenRouterGenerator(
		openrouterclient.New(config.APIKey, config.RequestTimeout).Chat,
		config,
		isWebSearchEnabled,
		slog.Default(),
	)
}

func newOpenRouterGenerator(
	client openRouterChatClient,
	config config.OpenRouter,
	isWebSearchEnabled bool,
	logger *slog.Logger,
) *OpenRouterGenerator {
	if logger == nil {
		logger = slog.Default()
	}
	return &OpenRouterGenerator{
		client:             client,
		config:             config,
		isWebSearchEnabled: isWebSearchEnabled,
		logger:             logger,
	}
}

// Generate は OpenRouter に旅程生成を依頼し、応答を GeneratedRoute に変換する。
func (g *OpenRouterGenerator) Generate(
	ctx context.Context,
	request entity.JourneyRequest,
) (route service.GeneratedRoute, err error) {
	if g == nil {
		return service.GeneratedRoute{}, errors.New("openrouter generator must not be nil")
	}

	logger := g.logger
	if logger == nil {
		logger = slog.Default()
	}
	startedAt := time.Now()
	requestID := request.ID().String()
	logger.InfoContext(
		ctx,
		"openrouter journey generation started",
		"request_id", requestID,
		"model", g.config.Model,
		"web_search", g.isWebSearchEnabled,
	)
	defer func() {
		attrs := []any{
			"request_id", requestID,
			"model", g.config.Model,
			"web_search", g.isWebSearchEnabled,
			"duration_ms", time.Since(startedAt).Milliseconds(),
		}
		if err != nil {
			return
		}
		logger.InfoContext(ctx, "openrouter journey generation succeeded", attrs...)
	}()

	if err := g.config.Validate(); err != nil {
		return service.GeneratedRoute{}, fmt.Errorf("openrouter config: %w", err)
	}
	if g.client == nil {
		return service.GeneratedRoute{}, errors.New("openrouter chat client must not be nil")
	}

	userInput, err := journeyprompt.BuildJourneyPrompt(request)
	if err != nil {
		return service.GeneratedRoute{}, fmt.Errorf("build prompt: %w", err)
	}

	requestCtx, cancel := context.WithTimeout(ctx, g.config.RequestTimeout)
	defer cancel()
	response, err := g.client.Send(
		requestCtx,
		g.buildRequest(userInput),
		nil,
		operations.WithRetries(openrouterclient.NoRetry()),
		operations.WithOperationTimeout(g.config.RequestTimeout),
	)
	if err != nil {
		return service.GeneratedRoute{}, observability.WithOperation(
			"openrouter_send_chat_completion",
			observability.WithErrorDetail(
				observability.ErrorDetailOpenRouterRequestFailed,
				openrouterclient.WrapRequestError(err),
			),
		)
	}
	if response == nil || response.ChatResult == nil {
		return service.GeneratedRoute{}, observability.WithErrorDetail(
			observability.ErrorDetailOpenRouterResponseMissingChatResult,
			errors.New("openrouter response must contain chat result"),
		)
	}
	if len(response.ChatResult.Choices) == 0 {
		return service.GeneratedRoute{}, observability.WithErrorDetail(
			observability.ErrorDetailOpenRouterResponseNoChoices,
			errors.New("openrouter response contains no choices"),
		)
	}

	content, err := chatAssistantContentString(response.ChatResult.Choices[0].Message.Content)
	if err != nil {
		return service.GeneratedRoute{}, err
	}

	route, err = journeyprompt.ParseGeneratedRoute(content, request)
	if err != nil {
		return service.GeneratedRoute{}, fmt.Errorf(
			"parse generated route: %w",
			observability.WithErrorDetail(observability.ErrorDetailJourneyRouteParseFailed, err),
		)
	}
	return route, nil
}

func (g *OpenRouterGenerator) buildRequest(userInput string) components.ChatRequest {
	messages := []components.ChatMessages{
		components.CreateChatMessagesSystem(components.ChatSystemMessage{
			Role:    components.ChatSystemMessageRoleSystem,
			Content: components.CreateChatSystemMessageContentStr(journeyprompt.SystemInstruction()),
		}),
		components.CreateChatMessagesUser(components.ChatUserMessage{
			Role:    components.ChatUserMessageRoleUser,
			Content: components.CreateChatUserMessageContentStr(userInput),
		}),
	}

	strict := true
	responseFormat := components.CreateResponseFormatJSONSchema(components.ChatFormatJSONSchemaConfig{
		JSONSchema: components.ChatJSONSchemaConfig{
			Name:   "journey_route",
			Schema: journeyprompt.RouteJSONSchema(),
			Strict: optionalnullable.From(&strict),
		},
	})

	var plugins []components.ChatRequestPlugin
	if g.isWebSearchEnabled {
		plugins = append(plugins, components.CreateChatRequestPluginWeb(components.WebSearchPlugin{
			ID: components.WebSearchPluginIDWeb,
		}))
	}

	return components.ChatRequest{
		Model:          openrouter.String(g.config.Model),
		Messages:       messages,
		ResponseFormat: &responseFormat,
		Plugins:        plugins,
	}
}

func chatAssistantContentString(content optionalnullable.OptionalNullable[components.ChatAssistantMessageContent]) (string, error) {
	contentValue, ok := content.Get()
	if !ok || contentValue == nil {
		return "", observability.WithErrorDetail(
			observability.ErrorDetailOpenRouterResponseEmptyMessageContent,
			errors.New("openrouter response contains empty message content"),
		)
	}
	if contentValue.Str == nil {
		return "", observability.WithErrorDetail(
			observability.ErrorDetailOpenRouterResponseMessageContentNotString,
			errors.New("openrouter response message content must be a string"),
		)
	}
	if strings.TrimSpace(*contentValue.Str) == "" {
		return "", observability.WithErrorDetail(
			observability.ErrorDetailOpenRouterResponseEmptyMessageContent,
			errors.New("openrouter response contains empty message content"),
		)
	}
	return *contentValue.Str, nil
}

var _ service.JourneyGenerator = (*OpenRouterGenerator)(nil)
