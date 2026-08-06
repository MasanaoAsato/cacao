package getjourney

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

type mockJourneyRepo struct {
	journey entity.Journey
	err     error
}

func (m *mockJourneyRepo) Save(_ context.Context, _ entity.Journey) error {
	return nil
}

func (m *mockJourneyRepo) FindByID(_ context.Context, _ value_object.ID) (entity.Journey, error) {
	if m.err != nil {
		return entity.Journey{}, m.err
	}
	return m.journey, nil
}

func (m *mockJourneyRepo) FindByRequestID(_ context.Context, _ value_object.ID) (entity.Journey, error) {
	return entity.Journey{}, repository.ErrJourneyNotFound
}

func (m *mockJourneyRepo) FindAll(_ context.Context) ([]entity.Journey, error) {
	return nil, nil
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

// mustNewLegsForSpots は spots に対応する Leg スライスを生成するテストヘルパー。
func mustNewLegsForSpots(t *testing.T, spots []entity.Spot) []entity.Leg {
	t.Helper()
	if len(spots) == 0 {
		return nil
	}
	mode, err := value_object.NewTransportMode("walk")
	if err != nil {
		t.Fatalf("failed to create transport mode: %v", err)
	}
	zeroCost := mustNewMoney(t, 0, "JPY")
	legs := make([]entity.Leg, len(spots))
	for i, spot := range spots {
		var from value_object.Endpoint
		if i == 0 {
			from, err = value_object.NewNamedEndpoint("出発地")
			if err != nil {
				t.Fatalf("failed to create named endpoint: %v", err)
			}
		} else {
			from, err = value_object.NewSpotEndpoint(spots[i-1].ID())
			if err != nil {
				t.Fatalf("failed to create spot endpoint: %v", err)
			}
		}
		to, err := value_object.NewSpotEndpoint(spot.ID())
		if err != nil {
			t.Fatalf("failed to create spot endpoint: %v", err)
		}
		leg, err := entity.NewLeg(value_object.NewID(), from, to, mode, time.Minute, zeroCost)
		if err != nil {
			t.Fatalf("failed to create leg %d: %v", i+1, err)
		}
		legs[i] = leg
	}
	return legs
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
	legs := mustNewLegsForSpots(t, []entity.Spot{spot})
	day, _ := entity.NewItineraryDay(
		value_object.NewID(),
		time.Date(2026, 7, 7, 0, 0, 0, 0, time.UTC),
		[]entity.Spot{spot},
		legs,
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
	t.Run("正常系: ID で Journey を取得できる", func(t *testing.T) {
		journey := mustNewJourney(t)
		uc := NewUseCase(&mockJourneyRepo{journey: journey})

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
		journey := mustNewJourney(t)
		uc := NewUseCase(&mockJourneyRepo{journey: journey})

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
		uc := NewUseCase(&mockJourneyRepo{})
		_, err := uc.Execute(context.Background(), Input{JourneyID: "not-a-uuid"})
		if err == nil {
			t.Fatal("expected error, got nil")
		}
		if !errors.Is(err, application.ErrInvalidInput) {
			t.Fatalf("expected ErrInvalidInput, got %v", err)
		}
	})

	t.Run("異常系: Journey が存在しない", func(t *testing.T) {
		uc := NewUseCase(&mockJourneyRepo{err: repository.ErrJourneyNotFound})
		_, err := uc.Execute(context.Background(), Input{JourneyID: value_object.NewID().String()})
		if err == nil {
			t.Fatal("expected error, got nil")
		}
		if !errors.Is(err, application.ErrJourneyNotFound) {
			t.Fatalf("expected ErrJourneyNotFound, got %v", err)
		}
	})
}
