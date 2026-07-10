package getjourneyrequest

import (
	"context"
	"errors"
	"testing"
	"time"

	"cacao/src/application"
	"cacao/src/domain/entity"
	"cacao/src/domain/repository"
	"cacao/src/domain/value_object"
)

type mockRequestRepo struct {
	request entity.JourneyRequest
	err     error
}

func (m *mockRequestRepo) Save(_ context.Context, _ entity.JourneyRequest) error {
	return nil
}

func (m *mockRequestRepo) FindByID(_ context.Context, _ value_object.ID) (entity.JourneyRequest, error) {
	if m.err != nil {
		return entity.JourneyRequest{}, m.err
	}
	return m.request, nil
}

func (m *mockRequestRepo) FindAll(_ context.Context) ([]entity.JourneyRequest, error) {
	return nil, nil
}

func (m *mockRequestRepo) Delete(_ context.Context, _ value_object.ID) error {
	return nil
}

func mustNewJourneyRequest(t *testing.T) entity.JourneyRequest {
	t.Helper()
	departure, _ := value_object.NewDeparture("東京", "日本")
	period, _ := value_object.NewPeriod(
		time.Date(2026, 7, 7, 0, 0, 0, 0, time.UTC),
		time.Date(2026, 7, 9, 0, 0, 0, 0, time.UTC),
	)
	currency, _ := value_object.NewCurrency("JPY")
	budget, _ := value_object.NewMoney(50000, currency)
	request, err := entity.NewJourneyRequest(value_object.NewID(), departure, period, budget)
	if err != nil {
		t.Fatalf("failed to create journey request: %v", err)
	}
	return request
}

func TestUseCase_Execute(t *testing.T) {
	t.Run("正常系: ID で JourneyRequest を取得できる", func(t *testing.T) {
		request := mustNewJourneyRequest(t)
		uc := NewUseCase(&mockRequestRepo{request: request})

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
		if output.Request.Budget.Amount != 50000 {
			t.Fatalf("budget amount = %d, want 50000", output.Request.Budget.Amount)
		}
	})

	t.Run("異常系: 不正な RequestID", func(t *testing.T) {
		uc := NewUseCase(&mockRequestRepo{})
		_, err := uc.Execute(context.Background(), Input{RequestID: "not-a-uuid"})
		if err == nil {
			t.Fatal("expected error, got nil")
		}
		if !errors.Is(err, application.ErrInvalidInput) {
			t.Fatalf("expected ErrInvalidInput, got %v", err)
		}
	})

	t.Run("異常系: JourneyRequest が存在しない", func(t *testing.T) {
		uc := NewUseCase(&mockRequestRepo{err: repository.ErrJourneyRequestNotFound})
		_, err := uc.Execute(context.Background(), Input{RequestID: value_object.NewID().String()})
		if err == nil {
			t.Fatal("expected error, got nil")
		}
		if !errors.Is(err, application.ErrRequestNotFound) {
			t.Fatalf("expected ErrRequestNotFound, got %v", err)
		}
	})
}
