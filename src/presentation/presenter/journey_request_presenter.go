package presenter

import (
	"time"

	createjourneyrequest "cacao/src/application/create_journey_request"
	getjourneyrequest "cacao/src/application/get_journey_request"
	listjourneyrequests "cacao/src/application/list_journey_requests"
)

// CreateJourneyRequestResponse は JourneyRequest 作成APIのJSONレスポンス。
type CreateJourneyRequestResponse struct {
	RequestID string `json:"request_id"`
}

// JourneyRequestResponse は JourneyRequest 系APIのJSONレスポンス。
type JourneyRequestResponse struct {
	ID        string               `json:"id"`
	Departure string               `json:"departure"`
	Period    JourneyRequestPeriod `json:"period"`
	Budget    MoneyJSON            `json:"budget"`
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

// ToJourneyRequestResponse は GetJourneyRequest のOutputをJSONレスポンスに変換する。
func ToJourneyRequestResponse(dto getjourneyrequest.JourneyRequestDTO) JourneyRequestResponse {
	return JourneyRequestResponse{
		ID:        dto.ID,
		Departure: dto.Departure,
		Period: JourneyRequestPeriod{
			StartDate: dto.Period.StartDate.Format(time.RFC3339),
			EndDate:   dto.Period.EndDate.Format(time.RFC3339),
		},
		Budget: MoneyJSON{
			Amount:   dto.Budget.Amount,
			Currency: dto.Budget.Currency,
		},
	}
}

// ToJourneyRequestListResponse は ListJourneyRequests のOutputをJSONレスポンスのスライスに変換する。
func ToJourneyRequestListResponse(dtos []listjourneyrequests.JourneyRequestDTO) []JourneyRequestResponse {
	responses := make([]JourneyRequestResponse, 0, len(dtos))
	for _, dto := range dtos {
		responses = append(responses, JourneyRequestResponse{
			ID:        dto.ID,
			Departure: dto.Departure,
			Period: JourneyRequestPeriod{
				StartDate: dto.Period.StartDate.Format(time.RFC3339),
				EndDate:   dto.Period.EndDate.Format(time.RFC3339),
			},
			Budget: MoneyJSON{
				Amount:   dto.Budget.Amount,
				Currency: dto.Budget.Currency,
			},
		})
	}
	return responses
}
