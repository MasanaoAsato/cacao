package generatejourney

import (
	"context"
	"errors"
	"fmt"

	"cacao/src/application"
	"cacao/src/domain/entity"
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
) UseCase {
	return &useCase{
		requestRepo: requestRepo,
		journeyRepo: journeyRepo,
		generator:   generator,
	}
}

type useCase struct {
	requestRepo repository.JourneyRequestRepository
	journeyRepo repository.JourneyRepository
	generator   service.JourneyGenerator
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

	days, err := buildItineraryDays(route)
	if err != nil {
		return Output{}, fmt.Errorf("%w: %w", application.ErrInvalidInput, err)
	}

	journeyID := value_object.NewID()
	journey, err := entity.NewJourney(journeyID, requestID, request.Period(), days)
	if err != nil {
		return Output{}, fmt.Errorf("%w: %w", application.ErrInvalidInput, err)
	}

	if err := uc.journeyRepo.Save(ctx, journey); err != nil {
		return Output{}, fmt.Errorf("%w: failed to save journey: %w", application.ErrGenerationFailed, err)
	}

	return Output{JourneyID: journey.ID().String()}, nil
}

func buildItineraryDays(route service.GeneratedRoute) ([]entity.ItineraryDay, error) {
	days := make([]entity.ItineraryDay, 0, len(route.Days))
	for _, generatedDay := range route.Days {
		spots := make([]entity.Spot, 0, len(generatedDay.Spots))
		for _, generatedSpot := range generatedDay.Spots {
			spotID := value_object.NewID()
			spot, err := entity.NewSpot(
				spotID,
				generatedSpot.Name,
				generatedSpot.Description,
				generatedSpot.StartAt,
				generatedSpot.EstimatedCost,
			)
			if err != nil {
				return nil, fmt.Errorf("failed to build spot: %w", err)
			}
			spots = append(spots, spot)
		}

		dayID := value_object.NewID()
		day, err := entity.NewItineraryDay(dayID, generatedDay.Date, spots)
		if err != nil {
			return nil, fmt.Errorf("failed to build day: %w", err)
		}
		days = append(days, day)
	}

	return days, nil
}
