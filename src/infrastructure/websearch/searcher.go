// Package websearch contains infrastructure-local web search abstractions.
package websearch

import (
	"context"
	"errors"
)

// ErrResponseInvalid identifies an invalid or oversized provider response.
var ErrResponseInvalid = errors.New("web search response is invalid")

// Result is a single, untrusted result returned by a web search provider.
type Result struct {
	Title   string
	URL     string
	Snippet string
}

// Searcher retrieves search results for a fixed query.
type Searcher interface {
	Search(ctx context.Context, query string) ([]Result, error)
}
