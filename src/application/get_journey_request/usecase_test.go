package getjourneyrequest

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
	t.Run("正常系: ID で JourneyRequest を取得できる", func(t *testing.T) {
		request := testkit.MustNewJourneyRequest(t)
		uc := NewUseCase(fakes.NewJourneyRequestRepositoryWith(t, request))

		output, err := uc.Execute(context.Background(), Input{RequestID: request.ID().String()})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if output.Request.ID != request.ID().String() {
			t.Fatalf("id mismatch")
		}
		if output.Request.Departure != "東京, 日本" {
			t.Fatalf("departure = %q, want %q", output.Request.Departure, "東京, 日本")
		}
		if output.Request.Destination != "大阪, 日本" {
			t.Fatalf("destination = %q, want %q", output.Request.Destination, "大阪, 日本")
		}
		if output.Request.Budget.Amount != 50000 {
			t.Fatalf("budget amount = %d, want 50000", output.Request.Budget.Amount)
		}
	})

	t.Run("異常系: 不正な RequestID", func(t *testing.T) {
		uc := NewUseCase(fakes.NewJourneyRequestRepository())
		_, err := uc.Execute(context.Background(), Input{RequestID: "not-a-uuid"})
		if err == nil {
			t.Fatal("expected error, got nil")
		}
		if !errors.Is(err, application.ErrInvalidInput) {
			t.Fatalf("expected ErrInvalidInput, got %v", err)
		}
	})

	t.Run("異常系: JourneyRequest が存在しない", func(t *testing.T) {
		// 空のインメモリリポジトリは repository.ErrJourneyRequestNotFound を返す
		uc := NewUseCase(fakes.NewJourneyRequestRepository())
		_, err := uc.Execute(context.Background(), Input{RequestID: value_object.NewID().String()})
		if err == nil {
			t.Fatal("expected error, got nil")
		}
		if !errors.Is(err, application.ErrRequestNotFound) {
			t.Fatalf("expected ErrRequestNotFound, got %v", err)
		}
	})
}
