package service

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/openai/openai-go/v3"
	"github.com/openai/openai-go/v3/option"
)

// newOpenAITestClient は httptest サーバに向けた OpenAI クライアントを生成する。
// 本物の OpenAI API を呼ばずに Generate の往復を検証するための土台。
func newOpenAITestClient(t *testing.T, handler http.HandlerFunc) openai.Client {
	t.Helper()
	server := httptest.NewServer(handler)
	t.Cleanup(server.Close)

	return openai.NewClient(
		option.WithAPIKey("test-api-key"),
		option.WithBaseURL(server.URL),
		option.WithMaxRetries(0), // テストを速くするためリトライを無効化
	)
}

// responsesAPIBody は OpenAI Responses API 互換のモックレスポンスを組み立てる。
// text には LLM が出力する旅程 JSON 文字列をそのまま渡す（json.Marshal がエスケープする）。
func responsesAPIBody(t *testing.T, text string) []byte {
	t.Helper()
	body, err := json.Marshal(map[string]any{
		"id":         "resp_test",
		"object":     "response",
		"created_at": 1753785600,
		"model":      "gpt-4o-mini",
		"status":     "completed",
		"output": []map[string]any{
			{
				"type":   "message",
				"id":     "msg_test",
				"status": "completed",
				"role":   "assistant",
				"content": []map[string]any{
					{"type": "output_text", "text": text},
				},
			},
		},
	})
	if err != nil {
		t.Fatalf("failed to marshal mock response: %v", err)
	}
	return body
}

func TestJourneyGeneratorOpenAI_Generate(t *testing.T) {
	llmOutput := `{"days":[{"date":"2026-08-01","spots":[{"name":"浅草寺","description":"東京最古の寺院","startAt":"2026-08-01T09:00:00+09:00","estimatedCost":{"amount":0,"currency":"JPY"}}]}]}`

	client := newOpenAITestClient(t, func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("expected POST, got %s", r.Method)
		}
		if r.URL.Path != "/responses" {
			t.Errorf("expected path /responses, got %s", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write(responsesAPIBody(t, llmOutput))
	})

	generator := NewJourneyGeneratorOpenAI(client, "gpt-4o-mini", false)
	start := time.Date(2026, 8, 1, 0, 0, 0, 0, time.UTC)
	end := time.Date(2026, 8, 3, 0, 0, 0, 0, time.UTC)
	req := newStubTestJourneyRequest(t, start, end, 30000)

	route, err := generator.Generate(context.Background(), req)
	if err != nil {
		t.Fatalf("Generate failed: %v", err)
	}

	if len(route.Days) != 1 {
		t.Fatalf("expected 1 day, got %d", len(route.Days))
	}
	spots := route.Days[0].Spots
	if len(spots) != 1 {
		t.Fatalf("expected 1 spot, got %d", len(spots))
	}
	if spots[0].Name != "浅草寺" {
		t.Errorf("expected spot name 浅草寺, got %s", spots[0].Name)
	}
	if spots[0].EstimatedCost.Amount() != 0 {
		t.Errorf("expected amount 0, got %d", spots[0].EstimatedCost.Amount())
	}
	if got := spots[0].EstimatedCost.Currency().Code(); got != "JPY" {
		t.Errorf("expected currency JPY, got %s", got)
	}
}

func TestJourneyGeneratorOpenAI_Generate_APIError(t *testing.T) {
	client := newOpenAITestClient(t, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = w.Write([]byte(`{"error":{"message":"internal error","type":"server_error"}}`))
	})

	generator := NewJourneyGeneratorOpenAI(client, "gpt-4o-mini", false)
	day := time.Date(2026, 8, 1, 0, 0, 0, 0, time.UTC)
	req := newStubTestJourneyRequest(t, day, day, 10000)

	_, err := generator.Generate(context.Background(), req)
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if !strings.Contains(err.Error(), "openai responses") {
		t.Errorf("expected error wrapped with openai responses, got %q", err.Error())
	}
}

func TestJourneyGeneratorOpenAI_Generate_InvalidLLMOutput(t *testing.T) {
	client := newOpenAITestClient(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		// LLM が JSON ではなく平文を返してきた場合を模倣する
		_, _ = w.Write(responsesAPIBody(t, "申し訳ありませんが旅程を作成できませんでした。"))
	})

	generator := NewJourneyGeneratorOpenAI(client, "gpt-4o-mini", false)
	day := time.Date(2026, 8, 1, 0, 0, 0, 0, time.UTC)
	req := newStubTestJourneyRequest(t, day, day, 10000)

	_, err := generator.Generate(context.Background(), req)
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if !strings.Contains(err.Error(), "parse generated route") {
		t.Errorf("expected error wrapped with parse generated route, got %q", err.Error())
	}
}

