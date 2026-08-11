package service

import (
	"context"
	"fmt"
	"time"

	"cacao/src/domain/entity"
	"cacao/src/domain/service"
	"cacao/src/domain/value_object"
)

// JourneyGeneratorStub は JourneyGenerator ドメインサービスのスタブ実装。
// LLMを呼ばず、リクエスト条件から機械的にダミー旅程を生成する。
// 予算を日数×スポット数で割り、不変条件（予算超過）を回避する。
type JourneyGeneratorStub struct {
	// ErrOn は非 nil のとき Generate はこのエラーを返す（エラー注入用）。
	ErrOn error
}

// NewJourneyGeneratorStub は JourneyGeneratorStub を生成する。
func NewJourneyGeneratorStub() *JourneyGeneratorStub {
	return &JourneyGeneratorStub{}
}

// Generate は JourneyRequest の条件から固定のダミー旅程を生成する。
func (g *JourneyGeneratorStub) Generate(_ context.Context, request entity.JourneyRequest) (service.GeneratedRoute, error) {
	if g.ErrOn != nil {
		return service.GeneratedRoute{}, g.ErrOn
	}

	period := request.Period()
	days := periodDays(period.StartDate(), period.EndDate())

	budget := request.Budget()
	const spotsPerDay = 2
	perSpot := budget.Amount() / (len(days) * spotsPerDay)
	if perSpot <= 0 {
		perSpot = 1
	}

	currency, err := value_object.NewCurrency(budget.Currency().Code())
	if err != nil {
		return service.GeneratedRoute{}, fmt.Errorf("failed to recreate currency: %w", err)
	}

	generatedDays := make([]service.GeneratedDay, 0, len(days))
	for i, d := range days {
		spots := make([]service.GeneratedSpot, 0, spotsPerDay)
		for s := 0; s < spotsPerDay; s++ {
			cost, err := value_object.NewMoney(perSpot, currency)
			if err != nil {
				return service.GeneratedRoute{}, fmt.Errorf("failed to create money: %w", err)
			}
			spots = append(spots, service.GeneratedSpot{
				Name:          fmt.Sprintf("スタブスポット %d-%d", i+1, s+1),
				Description:   "スタブによる自動生成スポット（地理的位置は未指定）",
				StartAt:       d.Add(time.Hour * time.Duration(9+s*3)),
				EstimatedCost: cost,
			})
		}

		// 各スポットに対応する Leg を機械的に生成。
		// 徒歩・移動費 0 円・固定時間（先頭区間 15 分、以降 10 分）とし、
		// 既存の予算按分ロジック（スポット費用のみ按分）は変えずに済む。
		mode, err := value_object.NewTransportMode("walk")
		if err != nil {
			return service.GeneratedRoute{}, fmt.Errorf("failed to create transport mode: %w", err)
		}
		zeroCost, err := value_object.NewMoney(0, currency)
		if err != nil {
			return service.GeneratedRoute{}, fmt.Errorf("failed to create zero money: %w", err)
		}

		legs := make([]service.GeneratedLeg, 0, spotsPerDay)
		for s := 0; s < spotsPerDay; s++ {
			duration := 10 * time.Minute
			if s == 0 {
				duration = 15 * time.Minute
			}
			leg := service.GeneratedLeg{
				Mode:     mode,
				Duration: duration,
				Cost:     zeroCost,
			}
			if s == 0 {
				leg.FromLabel = request.Departure().String()
			}
			legs = append(legs, leg)
		}

		generatedDays = append(generatedDays, service.GeneratedDay{Date: d, Spots: spots, Legs: legs})
	}

	return service.GeneratedRoute{Days: generatedDays}, nil
}

// periodDays は開始日から終了日まで（両端含む）の日付リストを返す。
func periodDays(start, end time.Time) []time.Time {
	start = value_object.NormalizeDate(start)
	end = value_object.NormalizeDate(end)

	days := make([]time.Time, 0, int(end.Sub(start).Hours()/24)+1)
	for d := start; !d.After(end); d = d.AddDate(0, 0, 1) {
		days = append(days, d)
	}
	return days
}
