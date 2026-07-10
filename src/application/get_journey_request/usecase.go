package getjourneyrequest

import (
	"context"
	"errors"
	"fmt"

	"cacao/src/application"
	"cacao/src/domain/entity"
	"cacao/src/domain/repository"
	"cacao/src/domain/value_object"
)

// UseCase は GetJourneyRequest ユースケースのインターフェース。
type UseCase interface {
	Execute(ctx context.Context, input Input) (Output, error)
}

// NewUseCase は GetJourneyRequest ユースケースの実装を生成する。
func NewUseCase(repo repository.JourneyRequestRepository) UseCase {
	return &useCase{repo: repo}
}

type useCase struct {
	repo repository.JourneyRequestRepository
}

// Execute は ID 指定で JourneyRequest を取得し、DTO に詰め替えて返す。
func (uc *useCase) Execute(ctx context.Context, input Input) (Output, error) {
	id, err := value_object.NewIDFromString(input.RequestID)
	if err != nil {
		return Output{}, fmt.Errorf("%w: invalid request id: %w", application.ErrInvalidInput, err)
	}

	request, err := uc.repo.FindByID(ctx, id)
	if err != nil {
		if errors.Is(err, repository.ErrJourneyRequestNotFound) {
			return Output{}, fmt.Errorf("%w: %w", application.ErrRequestNotFound, err)
		}
		return Output{}, fmt.Errorf("failed to find journey request: %w", err)
	}

	return Output{Request: toJourneyRequestDTO(request)}, nil
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
