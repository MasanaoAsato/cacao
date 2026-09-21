package searxng

import (
	"cacao/src/infrastructure/config"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestClientSearch(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.Method != http.MethodGet {
			t.Errorf("method = %s, want GET", request.Method)
		}
		if request.URL.Path != "/search" {
			t.Errorf("path = %s, want /search", request.URL.Path)
		}
		query := request.URL.Query()
		if query.Get("q") != "東京 観光地" || query.Get("engines") != "bing" || query.Get("format") != "json" || query.Get("language") != "auto" || query.Get("safesearch") != "1" {
			t.Errorf("query = %q, want fixed SearXNG parameters", request.URL.RawQuery)
		}
		writer.Header().Set("Content-Type", "application/json")
		_, _ = writer.Write([]byte(`{"results":[
			{"title":"first","url":"https://example.com/a","content":"first snippet"},
			{"title":"duplicate","url":"https://example.com/a","content":"duplicate"},
			{"title":"invalid","url":"file:///tmp/private","content":"invalid"},
			{"title":"second","url":"http://example.com/b","content":"second snippet"}
		]}`))
	}))
	defer server.Close()

	client, err := NewClient(config.SearXNG{BaseURL: server.URL, RequestTimeout: time.Second, ResultLimit: 2})
	if err != nil {
		t.Fatalf("NewClient() error = %v", err)
	}
	results, err := client.Search(context.Background(), "東京 観光地")
	if err != nil {
		t.Fatalf("Search() error = %v", err)
	}
	if len(results) != 2 || results[0].URL != "https://example.com/a" || results[1].URL != "http://example.com/b" {
		t.Errorf("results = %#v, want two first valid unique URLs", results)
	}
}

func TestClientSearchRejectsInvalidResponses(t *testing.T) {
	tests := []struct {
		name   string
		status int
		body   string
		want   string
	}{
		{name: "non success", status: http.StatusBadGateway, body: "provider body must not escape", want: "status 502"},
		{name: "invalid JSON", status: http.StatusOK, body: "{", want: "decode"},
		{name: "oversized JSON", status: http.StatusOK, body: strings.Repeat("x", maximumResponseBytes+1), want: "exceeds"},
	}
	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
				writer.WriteHeader(testCase.status)
				_, _ = writer.Write([]byte(testCase.body))
			}))
			defer server.Close()
			client, err := NewClient(config.SearXNG{BaseURL: server.URL, RequestTimeout: time.Second, ResultLimit: 1})
			if err != nil {
				t.Fatalf("NewClient() error = %v", err)
			}
			_, err = client.Search(context.Background(), "query")
			if err == nil || !strings.Contains(err.Error(), testCase.want) {
				t.Errorf("Search() error = %v, want %q", err, testCase.want)
			}
			if strings.Contains(err.Error(), "provider body") {
				t.Errorf("Search() error leaks provider body: %q", err)
			}
		})
	}
}

func TestSanitizeResultsTruncatesUnicode(t *testing.T) {
	longTitle := strings.Repeat("旅", maximumTitleRunes+1)
	results := sanitizeResults([]searchResult{{Title: longTitle, URL: "https://example.com", Snippet: "text"}}, 1)
	if len([]rune(results[0].Title)) != maximumTitleRunes {
		t.Errorf("title length = %d, want %d", len([]rune(results[0].Title)), maximumTitleRunes)
	}
	if _, err := json.Marshal(results); err != nil {
		t.Fatalf("result must remain serializable: %v", err)
	}
}
