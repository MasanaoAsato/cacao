package readmodel

import (
	"testing"

	"cacao/src/domain/entity"
	"cacao/src/domain/value_object"
	"cacao/src/internal/testkit"
)

func TestNewJourneyRequestDTOCopiesPlaceComponentsWithoutSplitting(t *testing.T) {
	departure, err := value_object.NewDeparture("Washington, D.C.", "United States")
	if err != nil {
		t.Fatalf("NewDeparture() error = %v", err)
	}
	destination, err := value_object.NewDestination("東京", "")
	if err != nil {
		t.Fatalf("NewDestination() error = %v", err)
	}
	request, err := entity.NewJourneyRequest(
		value_object.NewID(),
		departure,
		destination,
		testkit.MustNewPeriod(t, testkit.DefaultPeriodStart, testkit.DefaultPeriodEnd),
		testkit.MustNewMoney(t, 50000, "JPY"),
	)
	if err != nil {
		t.Fatalf("NewJourneyRequest() error = %v", err)
	}

	dto := NewJourneyRequestDTO(request)

	if dto.Departure != "Washington, D.C., United States" {
		t.Errorf("Departure = %q", dto.Departure)
	}
	if dto.DepartureCity != "Washington, D.C." || dto.DepartureCountry != "United States" {
		t.Errorf("departure place = (%q, %q)", dto.DepartureCity, dto.DepartureCountry)
	}
	if dto.Destination != "東京" {
		t.Errorf("Destination = %q", dto.Destination)
	}
	if dto.DestinationCity != "東京" || dto.DestinationCountry != "" {
		t.Errorf("destination place = (%q, %q)", dto.DestinationCity, dto.DestinationCountry)
	}
}
