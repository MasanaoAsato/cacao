package presenter

import (
	"time"

	generatejourney "cacao/src/application/generate_journey"
	"cacao/src/application/readmodel"
)

// GenerateJourneyResponse は旅程生成APIのJSONレスポンス。
type GenerateJourneyResponse struct {
	JourneyID string `json:"journey_id"`
}

// ToGenerateJourneyResponse は GenerateJourney のOutputをJSONレスポンスに変換する。
func ToGenerateJourneyResponse(output generatejourney.Output) GenerateJourneyResponse {
	return GenerateJourneyResponse{
		JourneyID: output.JourneyID,
	}
}

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
	Legs  []LegJSON  `json:"legs"`
}

// SpotJSON は訪問先のJSON表現。
type SpotJSON struct {
	ID            string    `json:"id"`
	Name          string    `json:"name"`
	Description   string    `json:"description"`
	StartAt       string    `json:"start_at"`
	EstimatedCost MoneyJSON `json:"estimated_cost"`
}

// LegJSON は移動区間のJSON表現。
type LegJSON struct {
	ID              string       `json:"id"`
	From            EndpointJSON `json:"from"`
	To              EndpointJSON `json:"to"`
	Mode            string       `json:"mode"`
	DurationMinutes int          `json:"duration_minutes"`
	EstimatedCost   MoneyJSON    `json:"estimated_cost"`
}

// MoneyJSON は金額のJSON表現。
type MoneyJSON struct {
	Amount   int    `json:"amount"`
	Currency string `json:"currency"`
}

// EndpointJSON は区間端点のJSON表現。
type EndpointJSON struct {
	SpotID string `json:"spot_id,omitempty"`
	Label  string `json:"label"`
}

// ToJourneyResponse は JourneyDTO から JourneyResponse を組み立てる。
func ToJourneyResponse(dto readmodel.JourneyDTO) JourneyResponse {
	return JourneyResponse{
		ID:        dto.ID,
		RequestID: dto.RequestID,
		DayCount:  dto.DayCount,
		Days:      toItineraryDayJSONs(dto.Days),
	}
}

// ToJourneyListResponse は JourneyDTO のスライスから JourneyResponse のスライスを組み立てる。
func ToJourneyListResponse(dtos []readmodel.JourneyDTO) []JourneyResponse {
	responses := make([]JourneyResponse, 0, len(dtos))
	for _, dto := range dtos {
		responses = append(responses, ToJourneyResponse(dto))
	}
	return responses
}

func toItineraryDayJSONs(dtos []readmodel.ItineraryDayDTO) []ItineraryDayJSON {
	result := make([]ItineraryDayJSON, 0, len(dtos))
	for _, dto := range dtos {
		result = append(result, ItineraryDayJSON{
			ID:    dto.ID,
			Date:  dto.Date.Format(time.RFC3339),
			Spots: toSpotJSONs(dto.Spots),
			Legs:  toLegJSONs(dto.Legs),
		})
	}
	return result
}

func toSpotJSONs(dtos []readmodel.SpotDTO) []SpotJSON {
	result := make([]SpotJSON, 0, len(dtos))
	for _, dto := range dtos {
		result = append(result, SpotJSON{
			ID:            dto.ID,
			Name:          dto.Name,
			Description:   dto.Description,
			StartAt:       dto.StartAt.Format(time.RFC3339),
			EstimatedCost: toMoneyJSON(dto.EstimatedCost),
		})
	}
	return result
}

func toLegJSONs(dtos []readmodel.LegDTO) []LegJSON {
	result := make([]LegJSON, 0, len(dtos))
	for _, dto := range dtos {
		result = append(result, LegJSON{
			ID:              dto.ID,
			From:            EndpointJSON{SpotID: dto.From.SpotID, Label: dto.From.Label},
			To:              EndpointJSON{SpotID: dto.To.SpotID, Label: dto.To.Label},
			Mode:            dto.Mode,
			DurationMinutes: dto.DurationMinutes,
			EstimatedCost:   toMoneyJSON(dto.EstimatedCost),
		})
	}
	return result
}

func toMoneyJSON(dto readmodel.MoneyDTO) MoneyJSON {
	return MoneyJSON{Amount: dto.Amount, Currency: dto.Currency}
}
