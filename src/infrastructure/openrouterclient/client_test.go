package openrouterclient

import (
	"errors"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/OpenRouterTeam/go-sdk/models/sdkerrors"
)

func TestNew(t *testing.T) {
	t.Parallel()
	if client := New("key", time.Second); client == nil || client.Chat == nil || client.Images == nil {
		t.Fatal("New() must return a client with Chat and Images")
	}
	if NoRetry().Strategy != "none" {
		t.Errorf("NoRetry().Strategy = %q", NoRetry().Strategy)
	}
}

func TestStatusCode(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name   string
		err    error
		want   int
		wantOK bool
	}{
		{name: "正常系: APIError のステータス", err: &sdkerrors.APIError{StatusCode: http.StatusBadGateway}, want: 502, wantOK: true},
		{name: "正常系: 型付き 403", err: fmt.Errorf("wrap: %w", &sdkerrors.ForbiddenResponseError{}), want: 403, wantOK: true},
		{name: "正常系: 型付き 524", err: &sdkerrors.EdgeNetworkTimeoutResponseError{}, want: 524, wantOK: true},
		{name: "境界値系: 範囲外のステータスは不明扱い", err: &sdkerrors.APIError{StatusCode: 999}},
		{name: "異常系: 無関係なエラー", err: errors.New("boom")},
		{name: "異常系: nil", err: nil},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, ok := StatusCode(tt.err)
			if ok != tt.wantOK || got != tt.want {
				t.Errorf("StatusCode() = %d, %v; want %d, %v", got, ok, tt.want, tt.wantOK)
			}
		})
	}
}

func TestWrapRequestError(t *testing.T) {
	t.Parallel()

	if WrapRequestError(nil) != nil {
		t.Fatal("WrapRequestError(nil) must be nil")
	}
	cause := &sdkerrors.TooManyRequestsResponseError{}
	wrapped := WrapRequestError(cause)

	var requestError *RequestError
	if !errors.As(wrapped, &requestError) {
		t.Fatalf("wrapped = %T, want *RequestError", wrapped)
	}
	if requestError.ProviderStatusCode() != http.StatusTooManyRequests {
		t.Errorf("ProviderStatusCode() = %d", requestError.ProviderStatusCode())
	}
	if !errors.Is(wrapped, cause) {
		t.Error("wrapped must unwrap to cause")
	}
	if wrapped.Error() != "openrouter request failed" {
		t.Errorf("Error() = %q must not leak provider body", wrapped.Error())
	}
	if unknown := WrapRequestError(errors.New("net down")); unknown.(*RequestError).ProviderStatusCode() != 0 {
		t.Error("unknown status must be 0")
	}
}
