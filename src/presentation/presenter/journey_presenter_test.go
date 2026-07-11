package presenter

import (
	"testing"
	"time"

	getjourney "cacao/src/application/get_journey"
	listjourneys "cacao/src/application/list_journeys"
)

func TestToJourneyResponse(t *testing.T) {
	date := time.Date(2026, 7, 1, 0, 0, 0, 0, time.UTC)
	dto := getjourney.JourneyDTO{
		ID:        "journey-1",
		RequestID: "request-1",
		DayCount:  1,
		Days: []getjourney.ItineraryDayDTO{
			{
				ID:   "day-1",
				Date: date,
				Spots: []getjourney.SpotDTO{
					{
						ID:            "spot-1",
						Name:          "観光地",
						Description:   "楽しい場所",
						StartAt:       date.Add(time.Hour * 9),
						EstimatedCost: getjourney.MoneyDTO{Amount: 1000, Currency: "JPY"},
					},
				},
			},
		},
	}

	resp := ToJourneyResponse(dto)

	if resp.ID != dto.ID {
		t.Errorf("ID mismatch: got %s, want %s", resp.ID, dto.ID)
	}
	if resp.RequestID != dto.RequestID {
		t.Errorf("RequestID mismatch: got %s, want %s", resp.RequestID, dto.RequestID)
	}
	if resp.DayCount != dto.DayCount {
		t.Errorf("DayCount mismatch: got %d, want %d", resp.DayCount, dto.DayCount)
	}
	if len(resp.Days) != 1 {
		t.Fatalf("expected 1 day, got %d", len(resp.Days))
	}
	if resp.Days[0].Date != date.Format(time.RFC3339) {
		t.Errorf("Date mismatch: got %s, want %s", resp.Days[0].Date, date.Format(time.RFC3339))
	}
}

func TestToJourneyListResponse(t *testing.T) {
	date := time.Date(2026, 7, 1, 0, 0, 0, 0, time.UTC)
	dtos := []listjourneys.JourneyDTO{
		{
			ID:        "journey-1",
			RequestID: "request-1",
			DayCount:  1,
			Days: []listjourneys.ItineraryDayDTO{
				{
					ID:    "day-1",
					Date:  date,
					Spots: []listjourneys.SpotDTO{},
				},
			},
		},
	}

	resp := ToJourneyListResponse(dtos)
	if len(resp) != 1 {
		t.Fatalf("expected 1 response, got %d", len(resp))
	}
	if resp[0].ID != "journey-1" {
		t.Errorf("ID mismatch: got %s", resp[0].ID)
	}
}

func TestToJourneyListResponse_Empty(t *testing.T) {
	resp := ToJourneyListResponse([]listjourneys.JourneyDTO{})
	if resp == nil || len(resp) != 0 {
		t.Errorf("expected empty non-nil slice, got %v", resp)
	}
}
