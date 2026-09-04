package controller

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"cacao/src/application"
	exportjourneybooklet "cacao/src/application/export_journey_booklet"

	"github.com/gin-gonic/gin"
)

type bookletExportUseCaseMock struct {
	err    error
	input  exportjourneybooklet.Input
	output exportjourneybooklet.Output
}

func (m *bookletExportUseCaseMock) Execute(
	_ context.Context,
	input exportjourneybooklet.Input,
) (exportjourneybooklet.Output, error) {
	m.input = input
	return m.output, m.err
}

func TestHandleExportJourneyBookletReturnsPDF(t *testing.T) {
	gin.SetMode(gin.TestMode)
	useCase := &bookletExportUseCaseMock{
		output: exportjourneybooklet.Output{
			Content:   []byte("%PDF-1.4\n"),
			FileName:  "journey-booklet-journey-1.pdf",
			MediaType: "application/pdf",
		},
	}
	router := gin.New()
	router.GET("/api/v1/journeys/:id/booklet.pdf", HandleExportJourneyBooklet(useCase))
	request := httptest.NewRequest(
		http.MethodGet,
		"/api/v1/journeys/journey-1/booklet.pdf?seed=v1-abcdef12",
		nil,
	)
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", response.Code, http.StatusOK)
	}
	if got, want := response.Header().Get("Content-Type"), "application/pdf"; got != want {
		t.Errorf("Content-Type = %q, want %q", got, want)
	}
	if got, want := response.Header().Get("Content-Disposition"), "attachment; filename=\"journey-booklet-journey-1.pdf\""; got != want {
		t.Errorf("Content-Disposition = %q, want %q", got, want)
	}
	if got, want := response.Header().Get("Cache-Control"), "no-store"; got != want {
		t.Errorf("Cache-Control = %q, want %q", got, want)
	}
	if got, want := response.Body.String(), "%PDF-1.4\n"; got != want {
		t.Errorf("body = %q, want %q", got, want)
	}
	if got, want := useCase.input.JourneyID, "journey-1"; got != want {
		t.Errorf("JourneyID = %q, want %q", got, want)
	}
	if got, want := useCase.input.Seed, "v1-abcdef12"; got != want {
		t.Errorf("Seed = %q, want %q", got, want)
	}
}

func TestHandleExportJourneyBookletMapsErrors(t *testing.T) {
	tests := []struct {
		name           string
		err            error
		wantError      string
		wantRetryAfter string
		wantStatus     int
	}{
		{
			name:           "異常系: 同時実行枠が埋まっている",
			err:            fmtError(application.ErrBookletRendererBusy),
			wantError:      "booklet renderer busy",
			wantRetryAfter: "5",
			wantStatus:     http.StatusServiceUnavailable,
		},
		{
			name:       "異常系: 描画に失敗した",
			err:        fmtError(application.ErrBookletRenderFailed),
			wantError:  "booklet render failed",
			wantStatus: http.StatusInternalServerError,
		},
	}

	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			gin.SetMode(gin.TestMode)
			router := gin.New()
			router.GET(
				"/api/v1/journeys/:id/booklet.pdf",
				HandleExportJourneyBooklet(&bookletExportUseCaseMock{err: testCase.err}),
			)
			request := httptest.NewRequest(http.MethodGet, "/api/v1/journeys/journey-1/booklet.pdf", nil)
			response := httptest.NewRecorder()

			router.ServeHTTP(response, request)

			if response.Code != testCase.wantStatus {
				t.Fatalf("status = %d, want %d", response.Code, testCase.wantStatus)
			}
			if got := response.Header().Get("Retry-After"); got != testCase.wantRetryAfter {
				t.Errorf("Retry-After = %q, want %q", got, testCase.wantRetryAfter)
			}
			var body errorResponse
			if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil {
				t.Fatalf("decode error response: %v", err)
			}
			if body.Error != testCase.wantError {
				t.Errorf("error = %q, want %q", body.Error, testCase.wantError)
			}
		})
	}
}

func fmtError(err error) error {
	return errors.Join(errors.New("render request"), err)
}
