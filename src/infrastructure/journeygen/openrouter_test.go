package journeygen

import (
	"bytes"
	"cacao/src/infrastructure/config"
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	openrouter "github.com/OpenRouterTeam/go-sdk"
	"github.com/OpenRouterTeam/go-sdk/models/components"
	"github.com/OpenRouterTeam/go-sdk/models/operations"
	sdkerrors "github.com/OpenRouterTeam/go-sdk/models/sdkerrors"
	"github.com/OpenRouterTeam/go-sdk/optionalnullable"
	"github.com/OpenRouterTeam/go-sdk/retry"

	"cacao/src/observability"
)

const openRouterTestAPIKey = "test-openrouter-api-key"

const openRouterTestRouteJSON = `{"days":[{"date":"2026-08-01","spots":[{"name":"浅草寺","description":"東京最古の寺院","startAt":"2026-08-01T09:00:00+09:00","estimatedCost":{"amount":0,"currency":"JPY"}}],"legs":[{"from":"東京（出発地）","mode":"walk","durationMinutes":1,"cost":{"amount":0,"currency":"JPY"}}]}]}`

func openRouterTestConfig() config.OpenRouter {
	return config.OpenRouter{
		APIKey:         openRouterTestAPIKey,
		Model:          "openai/gpt-4o-mini",
		RequestTimeout: time.Second,
	}
}

func openRouterTestResponse(t *testing.T, content string) []byte {
	t.Helper()
	body, err := json.Marshal(map[string]any{
		"id":      "chatcmpl-test",
		"object":  "chat.completion",
		"created": 1,
		"model":   "openai/gpt-4o-mini",
		"choices": []map[string]any{
			{
				"index":         0,
				"finish_reason": "stop",
				"message": map[string]string{
					"role":    "assistant",
					"content": content,
				},
			},
		},
	})
	if err != nil {
		t.Fatalf("failed to marshal OpenRouter response: %v", err)
	}
	return body
}

func newOpenRouterSDKForTest(server *httptest.Server) *openrouter.OpenRouter {
	return openrouter.New(
		openrouter.WithServerURL(server.URL+"/api/v1"),
		openrouter.WithSecurity(openRouterTestAPIKey),
		openrouter.WithClient(server.Client()),
		openrouter.WithTimeout(time.Second),
		openrouter.WithRetryConfig(retry.Config{Strategy: "none"}),
	)
}

func TestNewOpenRouterGenerator(t *testing.T) {
	generator := NewOpenRouterGenerator(openRouterTestConfig(), true)
	if generator == nil {
		t.Fatal("NewOpenRouterGenerator() returned nil")
	}
	if generator.client == nil {
		t.Fatal("NewOpenRouterGenerator() did not configure SDK chat client")
	}
	if generator.config.RequestTimeout != time.Second {
		t.Errorf("RequestTimeout = %s, want 1s", generator.config.RequestTimeout)
	}
}

