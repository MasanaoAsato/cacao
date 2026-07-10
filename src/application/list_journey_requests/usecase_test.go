package listjourneyrequests

import (
	"context"
	"errors"
	"testing"
	"time"

	"cacao/src/domain/entity"
	"cacao/src/domain/value_object"
)

type mockRequestRepo struct {
	requests []entity.JourneyRequest
	err      error
}

func (m *mockRequestRepo) Save(_ context.Context, _ entity.JourneyRequest) error {
	return nil
}

func (m *mockRequestRepo) FindByID(_ context.Context, _ value_object.ID) (entity.JourneyRequest, error) {
	return entity.JourneyRequest{}, nil
}

func (m *mockRequestRepo) FindAll(_ context.Context) ([]entity.JourneyRequest, error) {
	if m.err != nil {
		return nil, m.err
	}
	return m.requests, nil
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
	t.Run("正常系: JourneyRequest の一覧を取得できる", func(t *testing.T) {
		request := mustNewJourneyRequest(t)
		uc := NewUseCase(&mockRequestRepo{requests: []entity.JourneyRequest{request}})

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
	})

	t.Run("正常系: 空の一覧", func(t *testing.T) {
		uc := NewUseCase(&mockRequestRepo{requests: []entity.JourneyRequest{}})

		output, err := uc.Execute(context.Background(), Input{})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(output.Requests) != 0 {
			t.Fatalf("requests length = %d, want 0", len(output.Requests))
		}
	})

	t.Run("異常系: リポジトリ取得失敗", func(t *testing.T) {
		uc := NewUseCase(&mockRequestRepo{err: errors.New("find all failed")})
		_, err := uc.Execute(context.Background(), Input{})
		if err == nil {
			t.Fatal("expected error, got nil")
		}
	})
}
