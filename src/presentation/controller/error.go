package controller

import (
	"context"
	"errors"
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"

	"cacao/src/application"
	"cacao/src/observability"
)

// errorResponse はHTTPエラーレスポンスのJSON表現。
type errorResponse struct {
	Error  string `json:"error"`
	Detail string `json:"detail"`
}

// handleApplicationError はアプリケーション層のエラーを安全に記録してHTTP応答へ変換する。
func handleApplicationError(c *gin.Context, err error) {
	status, response := applicationErrorResponse(err)
	logHTTPFailure(c, status, err)
	c.JSON(status, response)
}

func applicationErrorResponse(err error) (int, errorResponse) {
	switch {
	case errors.Is(err, application.ErrInvalidInput):
		return http.StatusBadRequest, errorResponse{Error: "invalid input", Detail: "request data is invalid"}
	case errors.Is(err, application.ErrRequestNotFound):
		return http.StatusNotFound, errorResponse{Error: "journey request not found", Detail: "journey request was not found"}
	case errors.Is(err, application.ErrJourneyNotFound):
		return http.StatusNotFound, errorResponse{Error: "journey not found", Detail: "journey was not found"}
	case errors.Is(err, application.ErrJourneyImageNotFound):
		return http.StatusNotFound, errorResponse{Error: "journey image not found", Detail: "journey image was not found"}
	case errors.Is(err, application.ErrJourneyImageNotReady):
		return http.StatusConflict, errorResponse{Error: "journey image not ready", Detail: "journey image is not ready"}
	case errors.Is(err, application.ErrJourneyImageRetryNotAllowed):
		return http.StatusConflict, errorResponse{Error: "journey image retry not allowed", Detail: "journey image cannot be retried"}
	case errors.Is(err, application.ErrGenerationFailed):
		return http.StatusBadGateway, errorResponse{Error: "generation failed", Detail: "journey generation failed"}
	case errors.Is(err, application.ErrBookletRendererBusy):
		return http.StatusServiceUnavailable, errorResponse{Error: "booklet renderer busy", Detail: "booklet renderer is busy"}
	case errors.Is(err, application.ErrBookletRenderFailed):
		return http.StatusInternalServerError, errorResponse{Error: "booklet render failed", Detail: "booklet render failed"}
	case errors.Is(err, application.ErrDuplicateID):
		return http.StatusConflict, errorResponse{Error: "duplicate id", Detail: "the resource already exists"}
	default:
		return http.StatusInternalServerError, errorResponse{Error: "internal server error", Detail: "internal server error"}
	}
}

func logHTTPFailure(c *gin.Context, status int, err error) {
	level := slog.LevelWarn
	if status >= http.StatusInternalServerError {
		level = slog.LevelError
	}

	observability.LogFailure(
		requestContext(c),
		slog.Default(),
		level,
		observability.FailureContext{
			Operation: "http_request",
			Route:     routeName(c),
			Status:    status,
		},
		err,
	)
}

func requestContext(c *gin.Context) context.Context {
	if c != nil && c.Request != nil {
		return c.Request.Context()
	}
	return context.Background()
}

func routeName(c *gin.Context) string {
	if c == nil {
		return ""
	}
	return c.FullPath()
}