func TestOpenRouterGeneratorGenerate(t *testing.T) {
	request := newStubTestJourneyRequest(
		t,
		time.Date(2026, 8, 1, 0, 0, 0, 0, time.UTC),
		time.Date(2026, 8, 1, 0, 0, 0, 0, time.UTC),
		10000,
	)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("method = %s, want %s", r.Method, http.MethodPost)
		}
		if r.URL.Path != "/api/v1/chat/completions" {
			t.Errorf("path = %s, want /api/v1/chat/completions", r.URL.Path)
		}
		if got, want := r.Header.Get("Authorization"), "Bearer "+openRouterTestAPIKey; got != want {
			t.Errorf("Authorization = %q, want %q", got, want)
		}

		var body components.ChatRequest
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Errorf("decode request body: %v", err)
			return
		}
		if body.Model == nil || *body.Model != "openai/gpt-4o-mini" {
			t.Errorf("model = %v, want openai/gpt-4o-mini", body.Model)
		}
		if len(body.Messages) != 2 {
			t.Fatalf("messages length = %d, want 2", len(body.Messages))
		}
		if body.Messages[0].ChatSystemMessage == nil || body.Messages[0].ChatSystemMessage.Content.Str == nil {
			t.Fatal("system message content is missing")
		}
		if body.Messages[1].ChatUserMessage == nil || body.Messages[1].ChatUserMessage.Content.Str == nil {
			t.Fatal("user message content is missing")
		}
		if body.ResponseFormat == nil || body.ResponseFormat.ChatFormatJSONSchemaConfig == nil {
			t.Fatal("JSON Schema response format is missing")
		}
		schema := body.ResponseFormat.ChatFormatJSONSchemaConfig.JSONSchema
		if schema.Name != "journey_route" || len(schema.Schema) == 0 {
			t.Errorf("schema = %#v, want journey_route with fields", schema)
		}
		strict, ok := schema.Strict.Get()
		if !ok || strict == nil || !*strict {
			t.Errorf("strict = %v, want true", schema.Strict)
		}
		if len(body.Plugins) != 1 || body.Plugins[0].WebSearchPlugin == nil || body.Plugins[0].WebSearchPlugin.ID != components.WebSearchPluginIDWeb {
			t.Errorf("plugins = %#v, want one web plugin", body.Plugins)
		}

		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write(openRouterTestResponse(t, openRouterTestRouteJSON))
	}))
	t.Cleanup(server.Close)

	sdk := newOpenRouterSDKForTest(server)
	generator := newOpenRouterGenerator(sdk.Chat, openRouterTestConfig(), true, slog.Default())
	route, err := generator.Generate(context.Background(), request)
	if err != nil {
		t.Fatalf("Generate() error = %v", err)
	}
	if len(route.Days) != 1 || len(route.Days[0].Spots) != 1 {
		t.Fatalf("route = %#v, want one day and one spot", route)
	}
	if got, want := route.Days[0].Spots[0].Name, "浅草寺"; got != want {
		t.Errorf("spot name = %q, want %q", got, want)
	}
}

func TestOpenRouterGeneratorGenerateWebSearchDisabled(t *testing.T) {
	request := newStubTestJourneyRequest(
		t,
		time.Date(2026, 8, 1, 0, 0, 0, 0, time.UTC),
		time.Date(2026, 8, 1, 0, 0, 0, 0, time.UTC),
		10000,
	)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body map[string]json.RawMessage
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Errorf("decode request body: %v", err)
		}
		if _, ok := body["plugins"]; ok {
			t.Error("plugins field present when Web Search is disabled")
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write(openRouterTestResponse(t, openRouterTestRouteJSON))
	}))
	t.Cleanup(server.Close)

	sdk := newOpenRouterSDKForTest(server)
	generator := newOpenRouterGenerator(sdk.Chat, openRouterTestConfig(), false, slog.Default())
	if _, err := generator.Generate(context.Background(), request); err != nil {
		t.Fatalf("Generate() error = %v", err)
	}
}

func TestOpenRouterGeneratorGenerateSDKErrorDoesNotLogFailure(t *testing.T) {
	request := newStubTestJourneyRequest(
		t,
		time.Date(2026, 8, 1, 0, 0, 0, 0, time.UTC),
		time.Date(2026, 8, 1, 0, 0, 0, 0, time.UTC),
		10000,
	)
	var logs bytes.Buffer
	logger := slog.New(slog.NewTextHandler(&logs, nil))
	fake := &fakeOpenRouterChatClient{
		err: sdkerrors.NewAPIError("bad request", http.StatusBadRequest, `{"error":{"message":"provider rejected request","secret":"do-not-log"}}`, nil),
	}
	generator := newOpenRouterGenerator(fake, openRouterTestConfig(), true, logger)

	_, err := generator.Generate(context.Background(), request)
	if err == nil {
		t.Fatal("Generate() error = nil, want error")
	}
	if !strings.Contains(err.Error(), "openrouter request failed") {
		t.Errorf("error = %q, want generic request failure", err)
	}
	if strings.Contains(err.Error(), openRouterTestAPIKey) || strings.Contains(err.Error(), "do-not-log") {
		t.Errorf("error exposes sensitive detail: %q", err)
	}
	logText := logs.String()
	if strings.Contains(logText, "openrouter journey generation failed") {
		t.Errorf("logs = %q, want no failure log", logText)
	}
	if strings.Contains(logText, openRouterTestAPIKey) || strings.Contains(logText, "do-not-log") {
		t.Errorf("logs expose sensitive detail: %q", logText)
	}
}

