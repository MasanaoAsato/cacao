package presenter

import (
	"time"

	getjourney "cacao/src/application/get_journey"
	listjourneys "cacao/src/application/list_journeys"
)

// JourneyResponse は Journey 系APIのJSONレスポンス。
type JourneyResponse struct {
	ID        string             `json:"id"`
	RequestID string             `json:"request_id"`
	DayCount  int                `json:"day_count"`
	Days      []ItineraryDayJSON `json:"days"`
}

// ItineraryDayJSON は旅程1日分のJSON表現。
type ItineraryDayJSON struct {
	ID    string     `json:"id"`
	Date  string     `json:"date"`
	Spots []SpotJSON `json:"spots"`
}

// SpotJSON は訪問先のJSON表現。
type SpotJSON struct {
	ID            string    `json:"id"`
	Name          string    `json:"name"`
	Description   string    `json:"description"`
	StartAt       string    `json:"start_at"`
	EstimatedCost MoneyJSON `json:"estimated_cost"`
}

// MoneyJSON は金額のJSON表現。
type MoneyJSON struct {
	Amount   int    `json:"amount"`
	Currency string `json:"currency"`
}

// ToJourneyResponse は GetJourney のOutputからJourneyResponseを組み立てる。
func ToJourneyResponse(dto getjourney.JourneyDTO) JourneyResponse {
	return JourneyResponse{
		ID:        dto.ID,
		RequestID: dto.RequestID,
		DayCount:  dto.DayCount,
		Days:      toItineraryDayJSONs(dto.Days),
	}
}

// ToJourneyListResponse は ListJourneys のOutputからJourneyResponseのスライスを組み立てる。
func ToJourneyListResponse(dtos []listjourneys.JourneyDTO) []JourneyResponse {
	responses := make([]JourneyResponse, 0, len(dtos))
	for _, dto := range dtos {
		responses = append(responses, JourneyResponse{
			ID:        dto.ID,
			RequestID: dto.RequestID,
			DayCount:  dto.DayCount,
			Days:      toItineraryDayJSONsFromList(dto.Days),
		})
	}
	return responses
}

func toItineraryDayJSONs(dtos []getjourney.ItineraryDayDTO) []ItineraryDayJSON {
	result := make([]ItineraryDayJSON, 0, len(dtos))
	for _, dto := range dtos {
		result = append(result, ItineraryDayJSON{
			ID:    dto.ID,
			Date:  dto.Date.Format(time.RFC3339),
			Spots: toSpotJSONsFromGet(dto.Spots),
		})
	}
	return result
}

func toItineraryDayJSONsFromList(dtos []listjourneys.ItineraryDayDTO) []ItineraryDayJSON {
	result := make([]ItineraryDayJSON, 0, len(dtos))
	for _, dto := range dtos {
		result = append(result, ItineraryDayJSON{
			ID:    dto.ID,
			Date:  dto.Date.Format(time.RFC3339),
			Spots: toSpotJSONsFromList(dto.Spots),
		})
	}
	return result
}

func toSpotJSONsFromGet(dtos []getjourney.SpotDTO) []SpotJSON {
	result := make([]SpotJSON, 0, len(dtos))
	for _, dto := range dtos {
		result = append(result, SpotJSON{
			ID:            dto.ID,
			Name:          dto.Name,
			Description:   dto.Description,
			StartAt:       dto.StartAt.Format(time.RFC3339),
			EstimatedCost: MoneyJSON{Amount: dto.EstimatedCost.Amount, Currency: dto.EstimatedCost.Currency},
		})
	}
	return result
}

func toSpotJSONsFromList(dtos []listjourneys.SpotDTO) []SpotJSON {
	result := make([]SpotJSON, 0, len(dtos))
	for _, dto := range dtos {
		result = append(result, SpotJSON{
			ID:            dto.ID,
			Name:          dto.Name,
			Description:   dto.Description,
			StartAt:       dto.StartAt.Format(time.RFC3339),
			EstimatedCost: MoneyJSON{Amount: dto.EstimatedCost.Amount, Currency: dto.EstimatedCost.Currency},
		})
	}
	return result
}
