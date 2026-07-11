package presenter

import (
	"testing"
	"time"

	createjourneyrequest "cacao/src/application/create_journey_request"
	getjourneyrequest "cacao/src/application/get_journey_request"
	listjourneyrequests "cacao/src/application/list_journey_requests"
)

func TestToCreateJourneyRequestResponse(t *testing.T) {
	output := createjourneyrequest.Output{RequestID: "request-1"}
	resp := ToCreateJourneyRequestResponse(output)
	if resp.RequestID != output.RequestID {
		t.Errorf("RequestID mismatch: got %s, want %s", resp.RequestID, output.RequestID)
	}
}

func TestToJourneyRequestResponse(t *testing.T) {
	start := time.Date(2026, 7, 1, 0, 0, 0, 0, time.UTC)
	end := time.Date(2026, 7, 3, 0, 0, 0, 0, time.UTC)
	dto := getjourneyrequest.JourneyRequestDTO{
		ID:        "request-1",
		Departure: "東京, 日本",
		Period: getjourneyrequest.PeriodDTO{
			StartDate: start,
			EndDate:   end,
		},
		Budget: getjourneyrequest.MoneyDTO{Amount: 30000, Currency: "JPY"},
	}

	resp := ToJourneyRequestResponse(dto)

	if resp.ID != dto.ID {
		t.Errorf("ID mismatch: got %s, want %s", resp.ID, dto.ID)
	}
	if resp.Departure != dto.Departure {
		t.Errorf("Departure mismatch: got %s, want %s", resp.Departure, dto.Departure)
	}
	if resp.Period.StartDate != start.Format(time.RFC3339) {
		t.Errorf("StartDate mismatch: got %s, want %s", resp.Period.StartDate, start.Format(time.RFC3339))
	}
	if resp.Budget.Amount != 30000 {
		t.Errorf("Amount mismatch: got %d, want 30000", resp.Budget.Amount)
	}
}

func TestToJourneyRequestListResponse(t *testing.T) {
	start := time.Date(2026, 7, 1, 0, 0, 0, 0, time.UTC)
	end := time.Date(2026, 7, 3, 0, 0, 0, 0, time.UTC)
	dtos := []listjourneyrequests.JourneyRequestDTO{
		{
			ID:        "request-1",
			Departure: "東京, 日本",
			Period: listjourneyrequests.PeriodDTO{
				StartDate: start,
				EndDate:   end,
			},
			Budget: listjourneyrequests.MoneyDTO{Amount: 30000, Currency: "JPY"},
		},
	}

	resp := ToJourneyRequestListResponse(dtos)
	if len(resp) != 1 {
		t.Fatalf("expected 1 response, got %d", len(resp))
	}
	if resp[0].ID != "request-1" {
		t.Errorf("ID mismatch: got %s", resp[0].ID)
	}
}

func TestToJourneyRequestListResponse_Empty(t *testing.T) {
	resp := ToJourneyRequestListResponse([]listjourneyrequests.JourneyRequestDTO{})
	if resp == nil || len(resp) != 0 {
		t.Errorf("expected empty non-nil slice, got %v", resp)
	}
}
