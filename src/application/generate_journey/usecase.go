package generatejourney

import (
	"context"
	"errors"
	"fmt"

	"cacao/src/application"
	"cacao/src/domain/event"
	"cacao/src/domain/repository"
	"cacao/src/domain/service"
	"cacao/src/domain/value_object"
)

// UseCase は GenerateJourney ユースケースのインターフェース。
type UseCase interface {
	Execute(ctx context.Context, input Input) (Output, error)
}

// NewUseCase は GenerateJourney ユースケースの実装を生成する。
func NewUseCase(
	requestRepo repository.JourneyRequestRepository,
	journeyRepo repository.JourneyRepository,
	generator service.JourneyGenerator,
	publisher event.Publisher,
) UseCase {
	return &useCase{
		requestRepo: requestRepo,
		journeyRepo: journeyRepo,
		generator:   generator,
		publisher:   publisher,
	}
}

type useCase struct {
	requestRepo repository.JourneyRequestRepository
	journeyRepo repository.JourneyRepository
	generator   service.JourneyGenerator
	publisher   event.Publisher
}

// Execute は JourneyRequest ID から LLM で旅程を生成し、Journey を保存する。
func (uc *useCase) Execute(ctx context.Context, input Input) (Output, error) {
	requestID, err := value_object.NewIDFromString(input.RequestID)
	if err != nil {
		return Output{}, fmt.Errorf("%w: invalid request id: %w", application.ErrInvalidInput, err)
	}

	request, err := uc.requestRepo.FindByID(ctx, requestID)
	if err != nil {
		if errors.Is(err, repository.ErrJourneyRequestNotFound) {
			return Output{}, fmt.Errorf("%w: %w", application.ErrRequestNotFound, err)
		}
		return Output{}, fmt.Errorf("failed to find journey request: %w", err)
	}

	route, err := uc.generator.Generate(ctx, request)
	if err != nil {
		return Output{}, fmt.Errorf("%w: %w", application.ErrGenerationFailed, err)
	}

	journeyID := value_object.NewID()
	journey, err := service.NewJourneyFromGenerated(journeyID, requestID, request.Period(), route)
	if err != nil {
		return Output{}, fmt.Errorf("%w: %w", application.ErrInvalidInput, err)
	}

	if err := uc.journeyRepo.Save(ctx, journey); err != nil {
		return Output{}, fmt.Errorf("%w: failed to save journey: %w", application.ErrGenerationFailed, err)
	}

	if err := uc.publisher.Publish(ctx, event.NewJourneyGenerated(journey.ID(), requestID)); err != nil {
		return Output{}, fmt.Errorf("failed to publish journey generated event: %w", err)
	}

	return Output{JourneyID: journey.ID().String()}, nil
}
