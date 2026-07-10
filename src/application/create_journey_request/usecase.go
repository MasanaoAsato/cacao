package createjourneyrequest

import (
	"context"
	"fmt"

	"cacao/src/application"
	"cacao/src/domain/entity"
	"cacao/src/domain/event"
	"cacao/src/domain/repository"
	"cacao/src/domain/value_object"
)

// UseCase は CreateJourneyRequest ユースケースのインターフェース。
type UseCase interface {
	Execute(ctx context.Context, input Input) (Output, error)
}

// NewUseCase は CreateJourneyRequest ユースケースの実装を生成する。
func NewUseCase(repo repository.JourneyRequestRepository, publisher event.Publisher) UseCase {
	return &useCase{repo: repo, publisher: publisher}
}

type useCase struct {
	repo      repository.JourneyRequestRepository
	publisher event.Publisher
}

// Execute はユーザー入力から JourneyRequest を生成・保存し、生成したIDを返す。
func (uc *useCase) Execute(ctx context.Context, input Input) (Output, error) {
	departure, err := value_object.NewDeparture(input.DepartureCity, input.DepartureCountry)
	if err != nil {
		return Output{}, fmt.Errorf("%w: invalid departure: %w", application.ErrInvalidInput, err)
	}

	period, err := value_object.NewPeriod(input.StartDate, input.EndDate)
	if err != nil {
		return Output{}, fmt.Errorf("%w: invalid period: %w", application.ErrInvalidInput, err)
	}

	currency, err := value_object.NewCurrency(input.Currency)
	if err != nil {
		return Output{}, fmt.Errorf("%w: invalid currency: %w", application.ErrInvalidInput, err)
	}

	budget, err := value_object.NewMoney(input.Amount, currency)
	if err != nil {
		return Output{}, fmt.Errorf("%w: invalid budget: %w", application.ErrInvalidInput, err)
	}

	id := value_object.NewID()
	request, err := entity.NewJourneyRequest(id, departure, period, budget)
	if err != nil {
		return Output{}, fmt.Errorf("%w: %w", application.ErrInvalidInput, err)
	}

	if err := uc.repo.Save(ctx, request); err != nil {
		return Output{}, fmt.Errorf("failed to save journey request: %w", err)
	}

	if err := uc.publisher.Publish(ctx, event.NewJourneyRequested(request.ID())); err != nil {
		return Output{}, fmt.Errorf("failed to publish journey requested event: %w", err)
	}

	return Output{RequestID: request.ID().String()}, nil
}
