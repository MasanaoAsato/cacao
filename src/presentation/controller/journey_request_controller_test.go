package controller

import (
	"bytes"
	"cacao/src/application/readmodel"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"

	"cacao/src/application"
	createjourneyrequest "cacao/src/application/create_journey_request"
	getjourneyrequest "cacao/src/application/get_journey_request"
	listjourneyrequests "cacao/src/application/list_journey_requests"
)

func setupGin() *gin.Engine {
	gin.SetMode(gin.TestMode)
	return gin.New()
}

type mockCreateJourneyRequestUseCase struct {
	output createjourneyrequest.Output
	err    error
	input  createjourneyrequest.Input
}

func (m *mockCreateJourneyRequestUseCase) Execute(_ context.Context, input createjourneyrequest.Input) (createjourneyrequest.Output, error) {
	m.input = input
	return m.output, m.err
}

type mockGetJourneyRequestUseCase struct {
	output getjourneyrequest.Output
	err    error
}

func (m *mockGetJourneyRequestUseCase) Execute(_ context.Context, _ getjourneyrequest.Input) (getjourneyrequest.Output, error) {
	return m.output, m.err
}

type mockListJourneyRequestsUseCase struct {
	output listjourneyrequests.Output
	err    error
}

func (m *mockListJourneyRequestsUseCase) Execute(_ context.Context, _ listjourneyrequests.Input) (listjourneyrequests.Output, error) {
	return m.output, m.err
}

func TestHandleCreate_Success(t *testing.T) {
	r := setupGin()
	uc := &mockCreateJourneyRequestUseCase{output: createjourneyrequest.Output{RequestID: "request-1"}}
	r.POST("/journey-requests", HandleCreate(uc))

	body := map[string]any{
		"departure_city":      "東京",
		"departure_country":   "日本",
		"destination_city":    "大阪",
		"destination_country": "日本",
		"start_date":          "2026-07-01T00:00:00Z",
		"end_date":            "2026-07-03T00:00:00Z",
		"amount":              60000,
		"currency":            "JPY",
	}
	b, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, "/journey-requests", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Errorf("expected 201, got %d: %s", w.Code, w.Body.String())
	}
	if uc.input.DestinationCity != "大阪" {
		t.Errorf("destination city = %q, want 大阪", uc.input.DestinationCity)
	}
	if uc.input.DestinationCountry != "日本" {
		t.Errorf("destination country = %q, want 日本", uc.input.DestinationCountry)
	}
}

func TestHandleCreate_Success_WithoutDestinationCountry(t *testing.T) {
	r := setupGin()
	uc := &mockCreateJourneyRequestUseCase{output: createjourneyrequest.Output{RequestID: "request-1"}}
	r.POST("/journey-requests", HandleCreate(uc))

	body := map[string]any{
		"departure_city":    "東京",
		"departure_country": "日本",
		"destination_city":  "大阪",
		"start_date":        "2026-07-01T00:00:00Z",
		"end_date":          "2026-07-03T00:00:00Z",
		"amount":            60000,
		"currency":          "JPY",
	}
	b, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, "/journey-requests", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Errorf("expected 201, got %d: %s", w.Code, w.Body.String())
	}
	if uc.input.DestinationCountry != "" {
		t.Errorf("destination country = %q, want empty", uc.input.DestinationCountry)
	}
}

func TestHandleCreate_InvalidJSON(t *testing.T) {
	r := setupGin()
	uc := &mockCreateJourneyRequestUseCase{}
	r.POST("/journey-requests", HandleCreate(uc))

	req := httptest.NewRequest(http.MethodPost, "/journey-requests", bytes.NewReader([]byte("not json")))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}
}

func TestHandleCreate_InvalidInput(t *testing.T) {
	r := setupGin()
	uc := &mockCreateJourneyRequestUseCase{err: application.ErrInvalidInput}
	r.POST("/journey-requests", HandleCreate(uc))

	body := map[string]any{
		"departure_city":      "東京",
		"departure_country":   "日本",
		"destination_city":    "大阪",
		"destination_country": "日本",
		"start_date":          "2026-07-01T00:00:00Z",
		"end_date":            "2026-07-03T00:00:00Z",
		"amount":              60000,
		"currency":            "JPY",
	}
	b, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, "/journey-requests", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}
}

func TestHandleCreate_InvalidDate(t *testing.T) {
	r := setupGin()
	uc := &mockCreateJourneyRequestUseCase{}
	r.POST("/journey-requests", HandleCreate(uc))

	body := map[string]any{
		"departure_city":      "東京",
		"departure_country":   "日本",
		"destination_city":    "大阪",
		"destination_country": "日本",
		"start_date":          "invalid",
		"end_date":            "2026-07-03T00:00:00Z",
		"amount":              60000,
		"currency":            "JPY",
	}
	b, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, "/journey-requests", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}
}

func TestHandleGetRequest_Success(t *testing.T) {
	r := setupGin()
	uc := &mockGetJourneyRequestUseCase{
		output: getjourneyrequest.Output{
			Request: readmodel.JourneyRequestDTO{
				ID:          "request-1",
				Departure:   "東京, 日本",
				Destination: "大阪, 日本",
				Period: readmodel.PeriodDTO{
					StartDate: time.Date(2026, 7, 1, 0, 0, 0, 0, time.UTC),
					EndDate:   time.Date(2026, 7, 3, 0, 0, 0, 0, time.UTC),
				},
				Budget: readmodel.MoneyDTO{Amount: 30000, Currency: "JPY"},
			},
		},
	}
	r.GET("/journey-requests/:id", HandleGetRequest(uc))

	req := httptest.NewRequest(http.MethodGet, "/journey-requests/request-1", nil)
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}

func TestHandleGetRequest_NotFound(t *testing.T) {
	r := setupGin()
	uc := &mockGetJourneyRequestUseCase{err: application.ErrRequestNotFound}
	r.GET("/journey-requests/:id", HandleGetRequest(uc))

	req := httptest.NewRequest(http.MethodGet, "/journey-requests/request-1", nil)
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Errorf("expected 404, got %d", w.Code)
	}
}

func TestHandleListRequests_Success(t *testing.T) {
	r := setupGin()
	uc := &mockListJourneyRequestsUseCase{
		output: listjourneyrequests.Output{
			Requests: []readmodel.JourneyRequestDTO{
				{
					ID:          "request-1",
					Departure:   "東京, 日本",
					Destination: "大阪, 日本",
					Period: readmodel.PeriodDTO{
						StartDate: time.Date(2026, 7, 1, 0, 0, 0, 0, time.UTC),
						EndDate:   time.Date(2026, 7, 3, 0, 0, 0, 0, time.UTC),
					},
					Budget: readmodel.MoneyDTO{Amount: 30000, Currency: "JPY"},
				},
			},
		},
	}
	r.GET("/journey-requests", HandleListRequests(uc))

	req := httptest.NewRequest(http.MethodGet, "/journey-requests", nil)
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}

func TestHandleListRequests_InternalError(t *testing.T) {
	r := setupGin()
	uc := &mockListJourneyRequestsUseCase{err: errors.New("unexpected")}
	r.GET("/journey-requests", HandleListRequests(uc))

	req := httptest.NewRequest(http.MethodGet, "/journey-requests", nil)
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Errorf("expected 500, got %d", w.Code)
	}
}
