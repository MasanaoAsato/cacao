package controller

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"cacao/src/application"
	generatejourney "cacao/src/application/generate_journey"
	getjourney "cacao/src/application/get_journey"
	listjourneys "cacao/src/application/list_journeys"
)

type mockGenerateJourneyUseCase struct {
	output generatejourney.Output
	err    error
}

func (m *mockGenerateJourneyUseCase) Execute(_ context.Context, _ generatejourney.Input) (generatejourney.Output, error) {
	return m.output, m.err
}

type mockGetJourneyUseCase struct {
	output getjourney.Output
	err    error
}

func (m *mockGetJourneyUseCase) Execute(_ context.Context, _ getjourney.Input) (getjourney.Output, error) {
	return m.output, m.err
}

type mockListJourneysUseCase struct {
	output listjourneys.Output
	err    error
}

func (m *mockListJourneysUseCase) Execute(_ context.Context, _ listjourneys.Input) (listjourneys.Output, error) {
	return m.output, m.err
}

func TestHandleGenerate_Success(t *testing.T) {
	r := setupGin()
	uc := &mockGenerateJourneyUseCase{output: generatejourney.Output{JourneyID: "journey-1"}}
	r.POST("/journey-requests/:id/generate", HandleGenerate(uc))

	req := httptest.NewRequest(http.MethodPost, "/journey-requests/request-1/generate", nil)
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Errorf("expected 201, got %d: %s", w.Code, w.Body.String())
	}
}

func TestHandleGenerate_NotFound(t *testing.T) {
	r := setupGin()
	uc := &mockGenerateJourneyUseCase{err: application.ErrRequestNotFound}
	r.POST("/journey-requests/:id/generate", HandleGenerate(uc))

	req := httptest.NewRequest(http.MethodPost, "/journey-requests/request-1/generate", nil)
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Errorf("expected 404, got %d", w.Code)
	}
}

func TestHandleGenerate_GenerationFailed(t *testing.T) {
	r := setupGin()
	uc := &mockGenerateJourneyUseCase{err: application.ErrGenerationFailed}
	r.POST("/journey-requests/:id/generate", HandleGenerate(uc))

	req := httptest.NewRequest(http.MethodPost, "/journey-requests/request-1/generate", nil)
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadGateway {
		t.Errorf("expected 502, got %d", w.Code)
	}
}

func TestHandleGetJourney_Success(t *testing.T) {
	r := setupGin()
	uc := &mockGetJourneyUseCase{
		output: getjourney.Output{
			Journey: getjourney.JourneyDTO{
				ID:        "journey-1",
				RequestID: "request-1",
				DayCount:  1,
				Days: []getjourney.ItineraryDayDTO{
					{
						ID:    "day-1",
						Date:  time.Date(2026, 7, 1, 0, 0, 0, 0, time.UTC),
						Spots: []getjourney.SpotDTO{},
					},
				},
			},
		},
	}
	r.GET("/journeys/:id", HandleGetJourney(uc))

	req := httptest.NewRequest(http.MethodGet, "/journeys/journey-1", nil)
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}

func TestHandleGetJourney_NotFound(t *testing.T) {
	r := setupGin()
	uc := &mockGetJourneyUseCase{err: application.ErrJourneyNotFound}
	r.GET("/journeys/:id", HandleGetJourney(uc))

	req := httptest.NewRequest(http.MethodGet, "/journeys/journey-1", nil)
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Errorf("expected 404, got %d", w.Code)
	}
}

func TestHandleListJourneys_Success(t *testing.T) {
	r := setupGin()
	uc := &mockListJourneysUseCase{
		output: listjourneys.Output{
			Journeys: []listjourneys.JourneyDTO{
				{
					ID:        "journey-1",
					RequestID: "request-1",
					DayCount:  1,
					Days: []listjourneys.ItineraryDayDTO{
						{
							ID:    "day-1",
							Date:  time.Date(2026, 7, 1, 0, 0, 0, 0, time.UTC),
							Spots: []listjourneys.SpotDTO{},
						},
					},
				},
			},
		},
	}
	r.GET("/journeys", HandleListJourneys(uc))

	req := httptest.NewRequest(http.MethodGet, "/journeys", nil)
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}

func TestHandleListJourneys_InternalError(t *testing.T) {
	r := setupGin()
	uc := &mockListJourneysUseCase{err: errors.New("unexpected")}
	r.GET("/journeys", HandleListJourneys(uc))

	req := httptest.NewRequest(http.MethodGet, "/journeys", nil)
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Errorf("expected 500, got %d", w.Code)
	}
}