// TestJourneyGeneratorOpenAI_Generate_UsesJSONSchema はリクエストボディの text.format が
// json_schema（Structured Outputs）であり、json_object（JSON モード）でないことを検証する。
// json_object は Web Search ツールと併用できず OpenAI API が 400 を返すため、
// Web Search 有効の組み合わせでも json_schema が使われることを保証する回帰テスト。
func TestJourneyGeneratorOpenAI_Generate_UsesJSONSchema(t *testing.T) {
	llmOutput := `{"days":[{"date":"2026-08-01","spots":[{"name":"浅草寺","description":"東京最古の寺院","startAt":"2026-08-01T09:00:00+09:00","estimatedCost":{"amount":0,"currency":"JPY"}}]}]}`

	client := newOpenAITestClient(t, func(w http.ResponseWriter, r *http.Request) {
		body, err := io.ReadAll(r.Body)
		if err != nil {
			t.Fatalf("failed to read request body: %v", err)
		}
		if !bytes.Contains(body, []byte(`"json_schema"`)) {
			t.Errorf("expected request body to use json_schema format, but got: %s", body)
		}
		if bytes.Contains(body, []byte(`"json_object"`)) {
			t.Errorf("expected request body not to use json_object format, but got: %s", body)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write(responsesAPIBody(t, llmOutput))
	})

	// 元の不具合は Web Search 有効時に発生したため、その組み合わせで検証する
	generator := NewJourneyGeneratorOpenAI(client, "gpt-4o-mini", true)
	start := time.Date(2026, 8, 1, 0, 0, 0, 0, time.UTC)
	end := time.Date(2026, 8, 3, 0, 0, 0, 0, time.UTC)
	req := newStubTestJourneyRequest(t, start, end, 30000)

	if _, err := generator.Generate(context.Background(), req); err != nil {
		t.Fatalf("Generate failed: %v", err)
	}
}

// TestJourneyGeneratorOpenAI_Generate_WithWebSearch は Web Search 有効時に
// リクエストボディの tools に web_search が含まれることを検証する。
// これは「Web Search が有効化された状態で OpenAI API が呼ばれているか」を保証する境界値に近い正常系テスト。
func TestJourneyGeneratorOpenAI_Generate_WithWebSearch(t *testing.T) {
	llmOutput := `{"days":[{"date":"2026-08-01","spots":[{"name":"浅草寺","description":"東京最古の寺院","startAt":"2026-08-01T09:00:00+09:00","estimatedCost":{"amount":0,"currency":"JPY"}}]}]}`

	client := newOpenAITestClient(t, func(w http.ResponseWriter, r *http.Request) {
		body, err := io.ReadAll(r.Body)
		if err != nil {
			t.Fatalf("failed to read request body: %v", err)
		}
		if !bytes.Contains(body, []byte("web_search")) {
			t.Errorf("expected request body to contain web_search tool, but got: %s", body)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write(responsesAPIBody(t, llmOutput))
	})

	generator := NewJourneyGeneratorOpenAI(client, "gpt-4o-mini", true)
	start := time.Date(2026, 8, 1, 0, 0, 0, 0, time.UTC)
	end := time.Date(2026, 8, 3, 0, 0, 0, 0, time.UTC)
	req := newStubTestJourneyRequest(t, start, end, 30000)

	route, err := generator.Generate(context.Background(), req)
	if err != nil {
		t.Fatalf("Generate failed: %v", err)
	}
	if len(route.Days) != 1 {
		t.Fatalf("expected 1 day, got %d", len(route.Days))
	}
}

// TestJourneyGeneratorOpenAI_Generate_WithoutWebSearch は Web Search 無効時に
// リクエストボディの tools に web_search が含まれないことを検証する。
// 未設定時は Web Search が無効であることを保証する境界値テスト。
func TestJourneyGeneratorOpenAI_Generate_WithoutWebSearch(t *testing.T) {
	llmOutput := `{"days":[{"date":"2026-08-01","spots":[{"name":"浅草寺","description":"東京最古寺院","startAt":"2026-08-01T09:00:00+09:00","estimatedCost":{"amount":0,"currency":"JPY"}}]}]}`

	client := newOpenAITestClient(t, func(w http.ResponseWriter, r *http.Request) {
		body, err := io.ReadAll(r.Body)
		if err != nil {
			t.Fatalf("failed to read request body: %v", err)
		}
		if bytes.Contains(body, []byte("web_search")) {
			t.Errorf("expected request body not to contain web_search tool, but got: %s", body)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write(responsesAPIBody(t, llmOutput))
	})

	generator := NewJourneyGeneratorOpenAI(client, "gpt-4o-mini", false)
	start := time.Date(2026, 8, 1, 0, 0, 0, 0, time.UTC)
	end := time.Date(2026, 8, 3, 0, 0, 0, 0, time.UTC)
	req := newStubTestJourneyRequest(t, start, end, 30000)

	route, err := generator.Generate(context.Background(), req)
	if err != nil {
		t.Fatalf("Generate failed: %v", err)
	}
	if len(route.Days) != 1 {
		t.Fatalf("expected 1 day, got %d", len(route.Days))
	}
}
