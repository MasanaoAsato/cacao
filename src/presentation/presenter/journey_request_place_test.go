package presenter

import (
	"testing"
	"time"

	"cacao/src/application/readmodel"
)

func TestToJourneyRequestResponseIncludesPlaceComponents(t *testing.T) {
	response := ToJourneyRequestResponse(readmodel.JourneyRequestDTO{
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
	})

	if response.DepartureCity != "Washington, D.C." || response.DepartureCountry != "United States" {
		t.Errorf("departure place = (%q, %q)", response.DepartureCity, response.DepartureCountry)
	}
	if response.DestinationCity != "東京" || response.DestinationCountry != "" {
		t.Errorf("destination place = (%q, %q)", response.DestinationCity, response.DestinationCountry)
	}
}
