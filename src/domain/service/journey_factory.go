package service

import (
	"fmt"
	"sort"

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
		if len(generatedDay.Spots) == 0 {
			return nil, fmt.Errorf("day %s: no spots", generatedDay.Date.Format("2006-01-02"))
		}
		if len(generatedDay.Legs) != len(generatedDay.Spots) {
			return nil, fmt.Errorf(
				"day %s: the number of legs and spots must match: got %d legs and %d spots",
				generatedDay.Date.Format("2006-01-02"), len(generatedDay.Legs), len(generatedDay.Spots),
			)
		}

		// (generatedSpot, generatedLeg) のペアを作り、spot.StartAt で安定ソートする。
		// LLM が時系列順を守らなかった場合でも、ペアごと並べ替えるので連鎖が壊れない（§7.2）。
		type spotLegPair struct {
			spot GeneratedSpot
			leg  GeneratedLeg
		}
		pairs := make([]spotLegPair, len(generatedDay.Spots))
		for i := range generatedDay.Spots {
			pairs[i] = spotLegPair{spot: generatedDay.Spots[i], leg: generatedDay.Legs[i]}
		}
		sort.SliceStable(pairs, func(i, j int) bool {
			return pairs[i].spot.StartAt.Before(pairs[j].spot.StartAt)
		})

		// ソート済みの順で Spot エンティティを生成（ID 採番）
		spots := make([]entity.Spot, len(pairs))
		for i, p := range pairs {
			spotID := value_object.NewID()
			spot, err := entity.NewSpot(
				spotID,
				p.spot.Name,
				p.spot.Description,
				p.spot.StartAt,
				p.spot.EstimatedCost,
			)
			if err != nil {
				return nil, fmt.Errorf("failed to build spot: %w", err)
			}
			spots[i] = spot
		}

		// ソート済みの順で Leg エンティティを生成:
		//   i=0: from = NewNamedEndpoint(legs[0].FromLabel)（空ならエラー）
		//   i>0: from = NewSpotEndpoint(spots[i-1].ID())
		//   to   = NewSpotEndpoint(spots[i].ID())
		legs := make([]entity.Leg, len(pairs))
		for i, p := range pairs {
			var from value_object.Endpoint
			var err error
			if i == 0 {
				from, err = value_object.NewNamedEndpoint(p.leg.FromLabel)
				if err != nil {
					return nil, fmt.Errorf("day %s leg 1: from label: %w", generatedDay.Date.Format("2006-01-02"), err)
				}
			} else {
				from, err = value_object.NewSpotEndpoint(spots[i-1].ID())
				if err != nil {
					return nil, fmt.Errorf("day %s leg %d: from endpoint: %w", generatedDay.Date.Format("2006-01-02"), i+1, err)
				}
			}
			to, err := value_object.NewSpotEndpoint(spots[i].ID())
			if err != nil {
				return nil, fmt.Errorf("day %s leg %d: to endpoint: %w", generatedDay.Date.Format("2006-01-02"), i+1, err)
			}

			legID := value_object.NewID()
			leg, err := entity.NewLeg(legID, from, to, p.leg.Mode, p.leg.Duration, p.leg.Cost)
			if err != nil {
				return nil, fmt.Errorf("day %s leg %d: %w", generatedDay.Date.Format("2006-01-02"), i+1, err)
			}
			legs[i] = leg
		}

		dayID := value_object.NewID()
		day, err := entity.NewItineraryDay(dayID, generatedDay.Date, spots, legs)
		if err != nil {
			return nil, fmt.Errorf("failed to build day: %w", err)
		}
		days = append(days, day)
	}

	return days, nil
}
