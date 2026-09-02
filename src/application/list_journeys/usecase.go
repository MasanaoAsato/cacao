package listjourneys

import (
	"cacao/src/application/readmodel"
	"context"
	"fmt"

	"cacao/src/domain/repository"
)

// UseCase は ListJourneys ユースケースのインターフェース。
type UseCase interface {
	Execute(ctx context.Context, input Input) (Output, error)
}

// NewUseCase は ListJourneys ユースケースの実装を生成する。
func NewUseCase(repo repository.JourneyRepository) UseCase {
	return &useCase{repo: repo}
}

type useCase struct {
	repo repository.JourneyRepository
}

// Execute は保存されている Journey の一覧を取得し、DTO に詰め替えて返す。
func (uc *useCase) Execute(ctx context.Context, input Input) (Output, error) {
	journeys, err := uc.repo.FindAll(ctx)
	if err != nil {
		return Output{}, fmt.Errorf("failed to list journeys: %w", err)
	}

	return Output{Journeys: readmodel.NewJourneyDTOs(journeys)}, nil
}
