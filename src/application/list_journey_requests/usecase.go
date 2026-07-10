package listjourneyrequests

import (
	"context"
	"fmt"

	"cacao/src/domain/entity"
	"cacao/src/domain/repository"
)

// UseCase は ListJourneyRequests ユースケースのインターフェース。
type UseCase interface {
	Execute(ctx context.Context, input Input) (Output, error)
}

// NewUseCase は ListJourneyRequests ユースケースの実装を生成する。
func NewUseCase(repo repository.JourneyRequestRepository) UseCase {
	return &useCase{repo: repo}
}

type useCase struct {
	repo repository.JourneyRequestRepository
}

// Execute は保存されている JourneyRequest の一覧を取得し、DTO に詰め替えて返す。
func (uc *useCase) Execute(ctx context.Context, input Input) (Output, error) {
	requests, err := uc.repo.FindAll(ctx)
	if err != nil {
		return Output{}, fmt.Errorf("failed to list journey requests: %w", err)
	}

	requestDTOs := make([]JourneyRequestDTO, 0, len(requests))
	for _, request := range requests {
		requestDTOs = append(requestDTOs, toJourneyRequestDTO(request))
	}

	return Output{Requests: requestDTOs}, nil
}

func toJourneyRequestDTO(request entity.JourneyRequest) JourneyRequestDTO {
	return JourneyRequestDTO{
		ID:        request.ID().String(),
		Departure: request.Departure().String(),
		Period: PeriodDTO{
			StartDate: request.Period().StartDate(),
			EndDate:   request.Period().EndDate(),
		},
		Budget: MoneyDTO{
			Amount:   request.Budget().Amount(),
			Currency: request.Budget().Currency().Code(),
		},
	}
}
