package controller

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"cacao/src/application/get_journey_request"
	"cacao/src/application/readmodel"
)

func TestHandleGetRequestReturnsPlaceComponents(t *testing.T) {
	router := setupGin()
	router.GET("/journey-requests/:id", HandleGetRequest(&mockGetJourneyRequestUseCase{
		output: getjourneyrequest.Output{Request: readmodel.JourneyRequestDTO{
			ID:                 "request-1",
			Departure:          "Washington, D.C., United States",
			DepartureCity:      "Washington, D.C.",
			DepartureCountry:   "United States",
			Destination:        "東京",
			DestinationCity:    "東京",
			DestinationCountry: "",
			Period: readmodel.PeriodDTO{
				StartDate: time.Date(2026, 7, 1, 0, 0, 0, 0, time.UTC),
				EndDate:   time.Date(2026, 7, 3, 0, 0, 0, 0, time.UTC),
			},
			Budget: readmodel.MoneyDTO{Amount: 30000, Currency: "JPY"},
		}},
	}))

	request := httptest.NewRequest(http.MethodGet, "/journey-requests/request-1", nil)
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", recorder.Code, recorder.Body.String())
	}
	var response map[string]any
	if err := json.NewDecoder(recorder.Body).Decode(&response); err != nil {
		t.Fatalf("Decode() error = %v", err)
	}
	if response["departure_city"] != "Washington, D.C." || response["departure_country"] != "United States" {
		t.Errorf("departure place response = %#v", response)
	}
	if response["destination_city"] != "東京" || response["destination_country"] != "" {
		t.Errorf("destination place response = %#v", response)
	}
}
