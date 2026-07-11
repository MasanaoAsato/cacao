package memory

import (
	"context"
	"errors"
	"testing"
	"time"

	"cacao/src/domain/entity"
	"cacao/src/domain/repository"
	"cacao/src/domain/service"
	"cacao/src/domain/value_object"

	journeygeneratorservice "cacao/src/infrastructure/service"
)

func newTestJourney(t *testing.T) entity.Journey {
	t.Helper()
	departure, err := value_object.NewDeparture("東京", "日本")
	if err != nil {
		t.Fatalf("failed to create departure: %v", err)
	}
	start := time.Date(2026, 7, 1, 0, 0, 0, 0, time.UTC)
	end := time.Date(2026, 7, 1, 0, 0, 0, 0, time.UTC)
	period, err := value_object.NewPeriod(start, end)
	if err != nil {
		t.Fatalf("failed to create period: %v", err)
	}
	currency, err := value_object.NewCurrency("JPY")
	if err != nil {
		t.Fatalf("failed to create currency: %v", err)
	}
	budget, err := value_object.NewMoney(10000, currency)
	if err != nil {
		t.Fatalf("failed to create budget: %v", err)
	}
	req, err := entity.NewJourneyRequest(value_object.NewID(), departure, period, budget)
	if err != nil {
		t.Fatalf("failed to create journey request: %v", err)
	}

	generator := journeygeneratorservice.NewJourneyGeneratorStub()
	ctx := context.Background()
	route, err := generator.Generate(ctx, req)
	if err != nil {
		t.Fatalf("Generate failed: %v", err)
	}
	journey, err := service.NewJourneyFromGenerated(value_object.NewID(), req.ID(), req.Period(), route)
	if err != nil {
		t.Fatalf("NewJourneyFromGenerated failed: %v", err)
	}
	return journey
}

func TestJourneyRepositoryMemory_SaveAndFindByID(t *testing.T) {
	repo := NewJourneyRepository()
	journey := newTestJourney(t)
	ctx := context.Background()

	if err := repo.Save(ctx, journey); err != nil {
		t.Fatalf("Save failed: %v", err)
	}

	got, err := repo.FindByID(ctx, journey.ID())
	if err != nil {
		t.Fatalf("FindByID failed: %v", err)
	}
	if !got.Equals(journey) {
		t.Errorf("FindByID returned different journey: got %v, want %v", got.ID(), journey.ID())
	}
}

func TestJourneyRepositoryMemory_FindByID_NotFound(t *testing.T) {
	repo := NewJourneyRepository()
	ctx := context.Background()

	_, err := repo.FindByID(ctx, value_object.NewID())
	if !errors.Is(err, repository.ErrJourneyNotFound) {
		t.Errorf("expected ErrJourneyNotFound, got %v", err)
	}
}

func TestJourneyRepositoryMemory_FindByRequestID(t *testing.T) {
	repo := NewJourneyRepository()
	journey := newTestJourney(t)
	ctx := context.Background()

	if err := repo.Save(ctx, journey); err != nil {
		t.Fatalf("Save failed: %v", err)
	}

	got, err := repo.FindByRequestID(ctx, journey.RequestID())
	if err != nil {
		t.Fatalf("FindByRequestID failed: %v", err)
	}
	if !got.Equals(journey) {
		t.Errorf("FindByRequestID returned different journey: got %v, want %v", got.ID(), journey.ID())
	}
}

func TestJourneyRepositoryMemory_FindByRequestID_NotFound(t *testing.T) {
	repo := NewJourneyRepository()
	ctx := context.Background()

	_, err := repo.FindByRequestID(ctx, value_object.NewID())
	if !errors.Is(err, repository.ErrJourneyNotFound) {
		t.Errorf("expected ErrJourneyNotFound, got %v", err)
	}
}

func TestJourneyRepositoryMemory_FindAll(t *testing.T) {
	repo := NewJourneyRepository()
	ctx := context.Background()

	got, err := repo.FindAll(ctx)
	if err != nil {
		t.Fatalf("FindAll failed: %v", err)
	}
	if len(got) != 0 {
		t.Errorf("expected empty list, got %d items", len(got))
	}

	journey := newTestJourney(t)
	if err := repo.Save(ctx, journey); err != nil {
		t.Fatalf("Save failed: %v", err)
	}

	got, err = repo.FindAll(ctx)
	if err != nil {
		t.Fatalf("FindAll failed: %v", err)
	}
	if len(got) != 1 {
		t.Errorf("expected 1 item, got %d", len(got))
	}
}

func TestJourneyRepositoryMemory_Delete(t *testing.T) {
	repo := NewJourneyRepository()
	journey := newTestJourney(t)
	ctx := context.Background()

	if err := repo.Save(ctx, journey); err != nil {
		t.Fatalf("Save failed: %v", err)
	}
	if err := repo.Delete(ctx, journey.ID()); err != nil {
		t.Fatalf("Delete failed: %v", err)
	}
	if _, err := repo.FindByID(ctx, journey.ID()); !errors.Is(err, repository.ErrJourneyNotFound) {
		t.Errorf("expected ErrJourneyNotFound after delete, got %v", err)
	}
}

func TestJourneyRepositoryMemory_Delete_NotFound(t *testing.T) {
	repo := NewJourneyRepository()
	ctx := context.Background()

	err := repo.Delete(ctx, value_object.NewID())
	if !errors.Is(err, repository.ErrJourneyNotFound) {
		t.Errorf("expected ErrJourneyNotFound, got %v", err)
	}
}
