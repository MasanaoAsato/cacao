package readmodel

import (
	"time"

	"cacao/src/domain/entity"
)

// JourneyRequestDTO は JourneyRequest エンティティの読み取り専用表現。
type JourneyRequestDTO struct {
	ID          string
	Departure   string
	Destination string
	Period      PeriodDTO
	Budget      MoneyDTO
}

// PeriodDTO は Period 値オブジェクトの読み取り専用表現。
type PeriodDTO struct {
	StartDate time.Time
	EndDate   time.Time
}

// NewJourneyRequestDTO は JourneyRequest を DTO に変換する。
func NewJourneyRequestDTO(request entity.JourneyRequest) JourneyRequestDTO {
	return JourneyRequestDTO{
		ID:          request.ID().String(),
		Departure:   request.Departure().String(),
		Destination: request.Destination().String(),
		Period: PeriodDTO{
			StartDate: request.Period().StartDate(),
			EndDate:   request.Period().EndDate(),
		},
		Budget: NewMoneyDTO(request.Budget()),
	}
}

// NewJourneyRequestDTOs は JourneyRequest のスライスを DTO のスライスに変換する。
func NewJourneyRequestDTOs(requests []entity.JourneyRequest) []JourneyRequestDTO {
	dtos := make([]JourneyRequestDTO, 0, len(requests))
	for _, request := range requests {
		dtos = append(dtos, NewJourneyRequestDTO(request))
	}
	return dtos
}
