package controller

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"

	"cacao/src/application"
)

// errorResponse はHTTPエラーレスポンスのJSON表現。
type errorResponse struct {
	Error  string `json:"error"`
	Detail string `json:"detail"`
}

// handleApplicationError はアプリケーション層のエラーをHTTPステータスにマッピングする。
func handleApplicationError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, application.ErrInvalidInput):
		c.JSON(http.StatusBadRequest, errorResponse{Error: "invalid input", Detail: "request data is invalid"})
	case errors.Is(err, application.ErrRequestNotFound):
		c.JSON(http.StatusNotFound, errorResponse{Error: "journey request not found", Detail: "journey request was not found"})
	case errors.Is(err, application.ErrJourneyNotFound):
		c.JSON(http.StatusNotFound, errorResponse{Error: "journey not found", Detail: "journey was not found"})
	case errors.Is(err, application.ErrJourneyImageNotFound):
		c.JSON(http.StatusNotFound, errorResponse{Error: "journey image not found", Detail: "journey image was not found"})
	case errors.Is(err, application.ErrJourneyImageNotReady):
		c.JSON(http.StatusConflict, errorResponse{Error: "journey image not ready", Detail: "journey image is not ready"})
	case errors.Is(err, application.ErrJourneyImageRetryNotAllowed):
		c.JSON(http.StatusConflict, errorResponse{Error: "journey image retry not allowed", Detail: "journey image cannot be retried"})
	case errors.Is(err, application.ErrGenerationFailed):
		c.JSON(http.StatusBadGateway, errorResponse{Error: "generation failed", Detail: "journey generation failed"})
	case errors.Is(err, application.ErrDuplicateID):
		c.JSON(http.StatusConflict, errorResponse{Error: "duplicate id", Detail: "the resource already exists"})
	default:
		c.JSON(http.StatusInternalServerError, errorResponse{Error: "internal server error", Detail: "internal server error"})
	}
}
