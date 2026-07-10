package getjourney

import (
	"context"
	"errors"
	"fmt"

	"cacao/src/application"
	"cacao/src/domain/entity"
	"cacao/src/domain/repository"
	"cacao/src/domain/value_object"
)

// UseCase は GetJourney ユースケースのインターフェース。
type UseCase interface {
	Execute(ctx context.Context, input Input) (Output, error)
}

// NewUseCase は GetJourney ユースケースの実装を生成する。
func NewUseCase(repo repository.JourneyRepository) UseCase {
	return &useCase{repo: repo}
}

type useCase struct {
	repo repository.JourneyRepository
}

// Execute は ID 指定で Journey を取得し、DTO に詰め替えて返す。
func (uc *useCase) Execute(ctx context.Context, input Input) (Output, error) {
	id, err := value_object.NewIDFromString(input.JourneyID)
	if err != nil {
		return Output{}, fmt.Errorf("%w: invalid journey id: %w", application.ErrInvalidInput, err)
	}

	journey, err := uc.repo.FindByID(ctx, id)
	if err != nil {
		if errors.Is(err, repository.ErrJourneyNotFound) {
			return Output{}, fmt.Errorf("%w: %w", application.ErrJourneyNotFound, err)
		}
		return Output{}, fmt.Errorf("failed to find journey: %w", err)
	}

	return Output{Journey: toJourneyDTO(journey)}, nil
}

func toJourneyDTO(journey entity.Journey) JourneyDTO {
	days := journey.Days()
	dayDTOs := make([]ItineraryDayDTO, 0, len(days))
	for _, day := range days {
		spotDTOs := make([]SpotDTO, 0, len(day.Spots()))
		for _, spot := range day.Spots() {
			spotDTOs = append(spotDTOs, SpotDTO{
				ID:            spot.ID().String(),
				Name:          spot.Name(),
				Description:   spot.Description(),
				StartAt:       spot.StartAt(),
				EstimatedCost: toMoneyDTO(spot.EstimatedCost()),
			})
		}
		dayDTOs = append(dayDTOs, ItineraryDayDTO{
			ID:    day.ID().String(),
			Date:  day.Date(),
			Spots: spotDTOs,
		})
	}

	return JourneyDTO{
		ID:        journey.ID().String(),
		RequestID: journey.RequestID().String(),
		DayCount:  journey.DayCount(),
		Days:      dayDTOs,
	}
}

func toMoneyDTO(money value_object.Money) MoneyDTO {
	return MoneyDTO{
		Amount:   money.Amount(),
		Currency: money.Currency().Code(),
	}
}
