// Package openrouterclient は OpenRouter SDK の生成とエラー解釈をまとめる。
// 旅程生成と画像生成の両方が同じクライアント設定・同じステータス判定を使う。
package openrouterclient

import (
	"errors"
	"net/http"
	"time"

	openrouter "github.com/OpenRouterTeam/go-sdk"
	"github.com/OpenRouterTeam/go-sdk/models/sdkerrors"
	"github.com/OpenRouterTeam/go-sdk/retry"
)

// New は本番サーバー向けの SDK クライアントを生成する。
// リトライは SDK 側では行わず（呼び出し側の timeout/lease と競合するため）、HTTP と SDK の両方に同じ timeout を設定する。
func New(apiKey string, timeout time.Duration) *openrouter.OpenRouter {
	return openrouter.New(
		openrouter.WithServer(openrouter.ServerProduction),
		openrouter.WithSecurity(apiKey),
		openrouter.WithClient(&http.Client{Timeout: timeout}),
		openrouter.WithTimeout(timeout),
		openrouter.WithRetryConfig(NoRetry()),
	)
}

// NoRetry は SDK のリトライを無効にする設定を返す。
func NoRetry() retry.Config {
	return retry.Config{Strategy: "none"}
}

// StatusCode は SDK が返したエラーから HTTP ステータスコードを取り出す。
// 汎用の APIError と、ステータスごとの型付きエラーの両方に対応する。
func StatusCode(err error) (int, bool) {
	var apiError *sdkerrors.APIError
	if errors.As(err, &apiError) && apiError != nil && apiError.StatusCode >= 100 && apiError.StatusCode <= 599 {
		return apiError.StatusCode, true
	}

	typedErrors := []struct {
		status int
		target any
	}{
		{http.StatusBadRequest, new(*sdkerrors.BadRequestResponseError)},
		{http.StatusUnauthorized, new(*sdkerrors.UnauthorizedResponseError)},
		{http.StatusPaymentRequired, new(*sdkerrors.PaymentRequiredResponseError)},
		{http.StatusForbidden, new(*sdkerrors.ForbiddenResponseError)},
		{http.StatusNotFound, new(*sdkerrors.NotFoundResponseError)},
		{http.StatusRequestTimeout, new(*sdkerrors.RequestTimeoutResponseError)},
		{http.StatusRequestEntityTooLarge, new(*sdkerrors.PayloadTooLargeResponseError)},
		{http.StatusUnprocessableEntity, new(*sdkerrors.UnprocessableEntityResponseError)},
		{http.StatusTooManyRequests, new(*sdkerrors.TooManyRequestsResponseError)},
		{http.StatusInternalServerError, new(*sdkerrors.InternalServerResponseError)},
		{http.StatusBadGateway, new(*sdkerrors.BadGatewayResponseError)},
		{http.StatusServiceUnavailable, new(*sdkerrors.ServiceUnavailableResponseError)},
		{StatusEdgeNetworkTimeout, new(*sdkerrors.EdgeNetworkTimeoutResponseError)},
		{StatusProviderOverloaded, new(*sdkerrors.ProviderOverloadedResponseError)},
	}
	for _, typedError := range typedErrors {
		if errors.As(err, typedError.target) {
			return typedError.status, true
		}
	}
	return 0, false
}

// OpenRouter 固有の非標準ステータス。
const (
	StatusEdgeNetworkTimeout = 524
	StatusProviderOverloaded = 529
)

// RequestError は SDK 呼び出しの失敗を、ステータスコード付きでラップする。
// 本文（プロバイダーからのメッセージ）はログに出さないため Error() には含めない。
type RequestError struct {
	cause  error
	status int
}

// WrapRequestError は SDK のエラーを RequestError にラップする。
func WrapRequestError(cause error) error {
	if cause == nil {
		return nil
	}
	status, _ := StatusCode(cause)
	return &RequestError{cause: cause, status: status}
}

func (e *RequestError) Error() string { return "openrouter request failed" }

func (e *RequestError) Unwrap() error { return e.cause }

// ProviderStatusCode は HTTP ステータスコードを返す。不明なときは 0。
// observability が SDK に依存せずステータスを取り出すための契約。
func (e *RequestError) ProviderStatusCode() int { return e.status }
