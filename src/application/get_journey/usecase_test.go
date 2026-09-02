package getjourney

import (
	"context"
	"errors"
	"testing"

	"cacao/src/application"
	"cacao/src/domain/value_object"
	"cacao/src/internal/testkit"
	"cacao/src/internal/testkit/fakes"
)

func TestUseCase_Execute(t *testing.T) {
	t.Run("正常系: ID で Journey を取得できる", func(t *testing.T) {
		journey := testkit.MustNewJourney(t)
		uc := NewUseCase(fakes.NewJourneyRepositoryWith(t, journey))

		output, err := uc.Execute(context.Background(), Input{JourneyID: journey.ID().String()})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if output.Journey.ID != journey.ID().String() {
			t.Fatalf("id mismatch")
		}
		if output.Journey.DayCount != 1 {
			t.Fatalf("day count = %d, want 1", output.Journey.DayCount)
		}
		if len(output.Journey.Days) != 1 {
			t.Fatalf("days length = %d, want 1", len(output.Journey.Days))
		}
		if len(output.Journey.Days[0].Spots) != 1 {
			t.Fatalf("spots length = %d, want 1", len(output.Journey.Days[0].Spots))
		}
	})

	t.Run("正常系: DTO に legs と解決済み Label が含まれる", func(t *testing.T) {
		journey := testkit.MustNewJourney(t)
		uc := NewUseCase(fakes.NewJourneyRepositoryWith(t, journey))

		output, err := uc.Execute(context.Background(), Input{JourneyID: journey.ID().String()})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		day := output.Journey.Days[0]
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
		if leg.DurationMinutes != 1 {
			t.Errorf("duration minutes = %d, want 1", leg.DurationMinutes)
		}
		if leg.Mode != "walk" {
			t.Errorf("mode = %q, want %q", leg.Mode, "walk")
		}
	})

	t.Run("異常系: 不正な JourneyID", func(t *testing.T) {
		uc := NewUseCase(fakes.NewJourneyRepository())
		_, err := uc.Execute(context.Background(), Input{JourneyID: "not-a-uuid"})
		if err == nil {
			t.Fatal("expected error, got nil")
		}
		if !errors.Is(err, application.ErrInvalidInput) {
			t.Fatalf("expected ErrInvalidInput, got %v", err)
		}
	})

	t.Run("異常系: Journey が存在しない", func(t *testing.T) {
		// 空のインメモリリポジトリは repository.ErrJourneyNotFound を返す
		uc := NewUseCase(fakes.NewJourneyRepository())
		_, err := uc.Execute(context.Background(), Input{JourneyID: value_object.NewID().String()})
		if err == nil {
			t.Fatal("expected error, got nil")
		}
		if !errors.Is(err, application.ErrJourneyNotFound) {
			t.Fatalf("expected ErrJourneyNotFound, got %v", err)
		}
	})
}
