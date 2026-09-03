package listjourneyrequests

import (
	"context"
	"errors"
	"testing"

	"cacao/src/domain/entity"
	"cacao/src/internal/testkit"
	"cacao/src/internal/testkit/fakes"
)

func TestUseCase_Execute(t *testing.T) {
	t.Run("正常系: JourneyRequest の一覧を取得できる", func(t *testing.T) {
		request := testkit.MustNewJourneyRequest(t)
		uc := NewUseCase(fakes.NewJourneyRequestRepositoryWith(t, request))

		output, err := uc.Execute(context.Background(), Input{})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(output.Requests) != 1 {
			t.Fatalf("requests length = %d, want 1", len(output.Requests))
		}
		if output.Requests[0].ID != request.ID().String() {
			t.Fatalf("id mismatch")
		}
		if output.Requests[0].Departure != "東京, 日本" {
			t.Fatalf("departure = %q, want %q", output.Requests[0].Departure, "東京, 日本")
		}
		if output.Requests[0].Destination != "大阪, 日本" {
			t.Fatalf("destination = %q, want %q", output.Requests[0].Destination, "大阪, 日本")
		}
		if output.Requests[0].Budget.Amount != 50000 {
			t.Fatalf("budget amount = %d, want 50000", output.Requests[0].Budget.Amount)
		}
	})

	t.Run("正常系: 空の一覧", func(t *testing.T) {
		uc := NewUseCase(fakes.NewJourneyRequestRepository())

		output, err := uc.Execute(context.Background(), Input{})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(output.Requests) != 0 {
			t.Fatalf("requests length = %d, want 0", len(output.Requests))
		}
	})

	t.Run("異常系: リポジトリ取得失敗", func(t *testing.T) {
		repo := fakes.NewJourneyRequestRepository()
		repo.FindAllFn = func(context.Context) ([]entity.JourneyRequest, error) {
			return nil, errors.New("find all failed")
		}
		uc := NewUseCase(repo)
		_, err := uc.Execute(context.Background(), Input{})
		if err == nil {
			t.Fatal("expected error, got nil")
		}
	})
}
