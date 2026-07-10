package service

import (
	"fmt"

	"cacao/src/domain/entity"
	"cacao/src/domain/value_object"
)

// NewJourneyFromGenerated は LLM 生成結果の中間表現から Journey 集約を組み立てるファクトリ。
// GeneratedRoute から ItineraryDay / Spot の生成、ID 発行、不変条件の検証を一括して行う。
// これにより、アプリケーション層は生成ロジックの詳細を知らなくてもよい。
func NewJourneyFromGenerated(
	id, requestID value_object.ID,
	period value_object.Period,
	route GeneratedRoute,
) (entity.Journey, error) {
	days, err := buildItineraryDays(route)
	if err != nil {
		return entity.Journey{}, fmt.Errorf("failed to build itinerary days: %w", err)
	}

	return entity.NewJourney(id, requestID, period, days)
}

func buildItineraryDays(route GeneratedRoute) ([]entity.ItineraryDay, error) {
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
