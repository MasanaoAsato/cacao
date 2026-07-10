package listjourneys

import (
	"context"
	"errors"
	"testing"
	"time"

	"cacao/src/domain/entity"
	"cacao/src/domain/value_object"
)

type mockJourneyRepo struct {
	journeys []entity.Journey
	err      error
}

func (m *mockJourneyRepo) Save(_ context.Context, _ entity.Journey) error {
	return nil
}

func (m *mockJourneyRepo) FindByID(_ context.Context, _ value_object.ID) (entity.Journey, error) {
	return entity.Journey{}, nil
}

func (m *mockJourneyRepo) FindByRequestID(_ context.Context, _ value_object.ID) (entity.Journey, error) {
	return entity.Journey{}, nil
}

func (m *mockJourneyRepo) FindAll(_ context.Context) ([]entity.Journey, error) {
	if m.err != nil {
		return nil, m.err
	}
	return m.journeys, nil
}

func (m *mockJourneyRepo) Delete(_ context.Context, _ value_object.ID) error {
	return nil
}

func mustNewMoney(t *testing.T, amount int, code string) value_object.Money {
	t.Helper()
	currency, _ := value_object.NewCurrency(code)
	money, _ := value_object.NewMoney(amount, currency)
	return money
}

func mustNewJourney(t *testing.T) entity.Journey {
	t.Helper()
	spot, _ := entity.NewSpot(
		value_object.NewID(),
		"東京タワー",
		"展望台",
		time.Date(2026, 7, 7, 10, 0, 0, 0, time.UTC),
		mustNewMoney(t, 1000, "JPY"),
	)
	day, _ := entity.NewItineraryDay(
		value_object.NewID(),
		time.Date(2026, 7, 7, 0, 0, 0, 0, time.UTC),
		[]entity.Spot{spot},
	)
	period, _ := value_object.NewPeriod(
		time.Date(2026, 7, 7, 0, 0, 0, 0, time.UTC),
		time.Date(2026, 7, 7, 0, 0, 0, 0, time.UTC),
	)
	journey, err := entity.NewJourney(value_object.NewID(), value_object.NewID(), period, []entity.ItineraryDay{day})
	if err != nil {
		t.Fatalf("failed to create journey: %v", err)
	}
	return journey
}

func TestUseCase_Execute(t *testing.T) {
	t.Run("正常系: Journey の一覧を取得できる", func(t *testing.T) {
		journey := mustNewJourney(t)
		uc := NewUseCase(&mockJourneyRepo{journeys: []entity.Journey{journey}})

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
		uc := NewUseCase(&mockJourneyRepo{journeys: []entity.Journey{}})

		output, err := uc.Execute(context.Background(), Input{})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(output.Journeys) != 0 {
			t.Fatalf("journeys length = %d, want 0", len(output.Journeys))
		}
	})

	t.Run("異常系: リポジトリ取得失敗", func(t *testing.T) {
		uc := NewUseCase(&mockJourneyRepo{err: errors.New("find all failed")})
		_, err := uc.Execute(context.Background(), Input{})
		if err == nil {
			t.Fatal("expected error, got nil")
		}
	})
}
