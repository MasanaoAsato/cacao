package listjourneys

import (
	"context"
	"errors"
	"testing"

	"cacao/src/domain/entity"
	"cacao/src/internal/testkit"
	"cacao/src/internal/testkit/fakes"
)

func TestUseCase_Execute(t *testing.T) {
	t.Run("正常系: Journey の一覧を取得できる", func(t *testing.T) {
		journey := testkit.MustNewJourney(t)
		uc := NewUseCase(fakes.NewJourneyRepositoryWith(t, journey))

		output, err := uc.Execute(context.Background(), Input{})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(output.Journeys) != 1 {
			t.Fatalf("journeys length = %d, want 1", len(output.Journeys))
		}
		if output.Journeys[0].ID != journey.ID().String() {
			t.Fatalf("id mismatch")
		}
	})

	t.Run("正常系: 空の一覧", func(t *testing.T) {
		uc := NewUseCase(fakes.NewJourneyRepository())

		output, err := uc.Execute(context.Background(), Input{})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(output.Journeys) != 0 {
			t.Fatalf("journeys length = %d, want 0", len(output.Journeys))
		}
	})

	t.Run("正常系: DTO に legs と解決済み Label が含まれる", func(t *testing.T) {
		journey := testkit.MustNewJourney(t)
		uc := NewUseCase(fakes.NewJourneyRepositoryWith(t, journey))

		output, err := uc.Execute(context.Background(), Input{})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		day := output.Journeys[0].Days[0]
		spot := day.Spots[0]
		if len(day.Legs) != 1 {
			t.Fatalf("legs length = %d, want 1", len(day.Legs))
		}

		leg := day.Legs[0]
		// 先頭区間の from は名前付き Endpoint（出発地）
		if leg.From.SpotID != "" {
			t.Errorf("from spot_id = %q, want empty for named endpoint", leg.From.SpotID)
		}
		if leg.From.Label != "出発地" {
			t.Errorf("from label = %q, want %q", leg.From.Label, "出発地")
		}
		// to はスポット参照。Label は日内のスポット名から解決される
		if leg.To.SpotID != spot.ID {
			t.Errorf("to spot_id = %q, want %q", leg.To.SpotID, spot.ID)
		}
		if leg.To.Label != spot.Name {
			t.Errorf("to label = %q, want %q", leg.To.Label, spot.Name)
		}
	})

	t.Run("異常系: リポジトリ取得失敗", func(t *testing.T) {
		repo := fakes.NewJourneyRepository()
		repo.FindAllFn = func(context.Context) ([]entity.Journey, error) {
			return nil, errors.New("find all failed")
		}
		uc := NewUseCase(repo)
		_, err := uc.Execute(context.Background(), Input{})
		if err == nil {
			t.Fatal("expected error, got nil")
		}
	})
}
