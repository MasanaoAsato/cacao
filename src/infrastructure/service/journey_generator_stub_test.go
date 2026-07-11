package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"cacao/src/domain/entity"
	"cacao/src/domain/value_object"
)

func newStubTestJourneyRequest(t *testing.T, start, end time.Time, amount int) entity.JourneyRequest {
	t.Helper()
	departure, err := value_object.NewDeparture("東京", "日本")
	if err != nil {
		t.Fatalf("failed to create departure: %v", err)
	}
	period, err := value_object.NewPeriod(start, end)
	if err != nil {
		t.Fatalf("failed to create period: %v", err)
	}
	currency, err := value_object.NewCurrency("JPY")
	if err != nil {
		t.Fatalf("failed to create currency: %v", err)
	}
	budget, err := value_object.NewMoney(amount, currency)
	if err != nil {
		t.Fatalf("failed to create budget: %v", err)
	}
	req, err := entity.NewJourneyRequest(value_object.NewID(), departure, period, budget)
	if err != nil {
		t.Fatalf("failed to create journey request: %v", err)
	}
	return req
}

func TestJourneyGeneratorStub_Generate(t *testing.T) {
	generator := NewJourneyGeneratorStub()
	start := time.Date(2026, 7, 1, 0, 0, 0, 0, time.UTC)
	end := time.Date(2026, 7, 3, 0, 0, 0, 0, time.UTC)
	req := newStubTestJourneyRequest(t, start, end, 30000)
	ctx := context.Background()

	route, err := generator.Generate(ctx, req)
	if err != nil {
		t.Fatalf("Generate failed: %v", err)
	}

	expectedDays := 3
	if len(route.Days) != expectedDays {
		t.Errorf("expected %d days, got %d", expectedDays, len(route.Days))
	}

	for _, day := range route.Days {
		if len(day.Spots) != 2 {
			t.Errorf("expected 2 spots per day, got %d", len(day.Spots))
		}
	}
}

func TestJourneyGeneratorStub_Generate_SingleDay(t *testing.T) {
	generator := NewJourneyGeneratorStub()
	start := time.Date(2026, 7, 1, 0, 0, 0, 0, time.UTC)
	end := time.Date(2026, 7, 1, 0, 0, 0, 0, time.UTC)
	req := newStubTestJourneyRequest(t, start, end, 10000)
	ctx := context.Background()

	route, err := generator.Generate(ctx, req)
	if err != nil {
		t.Fatalf("Generate failed: %v", err)
	}
	if len(route.Days) != 1 {
		t.Errorf("expected 1 day, got %d", len(route.Days))
	}
}

func TestJourneyGeneratorStub_Generate_LongPeriod(t *testing.T) {
	generator := NewJourneyGeneratorStub()
	start := time.Date(2026, 7, 1, 0, 0, 0, 0, time.UTC)
	end := time.Date(2026, 7, 31, 0, 0, 0, 0, time.UTC)
	req := newStubTestJourneyRequest(t, start, end, 310000)
	ctx := context.Background()

	route, err := generator.Generate(ctx, req)
	if err != nil {
		t.Fatalf("Generate failed: %v", err)
	}
	if len(route.Days) != 31 {
		t.Errorf("expected 31 days, got %d", len(route.Days))
	}
}

func TestJourneyGeneratorStub_Generate_TinyBudget(t *testing.T) {
	generator := NewJourneyGeneratorStub()
	start := time.Date(2026, 7, 1, 0, 0, 0, 0, time.UTC)
	end := time.Date(2026, 7, 1, 0, 0, 0, 0, time.UTC)
	req := newStubTestJourneyRequest(t, start, end, 1)
	ctx := context.Background()

	route, err := generator.Generate(ctx, req)
	if err != nil {
		t.Fatalf("Generate failed: %v", err)
	}
	for _, day := range route.Days {
		for _, spot := range day.Spots {
			if spot.EstimatedCost.Amount() <= 0 {
				t.Errorf("expected positive cost, got %d", spot.EstimatedCost.Amount())
			}
		}
	}
}

func TestJourneyGeneratorStub_Generate_Error(t *testing.T) {
	generator := NewJourneyGeneratorStub()
	generator.ErrOn = errors.New("injected error")
	start := time.Date(2026, 7, 1, 0, 0, 0, 0, time.UTC)
	end := time.Date(2026, 7, 1, 0, 0, 0, 0, time.UTC)
	req := newStubTestJourneyRequest(t, start, end, 10000)
	ctx := context.Background()

	_, err := generator.Generate(ctx, req)
	if !errors.Is(err, generator.ErrOn) {
		t.Errorf("expected injected error, got %v", err)
	}
}