func TestOpenRouterGeneratorGenerateTimeout(t *testing.T) {
	request := newStubTestJourneyRequest(
		t,
		time.Date(2026, 8, 1, 0, 0, 0, 0, time.UTC),
		time.Date(2026, 8, 1, 0, 0, 0, 0, time.UTC),
		10000,
	)
	fake := &fakeOpenRouterChatClient{waitForContext: true}
	config := openRouterTestConfig()
	config.RequestTimeout = 10 * time.Millisecond
	generator := newOpenRouterGenerator(fake, config, false, slog.Default())

	_, err := generator.Generate(context.Background(), request)
	if !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("Generate() error = %v, want context deadline exceeded", err)
	}
}

func TestOpenRouterGeneratorSDKTimeoutDisablesRetry(t *testing.T) {
	request := newStubTestJourneyRequest(
		t,
		time.Date(2026, 8, 1, 0, 0, 0, 0, time.UTC),
		time.Date(2026, 8, 1, 0, 0, 0, 0, time.UTC),
		10000,
	)
	var calls atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		time.Sleep(200 * time.Millisecond)
	}))
	t.Cleanup(server.Close)

	config := openRouterTestConfig()
	config.RequestTimeout = 20 * time.Millisecond
	sdk := openrouter.New(
		openrouter.WithServerURL(server.URL+"/api/v1"),
		openrouter.WithSecurity(openRouterTestAPIKey),
		openrouter.WithClient(server.Client()),
		openrouter.WithTimeout(config.RequestTimeout),
		openrouter.WithRetryConfig(retry.Config{Strategy: "none"}),
	)
	generator := newOpenRouterGenerator(sdk.Chat, config, false, slog.Default())

	startedAt := time.Now()
	_, err := generator.Generate(context.Background(), request)
	if !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("Generate() error = %v, want context deadline exceeded", err)
	}
	if elapsed := time.Since(startedAt); elapsed > time.Second {
		t.Fatalf("Generate() took %s, want less than 1s", elapsed)
	}
	if got := calls.Load(); got != 1 {
		t.Fatalf("request count = %d, want exactly one request", got)
	}
}

func TestOpenRouterGeneratorGenerateRejectsInvalidResponse(t *testing.T) {
	request := newStubTestJourneyRequest(
		t,
		time.Date(2026, 8, 1, 0, 0, 0, 0, time.UTC),
		time.Date(2026, 8, 1, 0, 0, 0, 0, time.UTC),
		10000,
	)
	tests := []struct {
		name     string
		response *operations.SendChatCompletionRequestResponse
		want     string
	}{
		{name: "nil response", response: nil, want: "chat result"},
		{name: "empty choices", response: &operations.SendChatCompletionRequestResponse{ChatResult: &components.ChatResult{}}, want: "no choices"},
		{
			name: "empty content",
			response: &operations.SendChatCompletionRequestResponse{ChatResult: &components.ChatResult{
				Choices: []components.ChatChoice{{Message: components.ChatAssistantMessage{}}},
			}},
			want: "empty message content",
		},
		{
			name: "non-string content",
			response: &operations.SendChatCompletionRequestResponse{ChatResult: &components.ChatResult{
				Choices: []components.ChatChoice{{Message: components.ChatAssistantMessage{
					Content: optionalnullable.From(&components.ChatAssistantMessageContent{
						ArrayOfChatContentItems: []components.ChatContentItems{},
					}),
				}}},
			}},
			want: "must be a string",
		},
	}

	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			fake := &fakeOpenRouterChatClient{response: testCase.response}
			generator := newOpenRouterGenerator(fake, openRouterTestConfig(), false, slog.Default())
			_, err := generator.Generate(context.Background(), request)
			if err == nil {
				t.Fatal("Generate() error = nil, want error")
			}
			if !strings.Contains(err.Error(), testCase.want) {
				t.Errorf("error = %q, want message containing %q", err, testCase.want)
			}
		})
	}
}

