package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"cacao/src/domain/entity"
	"cacao/src/domain/service"
	"cacao/src/infrastructure/service/prompt"

	openrouter "github.com/OpenRouterTeam/go-sdk"
	"github.com/OpenRouterTeam/go-sdk/models/components"
	"github.com/OpenRouterTeam/go-sdk/models/operations"
	sdkerrors "github.com/OpenRouterTeam/go-sdk/models/sdkerrors"
	"github.com/OpenRouterTeam/go-sdk/optionalnullable"
	"github.com/OpenRouterTeam/go-sdk/retry"
	"github.com/caarlos0/env/v10"
)

const defaultOpenRouterRequestTimeout = 60 * time.Second

// OpenRouterConfig は OpenRouter クライアントの生成に必要な設定を保持する。
type OpenRouterConfig struct {
	APIKey         string
	Model          string
	RequestTimeout time.Duration
}

type openRouterConfigEnv struct {
	APIKey         string        `env:"OPENROUTER_API_KEY"`
	Model          string        `env:"OPENROUTER_MODEL"`
	RequestTimeout time.Duration `env:"OPENROUTER_REQUEST_TIMEOUT" envDefault:"60s"`
}

// OpenRouterConfigFromEnv は環境変数から OpenRouter 用設定を読み込み、必須値を検証する。
func OpenRouterConfigFromEnv() (OpenRouterConfig, error) {
	var raw openRouterConfigEnv
	if err := env.Parse(&raw); err != nil {
		return OpenRouterConfig{}, fmt.Errorf("failed parse openrouter config env: %w", err)
	}

	config := OpenRouterConfig{
		APIKey:         strings.TrimSpace(raw.APIKey),
		Model:          strings.TrimSpace(raw.Model),
		RequestTimeout: raw.RequestTimeout,
	}
	if err := config.validate(); err != nil {
		return OpenRouterConfig{}, fmt.Errorf("invalid openrouter config: %w", err)
	}

	return config, nil
}

func (c OpenRouterConfig) validate() error {
	if c.APIKey == "" {
		return errors.New("openrouter api key must not be empty")
	}
	if c.Model == "" {
		return errors.New("openrouter model must not be empty")
	}
	if strings.HasPrefix(c.Model, "~") {
		return errors.New("openrouter model must be a model ID without a leading '~'")
	}
	if strings.HasPrefix(c.Model, "http://") || strings.HasPrefix(c.Model, "https://") {
		return errors.New("openrouter model must be a model ID, not a URL")
	}
	if c.RequestTimeout <= 0 {
		return errors.New("openrouter request timeout must be greater than zero")
	}
	return nil
}

type openRouterChatClient interface {
	Send(
		ctx context.Context,
		chatRequest components.ChatRequest,
		xOpenRouterMetadata *components.MetadataLevel,
		opts ...operations.Option,
	) (*operations.SendChatCompletionRequestResponse, error)
}

// JourneyGeneratorOpenRouter は OpenRouter Chat Completions API を用いる JourneyGenerator 実装。
type JourneyGeneratorOpenRouter struct {
	client             openRouterChatClient
	config             OpenRouterConfig
	isWebSearchEnabled bool
	logger             *slog.Logger
}

// NewJourneyGeneratorOpenRouter は公式SDKを利用する本番用の旅程生成器を生成する。
func NewJourneyGeneratorOpenRouter(
	config OpenRouterConfig,
	isWebSearchEnabled bool,
) *JourneyGeneratorOpenRouter {
	return newJourneyGeneratorOpenRouter(
		newOpenRouterChatClient(config),
		config,
		isWebSearchEnabled,
		slog.Default(),
	)
}

func newOpenRouterChatClient(config OpenRouterConfig) openRouterChatClient {
	retryConfig := retry.Config{Strategy: "none"}
	httpClient := &http.Client{Timeout: config.RequestTimeout}

	return openrouter.New(
		openrouter.WithServer(openrouter.ServerProduction),
		openrouter.WithSecurity(config.APIKey),
		openrouter.WithClient(httpClient),
		openrouter.WithTimeout(config.RequestTimeout),
		openrouter.WithRetryConfig(retryConfig),
	).Chat
}

func newJourneyGeneratorOpenRouter(
	client openRouterChatClient,
	config OpenRouterConfig,
	isWebSearchEnabled bool,
	logger *slog.Logger,
) *JourneyGeneratorOpenRouter {
	if logger == nil {
		logger = slog.Default()
	}
	return &JourneyGeneratorOpenRouter{
		client:             client,
		config:             config,
		isWebSearchEnabled: isWebSearchEnabled,
		logger:             logger,
	}
}

