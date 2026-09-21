package journeygen

import (
	"bytes"
	"cacao/src/domain/entity"
	"cacao/src/domain/service"
	"cacao/src/infrastructure/config"
	"cacao/src/infrastructure/journeygen/journeyprompt"
	"cacao/src/infrastructure/websearch"
	"cacao/src/observability"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"time"
)

const (
	maximumOllamaResponseBytes = 2 << 20
	maximumSearchContextItems  = 12
)

// OllamaGenerator generates a journey through Ollama's non-streaming Chat API.
type OllamaGenerator struct {
	client           *http.Client
	config           config.Ollama
	searcher         websearch.Searcher
	webSearchEnabled bool
	logger           *slog.Logger
}

// NewOllamaGenerator creates an Ollama generator without connecting to Ollama or SearXNG.
func NewOllamaGenerator(
	ollamaConfig config.Ollama,
	searcher websearch.Searcher,
	webSearchEnabled bool,
) (*OllamaGenerator, error) {
	return newOllamaGenerator(
		&http.Client{Timeout: ollamaConfig.RequestTimeout},
		ollamaConfig,
		searcher,
		webSearchEnabled,
		slog.Default(),
	)
}

func newOllamaGenerator(
	client *http.Client,
	ollamaConfig config.Ollama,
	searcher websearch.Searcher,
	webSearchEnabled bool,
	logger *slog.Logger,
) (*OllamaGenerator, error) {
	if err := ollamaConfig.Validate(); err != nil {
		return nil, fmt.Errorf("validate ollama config: %w", err)
	}
	if client == nil {
		return nil, errors.New("ollama HTTP client must not be nil")
	}
	if webSearchEnabled && searcher == nil {
		return nil, errors.New("searxng searcher must not be nil when web search is enabled")
	}
	if logger == nil {
		logger = slog.Default()
	}
	return &OllamaGenerator{
		client:           client,
		config:           ollamaConfig,
		searcher:         searcher,
		webSearchEnabled: webSearchEnabled,
		logger:           logger,
	}, nil
}

// Generate retrieves fixed web references when enabled, then asks Ollama once.
func (g *OllamaGenerator) Generate(
	ctx context.Context,
	request entity.JourneyRequest,
) (service.GeneratedRoute, error) {
	startedAt := time.Now()
	results, queryCount, err := g.search(ctx, request)
	if err != nil {
		return service.GeneratedRoute{}, err
	}

	prompt, err := journeyprompt.BuildJourneyPrompt(request)
	if err != nil {
		return service.GeneratedRoute{}, fmt.Errorf("build journey prompt: %w", err)
	}
	systemInstruction := journeyprompt.SystemInstruction()
	if g.webSearchEnabled {
		systemInstruction = journeyprompt.SystemInstructionWithSearchSafety()
		prompt = journeyprompt.AppendSearchContext(prompt, results)
	}

	g.logger.InfoContext(
		ctx,
		"ollama journey generation started",
		"journey_request_id", request.ID().String(),
		"model", g.config.Model,
		"web_search_enabled", g.webSearchEnabled,
		"search_query_count", queryCount,
		"search_result_count", len(results),
	)
	content, err := g.chat(ctx, systemInstruction, prompt)
	if err != nil {
		return service.GeneratedRoute{}, err
	}
	route, err := journeyprompt.ParseGeneratedRoute(content, request)
	if err != nil {
		return service.GeneratedRoute{}, fmt.Errorf(
			"parse generated route: %w",
			observability.WithErrorDetail(observability.ErrorDetailJourneyRouteParseFailed, err),
		)
	}
	g.logger.InfoContext(
		ctx,
		"ollama journey generation completed",
		"journey_request_id", request.ID().String(),
		"model", g.config.Model,
		"web_search_enabled", g.webSearchEnabled,
		"search_query_count", queryCount,
		"search_result_count", len(results),
		"duration", time.Since(startedAt),
	)
	return route, nil
}