func TestOpenRouterGeneratorGenerateIncludesSafeErrorDetail(t *testing.T) {
	t.Parallel()

	request := newStubTestJourneyRequest(
		t,
		time.Date(2026, 8, 1, 0, 0, 0, 0, time.UTC),
		time.Date(2026, 8, 1, 0, 0, 0, 0, time.UTC),
		10000,
	)
	invalidJSON := "not json"
	cases := []struct {
		name     string
		response *operations.SendChatCompletionRequestResponse
		want     observability.ErrorDetailCode
	}{
		{
			name:     "missing chat result",
			response: nil,
			want:     observability.ErrorDetailOpenRouterResponseMissingChatResult,
		},
		{
			name: "no choices",
			response: &operations.SendChatCompletionRequestResponse{
				ChatResult: &components.ChatResult{},
			},
			want: observability.ErrorDetailOpenRouterResponseNoChoices,
		},
		{
			name: "empty content",
			response: &operations.SendChatCompletionRequestResponse{
				ChatResult: &components.ChatResult{
					Choices: []components.ChatChoice{{Message: components.ChatAssistantMessage{}}},
				},
			},
			want: observability.ErrorDetailOpenRouterResponseEmptyMessageContent,
		},
		{
			name: "non-string content",
			response: &operations.SendChatCompletionRequestResponse{
				ChatResult: &components.ChatResult{
					Choices: []components.ChatChoice{{
						Message: components.ChatAssistantMessage{
							Content: optionalnullable.From(&components.ChatAssistantMessageContent{
								ArrayOfChatContentItems: []components.ChatContentItems{},
							}),
						},
					}},
				},
			},
			want: observability.ErrorDetailOpenRouterResponseMessageContentNotString,
		},
		{
			name: "route parse failure",
			response: &operations.SendChatCompletionRequestResponse{
				ChatResult: &components.ChatResult{
					Choices: []components.ChatChoice{{
						Message: components.ChatAssistantMessage{
							Content: optionalnullable.From(&components.ChatAssistantMessageContent{
								Str: &invalidJSON,
							}),
						},
					}},
				},
			},
			want: observability.ErrorDetailJourneyRouteParseFailed,
		},
	}

	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			fake := &fakeOpenRouterChatClient{response: testCase.response}
			generator := newOpenRouterGenerator(fake, openRouterTestConfig(), false, slog.Default())

			_, err := generator.Generate(context.Background(), request)
			if err == nil {
				t.Fatal("Generate() error = nil, want error")
			}
			if got := observability.ErrorDetail(err); got != string(testCase.want) {
				t.Fatalf("ErrorDetail() = %q, want %q", got, testCase.want)
			}
		})
	}
}

type fakeOpenRouterChatClient struct {
	request        components.ChatRequest
	response       *operations.SendChatCompletionRequestResponse
	err            error
	waitForContext bool
}

func (f *fakeOpenRouterChatClient) Send(
	ctx context.Context,
	chatRequest components.ChatRequest,
	_ *components.MetadataLevel,
	_ ...operations.Option,
) (*operations.SendChatCompletionRequestResponse, error) {
	f.request = chatRequest
	if f.waitForContext {
		<-ctx.Done()
		return nil, ctx.Err()
	}
	if f.err != nil {
		return nil, f.err
	}
	return f.response, nil
}
