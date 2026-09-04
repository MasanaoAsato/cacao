package controller

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestNewRouter_RegistersRoutes(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := NewRouter(Dependencies{
		CreateJourneyRequest: &mockCreateJourneyRequestUseCase{},
		GenerateJourney:      &mockGenerateJourneyUseCase{},
		GetJourney:           &mockGetJourneyUseCase{},
		ListJourneys:         &mockListJourneysUseCase{},
		GetJourneyRequest:    &mockGetJourneyRequestUseCase{},
		ListJourneyRequests:  &mockListJourneyRequestsUseCase{},
		ExportJourneyBooklet: &bookletExportUseCaseMock{},
	})

	routes := []struct {
		method string
		path   string
	}{
		{http.MethodPost, "/api/v1/journey-requests"},
		{http.MethodGet, "/api/v1/journey-requests"},
		{http.MethodGet, "/api/v1/journey-requests/:id"},
		{http.MethodPost, "/api/v1/journey-requests/:id/generate"},
		{http.MethodGet, "/api/v1/journeys"},
		{http.MethodGet, "/api/v1/journeys/:id/booklet.pdf"},
		{http.MethodGet, "/api/v1/journeys/:id"},
	}

	for _, route := range routes {
		req := httptest.NewRequest(route.method, route.path, nil)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		if w.Code == http.StatusNotFound {
			t.Errorf("route %s %s not registered", route.method, route.path)
		}
	}
}