func (g *OllamaGenerator) search(
	ctx context.Context,
	request entity.JourneyRequest,
) ([]websearch.Result, int, error) {
	if !g.webSearchEnabled {
		return []websearch.Result{}, 0, nil
	}
	queries := journeyprompt.SearchQueries(request)
	results := make([]websearch.Result, 0, maximumSearchContextItems)
	seenURLs := map[string]struct{}{}
	for _, query := range queries {
		searchResults, err := g.searcher.Search(ctx, query)
		if err != nil {
			detail := observability.ErrorDetailSearXNGRequestFailed
			if errors.Is(err, websearch.ErrResponseInvalid) {
				detail = observability.ErrorDetailSearXNGResponseInvalid
			}
			return nil, len(queries), fmt.Errorf(
				"search searxng: %w",
				searxngFailure(detail, err),
			)
		}
		for _, result := range searchResults {
			if len(results) == maximumSearchContextItems {
				break
			}
			if _, found := seenURLs[result.URL]; found {
				continue
			}
			seenURLs[result.URL] = struct{}{}
			results = append(results, result)
		}
	}
	if len(results) == 0 {
		return nil, len(queries), searxngFailure(
			observability.ErrorDetailSearXNGNoResults,
			errors.New("searxng returned no usable search results"),
		)
	}
	return results, len(queries), nil
}

func (g *OllamaGenerator) chat(ctx context.Context, systemInstruction, prompt string) (string, error) {
	payload, err := json.Marshal(chatRequest{
		Model:  g.config.Model,
		Stream: false,
		Think:  g.config.Think,
		Format: journeyprompt.RouteJSONSchema(),
		Messages: []chatMessage{
			{Role: "system", Content: systemInstruction},
			{Role: "user", Content: prompt},
		},
	})
	if err != nil {
		return "", fmt.Errorf("encode ollama request: %w", err)
	}
	requestContext, cancel := context.WithTimeout(ctx, g.config.RequestTimeout)
	defer cancel()
	req, err := http.NewRequestWithContext(
		requestContext,
		http.MethodPost,
		g.config.BaseURL+"/api/chat",
		bytes.NewReader(payload),
	)
	if err != nil {
		return "", fmt.Errorf("create ollama request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	response, err := g.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("ollama request failed: %w", ollamaFailure(observability.ErrorDetailOllamaRequestFailed, err))
	}
	defer func() {
		_ = response.Body.Close()
	}()
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return "", ollamaFailure(observability.ErrorDetailOllamaRequestFailed, &ollamaStatusError{statusCode: response.StatusCode})
	}
	body, err := io.ReadAll(io.LimitReader(response.Body, maximumOllamaResponseBytes+1))
	if err != nil {
		return "", fmt.Errorf("read ollama response: %w", ollamaFailure(observability.ErrorDetailOllamaResponseInvalid, err))
	}
	if len(body) > maximumOllamaResponseBytes {
		return "", ollamaFailure(observability.ErrorDetailOllamaResponseInvalid, fmt.Errorf("ollama response exceeds %d bytes", maximumOllamaResponseBytes))
	}
	var responseBody chatResponse
	if err := json.Unmarshal(body, &responseBody); err != nil {
		return "", fmt.Errorf("decode ollama response: %w", ollamaFailure(observability.ErrorDetailOllamaResponseInvalid, err))
	}
	if strings.TrimSpace(responseBody.Message.Content) == "" {
		return "", ollamaFailure(observability.ErrorDetailOllamaResponseInvalid, errors.New("ollama response contains empty message content"))
	}
	return responseBody.Message.Content, nil
}

type chatRequest struct {
	Model    string         `json:"model"`
	Messages []chatMessage  `json:"messages"`
	Stream   bool           `json:"stream"`
	Think    bool           `json:"think"`
	Format   map[string]any `json:"format"`
}

type chatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type chatResponse struct {
	Message chatMessage `json:"message"`
}

type ollamaStatusError struct {
	statusCode int
}

func (e *ollamaStatusError) Error() string {
	return fmt.Sprintf("ollama returned HTTP status %d", e.statusCode)
}

func (e *ollamaStatusError) ProviderStatusCode() int {
	return e.statusCode
}

// safeProviderError preserves the error chain for observability while ensuring
// provider response text, query values, and endpoint details are not exposed.
type safeProviderError struct {
	message string
	cause   error
}

func (e *safeProviderError) Error() string {
	return e.message
}

func (e *safeProviderError) Unwrap() error {
	return e.cause
}

func searxngFailure(detail observability.ErrorDetailCode, cause error) error {
	return observability.WithOperation(
		"searxng_search",
		observability.WithErrorDetail(detail, &safeProviderError{message: "searxng request failed", cause: cause}),
	)
}

func ollamaFailure(detail observability.ErrorDetailCode, cause error) error {
	return observability.WithOperation(
		"ollama_send_chat",
		observability.WithErrorDetail(detail, &safeProviderError{message: "ollama request failed", cause: cause}),
	)
}

var _ service.JourneyGenerator = (*OllamaGenerator)(nil)
