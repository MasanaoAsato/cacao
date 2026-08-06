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
		dayDTOs = append(dayDTOs, toItineraryDayDTO(day))
	}

	return JourneyDTO{
		ID:        journey.ID().String(),
		RequestID: journey.RequestID().String(),
		DayCount:  journey.DayCount(),
		Days:      dayDTOs,
	}
}

// toItineraryDayDTO は ItineraryDay を DTO に変換する。
// Endpoint の Label は日内のスポット名から解決する（プレゼンターは「ただ写すだけ」に保つ）。
func toItineraryDayDTO(day entity.ItineraryDay) ItineraryDayDTO {
	spots := day.Spots()
	spotDTOs := make([]SpotDTO, 0, len(spots))
	spotNames := make(map[string]string, len(spots))
	for _, spot := range spots {
		spotDTOs = append(spotDTOs, toSpotDTO(spot))
		spotNames[spot.ID().String()] = spot.Name()
	}

	legs := day.Legs()
	legDTOs := make([]LegDTO, 0, len(legs))
	for _, leg := range legs {
		legDTOs = append(legDTOs, toLegDTO(leg, spotNames))
	}

	return ItineraryDayDTO{
		ID:    day.ID().String(),
		Date:  day.Date(),
		Spots: spotDTOs,
		Legs:  legDTOs,
	}
}

func toSpotDTO(spot entity.Spot) SpotDTO {
	return SpotDTO{
		ID:            spot.ID().String(),
		Name:          spot.Name(),
		Description:   spot.Description(),
		StartAt:       spot.StartAt(),
		EstimatedCost: toMoneyDTO(spot.EstimatedCost()),
	}
}

func toLegDTO(leg entity.Leg, spotNames map[string]string) LegDTO {
	return LegDTO{
		ID:   leg.ID().String(),
		From: toEndpointDTO(leg.From(), spotNames),
		To:   toEndpointDTO(leg.To(), spotNames),
		Mode: leg.Mode().String(),
		// Duration() はナノ秒精度だが、ドメイン層で「分」単位で生成・保持されるため分に変換する。
		DurationMinutes: int(leg.Duration().Minutes()),
		EstimatedCost:   toMoneyDTO(leg.Cost()),
	}
}

// toEndpointDTO は Endpoint を DTO に変換する。
// スポット参照時は SpotID を設定し、Label をスポット名から解決する。
// 旅程外地点（名前付き）は SpotID を空にし、Label に元の地点名を設定する。
func toEndpointDTO(endpoint value_object.Endpoint, spotNames map[string]string) EndpointDTO {
	if endpoint.IsSpot() {
		id := endpoint.SpotID()
		return EndpointDTO{
			SpotID: id.String(),
			Label:  spotNames[id.String()],
		}
	}
	return EndpointDTO{
		SpotID: "",
		Label:  endpoint.Label(),
	}
}

func toMoneyDTO(money value_object.Money) MoneyDTO {
	return MoneyDTO{
		Amount:   money.Amount(),
		Currency: money.Currency().Code(),
	}
}