// Generate は OpenRouter に旅程生成を依頼し、応答を GeneratedRoute に変換する。
func (g *JourneyGeneratorOpenRouter) Generate(
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
			attrs = append(attrs,
				"error_type", fmt.Sprintf("%T", err),
				"error", safeOpenRouterErrorMessage(err),
			)
			logger.ErrorContext(ctx, "openrouter journey generation failed", attrs...)
			return
		}
		logger.InfoContext(ctx, "openrouter journey generation succeeded", attrs...)
	}()

	if err := g.config.validate(); err != nil {
		return service.GeneratedRoute{}, fmt.Errorf("openrouter config: %w", err)
	}
	if g.client == nil {
		return service.GeneratedRoute{}, errors.New("openrouter chat client must not be nil")
	}

	userInput, err := prompt.BuildJourneyPrompt(request)
	if err != nil {
		return service.GeneratedRoute{}, fmt.Errorf("build prompt: %w", err)
	}

	requestCtx, cancel := context.WithTimeout(ctx, g.config.RequestTimeout)
	defer cancel()
	response, err := g.client.Send(
		requestCtx,
		g.buildRequest(userInput),
		nil,
		operations.WithRetries(retry.Config{Strategy: "none"}),
		operations.WithOperationTimeout(g.config.RequestTimeout),
	)
	if err != nil {
		return service.GeneratedRoute{}, newOpenRouterRequestError(err, g.config.APIKey)
	}
	if response == nil || response.ChatResult == nil {
		return service.GeneratedRoute{}, errors.New("openrouter response must contain chat result")
	}
	if len(response.ChatResult.Choices) == 0 {
		return service.GeneratedRoute{}, errors.New("openrouter response contains no choices")
	}

	content, err := chatAssistantContentString(response.ChatResult.Choices[0].Message.Content)
	if err != nil {
		return service.GeneratedRoute{}, err
	}

	route, err = prompt.ParseGeneratedRoute(content, request)
	if err != nil {
		return service.GeneratedRoute{}, fmt.Errorf("parse generated route: %w", err)
	}
	return route, nil
}

func (g *JourneyGeneratorOpenRouter) buildRequest(userInput string) components.ChatRequest {
	messages := []components.ChatMessages{
		components.CreateChatMessagesSystem(components.ChatSystemMessage{
			Role:    components.ChatSystemMessageRoleSystem,
			Content: components.CreateChatSystemMessageContentStr(prompt.SystemInstruction()),
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
			Schema: prompt.RouteJSONSchema(),
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
		return "", errors.New("openrouter response contains empty message content")
	}
	if contentValue.Str == nil {
		return "", errors.New("openrouter response message content must be a string")
	}
	if strings.TrimSpace(*contentValue.Str) == "" {
		return "", errors.New("openrouter response contains empty message content")
	}
	return *contentValue.Str, nil
}

type openRouterRequestError struct {
	cause   error
	message string
}

func (e *openRouterRequestError) Error() string {
	return e.message
}

func (e *openRouterRequestError) Unwrap() error {
	return e.cause
}

func newOpenRouterRequestError(cause error, secret string) error {
	message := safeOpenRouterErrorMessage(cause)
	if secret != "" {
		message = strings.ReplaceAll(message, secret, "[REDACTED]")
	}
	return &openRouterRequestError{
		cause:   cause,
		message: "openrouter request failed: " + message,
	}
}

func safeOpenRouterErrorMessage(err error) string {
	if err == nil {
		return ""
	}
	var requestErr *openRouterRequestError
	if errors.As(err, &requestErr) {
		return sanitizeOpenRouterLogValue(requestErr.message)
	}
	if errors.Is(err, context.DeadlineExceeded) {
		return "request timed out"
	}
	if errors.Is(err, context.Canceled) {
		return "request canceled"
	}

	var apiErr *sdkerrors.APIError
	if errors.As(err, &apiErr) {
		return sanitizeOpenRouterLogValue(apiErr.Message)
	}

	var envelope struct {
		Error struct {
			Message string `json:"message"`
		} `json:"error"`
	}
	if json.Unmarshal([]byte(err.Error()), &envelope) == nil && envelope.Error.Message != "" {
		return sanitizeOpenRouterLogValue(envelope.Error.Message)
	}

	return "sdk request failed"
}

func sanitizeOpenRouterLogValue(value string) string {
	value = strings.Join(strings.Fields(value), " ")
	if len(value) > 512 {
		return value[:512]
	}
	if value == "" {
		return "unknown error"
	}
	return value
}

var _ service.JourneyGenerator = (*JourneyGeneratorOpenRouter)(nil)
