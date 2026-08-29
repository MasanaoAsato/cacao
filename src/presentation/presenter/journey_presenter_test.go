package presenter

import (
	"encoding/json"
	"strings"
	"testing"
	"time"

	generatejourney "cacao/src/application/generate_journey"
	getjourney "cacao/src/application/get_journey"
	listjourneys "cacao/src/application/list_journeys"
)

func TestToGenerateJourneyResponse(t *testing.T) {
	response := ToGenerateJourneyResponse(generatejourney.Output{JourneyID: "journey-1"})

	if response.JourneyID != "journey-1" {
		t.Errorf("JourneyID mismatch: got %s", response.JourneyID)
	}
	if response.RequestID != "journey-1" {
		t.Errorf("legacy RequestID mismatch: got %s", response.RequestID)
	}

	encoded, err := json.Marshal(response)
	if err != nil {
		t.Fatalf("failed to marshal response: %v", err)
	}
	if string(encoded) != `{"journey_id":"journey-1","request_id":"journey-1"}` {
		t.Errorf("unexpected JSON: %s", encoded)
	}
}

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

func TestToJourneyResponse_Legs(t *testing.T) {
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
						Name:          "通天閣",
						Description:   "展望台",
						StartAt:       date.Add(time.Hour * 9),
						EstimatedCost: getjourney.MoneyDTO{Amount: 1000, Currency: "JPY"},
					},
				},
				Legs: []getjourney.LegDTO{
					{
						ID: "leg-1",
						// 旅程外地点（from）は SpotID 省略
						From: getjourney.EndpointDTO{SpotID: "", Label: "大阪（出発地）"},
						// スポット参照（to）は SpotID + 解決済み Label
						To:            getjourney.EndpointDTO{SpotID: "spot-1", Label: "通天閣"},
						Mode:          "train",
						EstimatedCost: getjourney.MoneyDTO{Amount: 240, Currency: "JPY"},
					},
				},
			},
		},
	}

	resp := ToJourneyResponse(dto)
	if len(resp.Days) != 1 {
		t.Fatalf("expected 1 day, got %d", len(resp.Days))
	}
	legs := resp.Days[0].Legs
	if len(legs) != 1 {
		t.Fatalf("expected 1 leg, got %d", len(legs))
	}

	leg := legs[0]
	if leg.ID != "leg-1" {
		t.Errorf("leg ID mismatch: got %s", leg.ID)
	}
	if leg.From.SpotID != "" {
		t.Errorf("from spot_id should be omitted, got %q", leg.From.SpotID)
	}
	if leg.From.Label != "大阪（出発地）" {
		t.Errorf("from label mismatch: got %q", leg.From.Label)
	}
	if leg.To.SpotID != "spot-1" {
		t.Errorf("to spot_id mismatch: got %q", leg.To.SpotID)
	}
	if leg.To.Label != "通天閣" {
		t.Errorf("to label mismatch: got %q", leg.To.Label)
	}
	if leg.Mode != "train" {
		t.Errorf("mode mismatch: got %q", leg.Mode)
	}
	if leg.DurationMinutes != 0 {
		t.Errorf("duration minutes mismatch: got %d", leg.DurationMinutes)
	}
	if leg.EstimatedCost.Amount != 240 || leg.EstimatedCost.Currency != "JPY" {
		t.Errorf("cost mismatch: got %+v", leg.EstimatedCost)
	}

	// JSON エンコード時に旅程外地点の spot_id が省略されることを確認する
	b, err := json.Marshal(resp)
	if err != nil {
		t.Fatalf("failed to marshal: %v", err)
	}
	s := string(b)
	if !strings.Contains(s, `"label":"大阪（出発地）"`) {
		t.Errorf("expected from label in JSON, got %s", s)
	}
	if strings.Contains(s, `"from":{"spot_id":"","label":"大阪（出発地）"}`) {
		t.Errorf("from spot_id should be omitted in JSON, got %s", s)
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
