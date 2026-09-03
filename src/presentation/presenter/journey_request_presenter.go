package presenter

import (
	"time"

	createjourneyrequest "cacao/src/application/create_journey_request"
	"cacao/src/application/readmodel"
)

// CreateJourneyRequestResponse は JourneyRequest 作成APIのJSONレスポンス。
type CreateJourneyRequestResponse struct {
	RequestID string `json:"request_id"`
}

// JourneyRequestResponse は JourneyRequest 系APIのJSONレスポンス。
type JourneyRequestResponse struct {
	ID          string               `json:"id"`
	Departure   string               `json:"departure"`
	Destination string               `json:"destination"`
	Period      JourneyRequestPeriod `json:"period"`
	Budget      MoneyJSON            `json:"budget"`
}

// JourneyRequestPeriod は JourneyRequest の期間JSON表現。
type JourneyRequestPeriod struct {
	StartDate string `json:"start_date"`
	EndDate   string `json:"end_date"`
}

// ToCreateJourneyRequestResponse は CreateJourneyRequest のOutputをJSONレスポンスに変換する。
func ToCreateJourneyRequestResponse(output createjourneyrequest.Output) CreateJourneyRequestResponse {
	return CreateJourneyRequestResponse{RequestID: output.RequestID}
}

// ToJourneyRequestResponse は JourneyRequestDTO をJSONレスポンスに変換する。
func ToJourneyRequestResponse(dto readmodel.JourneyRequestDTO) JourneyRequestResponse {
	return JourneyRequestResponse{
		ID:          dto.ID,
		Departure:   dto.Departure,
		Destination: dto.Destination,
		Period: JourneyRequestPeriod{
			StartDate: dto.Period.StartDate.Format(time.RFC3339),
			EndDate:   dto.Period.EndDate.Format(time.RFC3339),
		},
		Budget: toMoneyJSON(dto.Budget),
	}
}

// ToJourneyRequestListResponse は JourneyRequestDTO のスライスをJSONレスポンスのスライスに変換する。
func ToJourneyRequestListResponse(dtos []readmodel.JourneyRequestDTO) []JourneyRequestResponse {
	responses := make([]JourneyRequestResponse, 0, len(dtos))
	for _, dto := range dtos {
		responses = append(responses, ToJourneyRequestResponse(dto))
	}
	return responses
}
