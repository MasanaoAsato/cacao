package controller

import (
	"bytes"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"

	"cacao/src/application"
)

func TestHandleApplicationErrorLogsRouteTemplateWithoutErrorValue(t *testing.T) {
	gin.SetMode(gin.TestMode)
	const secret = "api_key=secret-value prompt=private-itinerary"

	var logs bytes.Buffer
	previousLogger := slog.Default()
	slog.SetDefault(slog.New(slog.NewJSONHandler(&logs, nil)))
	t.Cleanup(func() {
		slog.SetDefault(previousLogger)
	})

	router := gin.New()
	router.GET("/api/v1/journeys/:id", func(c *gin.Context) {
		handleApplicationError(
			c,
			fmt.Errorf("generate journey: %w: %w", application.ErrGenerationFailed, errors.New(secret)),
		)
	})

	response := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/api/v1/journeys/secret-value", nil)
	router.ServeHTTP(response, request)

	if response.Code != http.StatusBadGateway {
		t.Errorf("status = %d, want %d", response.Code, http.StatusBadGateway)
	}

	logText := logs.String()
	for _, want := range []string{
		`"operation":"http_request"`,
		`"route":"/api/v1/journeys/:id"`,
		`"status":502`,
		`"error_kind":"generation_failed"`,
	} {
		if !strings.Contains(logText, want) {
			t.Errorf("logs = %q, want fragment %q", logText, want)
		}
	}
	for _, forbidden := range []string{secret, "secret-value", "private-itinerary"} {
		if strings.Contains(logText, forbidden) {
			t.Errorf("logs expose %q: %q", forbidden, logText)
		}
	}
}
