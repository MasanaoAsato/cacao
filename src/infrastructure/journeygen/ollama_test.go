package journeygen

import (
	"cacao/src/infrastructure/config"
	"cacao/src/infrastructure/websearch"
	"cacao/src/observability"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"
)

const ollamaTestRouteJSON = `{"days":[{"date":"2026-08-01","spots":[{"name":"浅草寺","description":"東京最古の寺院","startAt":"2026-08-01T09:00:00+09:00","estimatedCost":{"amount":0,"currency":"JPY"}}],"legs":[{"from":"東京（出発地）","mode":"walk","durationMinutes":1,"cost":{"amount":0,"currency":"JPY"}}]}]}`

func TestOllamaGeneratorGenerateWithSearch(t *testing.T) {
	var received chatRequest
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.Method != http.MethodPost || request.URL.Path != "/api/chat" {
			t.Errorf("request = %s %s, want POST /api/chat", request.Method, request.URL.Path)
		}
		if err := json.NewDecoder(request.Body).Decode(&received); err != nil {
			t.Errorf("decode request: %v", err)
		}
		writer.Header().Set("Content-Type", "application/json")
		_, _ = writer.Write([]byte(`{"message":{"role":"assistant","content":` + strconv.Quote(ollamaTestRouteJSON) + `}}`))
	}))
	defer server.Close()

	searcher := &fakeSearcher{results: map[string][]websearch.Result{
		"default": {{Title: "trusted title", URL: "https://example.com/reference", Snippet: "reference text"}},
	}}
	generator, err := newOllamaGenerator(
		server.Client(),
		config.Ollama{BaseURL: server.URL, Model: "llama3.2", RequestTimeout: time.Second},
		searcher,
		true,
		nil,
	)
	if err != nil {
		t.Fatalf("newOllamaGenerator() error = %v", err)
	}
	request := newStubTestJourneyRequest(t, time.Date(2026, 8, 1, 0, 0, 0, 0, time.UTC), time.Date(2026, 8, 1, 0, 0, 0, 0, time.UTC), 10000)
	route, err := generator.Generate(context.Background(), request)
	if err != nil {
		t.Fatalf("Generate() error = %v", err)
	}
	if len(route.Days) != 1 || len(searcher.queries) != 3 {
		t.Errorf("route/search calls = %#v/%d, want one day and three searches", route, len(searcher.queries))
	}
	if received.Model != "llama3.2" || received.Stream || received.Think || len(received.Messages) != 2 || len(received.Format) == 0 {
		t.Errorf("chat request = %#v, want model, stream=false, two messages, and schema", received)
	}
	if !strings.Contains(received.Messages[0].Content, "未信頼データ") || !strings.Contains(received.Messages[1].Content, "https://example.com/reference") {
		t.Errorf("search safety context is missing from chat request")
	}
}

func TestOllamaGeneratorGenerateDoesNotSearchWhenDisabled(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		_, _ = writer.Write([]byte(`{"message":{"content":` + strconv.Quote(ollamaTestRouteJSON) + `}}`))
	}))
	defer server.Close()
	searcher := &fakeSearcher{err: errors.New("search must not be called")}
	generator, err := newOllamaGenerator(server.Client(), config.Ollama{BaseURL: server.URL, Model: "llama3.2", RequestTimeout: time.Second}, searcher, false, nil)
	if err != nil {
		t.Fatalf("newOllamaGenerator() error = %v", err)
	}
	request := newStubTestJourneyRequest(t, time.Date(2026, 8, 1, 0, 0, 0, 0, time.UTC), time.Date(2026, 8, 1, 0, 0, 0, 0, time.UTC), 10000)
	if _, err := generator.Generate(context.Background(), request); err != nil {
		t.Fatalf("Generate() error = %v", err)
	}
	if len(searcher.queries) != 0 {
		t.Errorf("search calls = %d, want 0", len(searcher.queries))
	}
}

func TestOllamaGeneratorChatPassesThinkingConfiguration(t *testing.T) {
	var received chatRequest
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if err := json.NewDecoder(request.Body).Decode(&received); err != nil {
			t.Errorf("decode request: %v", err)
		}
		_, _ = writer.Write([]byte(`{"message":{"content":"{}"}}`))
	}))
	defer server.Close()

	generator, err := newOllamaGenerator(
		server.Client(),
		config.Ollama{BaseURL: server.URL, Model: "qwen3.5:4b", Think: true, RequestTimeout: time.Second},
		nil,
		false,
		nil,
	)
	if err != nil {
		t.Fatalf("newOllamaGenerator() error = %v", err)
	}
	if _, err := generator.chat(context.Background(), "system", "user"); err != nil {
		t.Fatalf("chat() error = %v", err)
	}
	if !received.Think {
		t.Error("request think = false, want true")
	}
}

func TestOllamaGeneratorGenerateRejectsProviderAndSearchFailures(t *testing.T) {
	request := newStubTestJourneyRequest(t, time.Date(2026, 8, 1, 0, 0, 0, 0, time.UTC), time.Date(2026, 8, 1, 0, 0, 0, 0, time.UTC), 10000)
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		writer.WriteHeader(http.StatusBadGateway)
		_, _ = writer.Write([]byte("provider body must not escape"))
	}))
	defer server.Close()

	tests := []struct {
		name     string
		searcher websearch.Searcher
		enabled  bool
		want     string
	}{
		{name: "search failure", searcher: &fakeSearcher{err: errors.New("search secret")}, enabled: true, want: "search searxng"},
		{name: "ollama failure", enabled: false, want: "ollama request failed"},
	}
	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			generator, err := newOllamaGenerator(server.Client(), config.Ollama{BaseURL: server.URL, Model: "llama3.2", RequestTimeout: time.Second}, testCase.searcher, testCase.enabled, nil)
			if err != nil {
				t.Fatalf("newOllamaGenerator() error = %v", err)
			}
			_, err = generator.Generate(context.Background(), request)
			if err == nil || !strings.Contains(err.Error(), testCase.want) {
				t.Errorf("Generate() error = %v, want %q", err, testCase.want)
			}
			if strings.Contains(err.Error(), "provider body") || strings.Contains(err.Error(), "search secret") {
				t.Errorf("Generate() error leaks provider detail: %q", err)
			}
			if testCase.enabled {
				if got := observability.ErrorDetail(err); got != string(observability.ErrorDetailSearXNGRequestFailed) {
					t.Errorf("ErrorDetail() = %q, want searxng request failure", got)
				}
				if got := observability.SourceOperation(err); got != "searxng_search" {
					t.Errorf("SourceOperation() = %q, want searxng_search", got)
				}
				return
			}
			if got := observability.ErrorDetail(err); got != string(observability.ErrorDetailOllamaRequestFailed) {
				t.Errorf("ErrorDetail() = %q, want ollama request failure", got)
			}
			if got := observability.SourceOperation(err); got != "ollama_send_chat" {
				t.Errorf("SourceOperation() = %q, want ollama_send_chat", got)
			}
		})
	}
}

type fakeSearcher struct {
	queries []string
	results map[string][]websearch.Result
	err     error
}

func (s *fakeSearcher) Search(ctx context.Context, query string) ([]websearch.Result, error) {
	s.queries = append(s.queries, query)
	if s.err != nil {
		return nil, s.err
	}
	return s.results["default"], nil
}
