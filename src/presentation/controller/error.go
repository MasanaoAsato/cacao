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
		c.JSON(http.StatusBadRequest, errorResponse{Error: "invalid input", Detail: err.Error()})
	case errors.Is(err, application.ErrRequestNotFound):
		c.JSON(http.StatusNotFound, errorResponse{Error: "journey request not found", Detail: err.Error()})
	case errors.Is(err, application.ErrJourneyNotFound):
		c.JSON(http.StatusNotFound, errorResponse{Error: "journey not found", Detail: err.Error()})
	case errors.Is(err, application.ErrGenerationFailed):
		c.JSON(http.StatusBadGateway, errorResponse{Error: "generation failed", Detail: err.Error()})
	case errors.Is(err, application.ErrDuplicateID):
		c.JSON(http.StatusConflict, errorResponse{Error: "duplicate id", Detail: err.Error()})
	default:
		c.JSON(http.StatusInternalServerError, errorResponse{Error: "internal server error", Detail: err.Error()})
	}
}
