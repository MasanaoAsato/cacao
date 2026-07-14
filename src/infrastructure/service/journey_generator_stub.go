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
				Name:          fmt.Sprintf("サンプル観光地 %d-%d", i+1, s+1),
				Description:   "スタブによる自動生成スポット",
				StartAt:       d.Add(time.Hour * time.Duration(9+s*3)),
				EstimatedCost: cost,
			})
		}
		generatedDays = append(generatedDays, service.GeneratedDay{Date: d, Spots: spots})
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
