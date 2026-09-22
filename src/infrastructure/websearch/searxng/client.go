// Package searxng implements the SearXNG JSON search API.
package searxng

import (
	"cacao/src/infrastructure/config"
	"cacao/src/infrastructure/websearch"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
)

const (
	maximumResponseBytes = 2 << 20
	maximumTitleRunes    = 120
	maximumSnippetRunes  = 500
	maximumURLRunes      = 2048
)

// Client searches SearXNG through its JSON API.
type Client struct {
	client      *http.Client
	baseURL     string
	resultLimit int
}

// NewClient creates a SearXNG client without sending any request.
func NewClient(searchConfig config.SearXNG) (*Client, error) {
	if err := searchConfig.Validate(); err != nil {
		return nil, fmt.Errorf("validate searxng config: %w", err)
	}
	return &Client{
		client:      &http.Client{Timeout: searchConfig.RequestTimeout},
		baseURL:     searchConfig.BaseURL,
		resultLimit: searchConfig.ResultLimit,
	}, nil
}

// Search retrieves up to the configured number of valid results.
func (c *Client) Search(ctx context.Context, query string) (results []websearch.Result, err error) {
	defer func() {
		if err != nil {
			err = &safeSearchError{cause: err}
		}
	}()
	if c == nil || c.client == nil {
		return nil, fmt.Errorf("searxng client is not configured")
	}
	requestURL, err := c.searchURL(query)
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, requestURL, nil)
	if err != nil {
		return nil, fmt.Errorf("create searxng request: %w", err)
	}
	response, err := c.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("searxng request failed: %w", err)
	}
	defer func() {
		_ = response.Body.Close()
	}()
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return nil, &statusError{statusCode: response.StatusCode}
	}
	body, err := io.ReadAll(io.LimitReader(response.Body, maximumResponseBytes+1))
	if err != nil {
		return nil, fmt.Errorf("read searxng response: %w: %w", websearch.ErrResponseInvalid, err)
	}
	if len(body) > maximumResponseBytes {
		return nil, fmt.Errorf("%w: searxng response exceeds %d bytes", websearch.ErrResponseInvalid, maximumResponseBytes)
	}
	var payload searchResponse
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, fmt.Errorf("decode searxng response: %w: %w", websearch.ErrResponseInvalid, err)
	}
	return sanitizeResults(payload.Results, c.resultLimit), nil
}

// safeSearchError は検索語やプロバイダー応答本文をログへ出さず、
// errors.Is と errors.As のために原因を保持する。
type safeSearchError struct {
	cause error
}

func (e *safeSearchError) Error() string {
	return e.SafeLogMessage()
}

func (e *safeSearchError) Unwrap() error {
	return e.cause
}

func (e *safeSearchError) SafeLogMessage() string {
	var statusErr *statusError
	switch {
	case errors.As(e.cause, &statusErr):
		return fmt.Sprintf("searxng search returned HTTP status %d", statusErr.statusCode)
	case errors.Is(e.cause, websearch.ErrResponseInvalid):
		return "searxng search returned invalid response"
	case errors.Is(e.cause, context.DeadlineExceeded):
		return "searxng search timed out"
	default:
		return "searxng search request failed"
	}
}

func (c *Client) searchURL(query string) (string, error) {
	parsed, err := url.Parse(c.baseURL + "/search")
	if err != nil {
		return "", fmt.Errorf("parse searxng search URL: %w", err)
	}
	values := parsed.Query()
	values.Set("q", query)
	values.Set("engines", "bing")
	values.Set("format", "json")
	values.Set("language", "auto")
	values.Set("safesearch", "1")
	parsed.RawQuery = values.Encode()
	return parsed.String(), nil
}

type searchResponse struct {
	Results []searchResult `json:"results"`
}

type searchResult struct {
	Title   string `json:"title"`
	URL     string `json:"url"`
	Snippet string `json:"content"`
}

func sanitizeResults(results []searchResult, limit int) []websearch.Result {
	sanitized := make([]websearch.Result, 0, limit)
	seen := map[string]struct{}{}
	for _, result := range results {
		if len(sanitized) == limit {
			break
		}
		if !isHTTPURL(result.URL) {
			continue
		}
		url := truncateRunes(result.URL, maximumURLRunes)
		if _, exists := seen[url]; exists {
			continue
		}
		seen[url] = struct{}{}
		sanitized = append(sanitized, websearch.Result{
			Title:   truncateRunes(result.Title, maximumTitleRunes),
			URL:     url,
			Snippet: truncateRunes(result.Snippet, maximumSnippetRunes),
		})
	}
	return sanitized
}

func isHTTPURL(rawURL string) bool {
	parsed, err := url.Parse(rawURL)
	return err == nil && parsed.Host != "" && (parsed.Scheme == "http" || parsed.Scheme == "https")
}

func truncateRunes(value string, limit int) string {
	if utf8Length := len([]rune(value)); utf8Length <= limit {
		return value
	}
	return string([]rune(value)[:limit])
}

// statusError deliberately keeps only a status code, never a provider body.
type statusError struct {
	statusCode int
}

func (e *statusError) Error() string {
	return fmt.Sprintf("searxng returned HTTP status %d", e.statusCode)
}

// ProviderStatusCode lets observability classify the provider status safely.
func (e *statusError) ProviderStatusCode() int {
	return e.statusCode
}

var _ websearch.Searcher = (*Client)(nil)
