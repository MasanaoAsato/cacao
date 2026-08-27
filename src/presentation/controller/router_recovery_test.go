package controller

import (
	"bytes"
	"errors"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestSafeRecoveryLogsPanicTypeWithoutPanicValue(t *testing.T) {
	gin.SetMode(gin.TestMode)
	const secret = "authorization=Bearer secret-value"

	var logs bytes.Buffer
	previousLogger := slog.Default()
	slog.SetDefault(slog.New(slog.NewJSONHandler(&logs, nil)))
	t.Cleanup(func() {
		slog.SetDefault(previousLogger)
	})

	router := gin.New()
	router.Use(safeRecovery())
	router.GET("/api/v1/journeys/:id", func(*gin.Context) {
		panic(errors.New(secret))
	})

	response := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/api/v1/journeys/secret-value", nil)
	router.ServeHTTP(response, request)

	if response.Code != http.StatusInternalServerError {
		t.Errorf("status = %d, want %d", response.Code, http.StatusInternalServerError)
	}

	logText := logs.String()
	for _, want := range []string{
		`"operation":"http_panic"`,
		`"route":"/api/v1/journeys/:id"`,
		`"panic_type":"*errors.errorString"`,
	} {
		if !strings.Contains(logText, want) {
			t.Errorf("logs = %q, want fragment %q", logText, want)
		}
	}
	for _, forbidden := range []string{secret, "secret-value"} {
		if strings.Contains(logText, forbidden) {
			t.Errorf("logs expose %q: %q", forbidden, logText)
		}
	}
}
