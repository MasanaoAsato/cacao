package memory

import (
	"context"
	"errors"
	"testing"
	"time"

	"cacao/src/domain/entity"
	"cacao/src/domain/repository"
	"cacao/src/domain/value_object"
)

func newTestJourneyRequest(t *testing.T) entity.JourneyRequest {
	t.Helper()
	departure, err := value_object.NewDeparture("東京", "日本")
	if err != nil {
		t.Fatalf("failed to create departure: %v", err)
	}
	start := time.Date(2026, 7, 1, 0, 0, 0, 0, time.UTC)
	end := time.Date(2026, 7, 3, 0, 0, 0, 0, time.UTC)
	period, err := value_object.NewPeriod(start, end)
	if err != nil {
		t.Fatalf("failed to create period: %v", err)
	}
	currency, err := value_object.NewCurrency("JPY")
	if err != nil {
		t.Fatalf("failed to create currency: %v", err)
	}
	budget, err := value_object.NewMoney(30000, currency)
	if err != nil {
		t.Fatalf("failed to create budget: %v", err)
	}
	req, err := entity.NewJourneyRequest(value_object.NewID(), departure, period, budget)
	if err != nil {
		t.Fatalf("failed to create journey request: %v", err)
	}
	return req
}

func TestJourneyRequestRepositoryMemory_SaveAndFindByID(t *testing.T) {
	repo := NewJourneyRequestRepository()
	req := newTestJourneyRequest(t)
	ctx := context.Background()

	if err := repo.Save(ctx, req); err != nil {
		t.Fatalf("Save failed: %v", err)
	}

	got, err := repo.FindByID(ctx, req.ID())
	if err != nil {
		t.Fatalf("FindByID failed: %v", err)
	}
	if !got.Equals(req) {
		t.Errorf("FindByID returned different request: got %v, want %v", got.ID(), req.ID())
	}
}

func TestJourneyRequestRepositoryMemory_FindByID_NotFound(t *testing.T) {
	repo := NewJourneyRequestRepository()
	ctx := context.Background()

	_, err := repo.FindByID(ctx, value_object.NewID())
	if !errors.Is(err, repository.ErrJourneyRequestNotFound) {
		t.Errorf("expected ErrJourneyRequestNotFound, got %v", err)
	}
}

func TestJourneyRequestRepositoryMemory_FindAll(t *testing.T) {
	repo := NewJourneyRequestRepository()
	ctx := context.Background()

	got, err := repo.FindAll(ctx)
	if err != nil {
		t.Fatalf("FindAll failed: %v", err)
	}
	if len(got) != 0 {
		t.Errorf("expected empty list, got %d items", len(got))
	}

	req := newTestJourneyRequest(t)
	if err := repo.Save(ctx, req); err != nil {
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

func TestJourneyRequestRepositoryMemory_Delete(t *testing.T) {
	repo := NewJourneyRequestRepository()
	req := newTestJourneyRequest(t)
	ctx := context.Background()

	if err := repo.Save(ctx, req); err != nil {
		t.Fatalf("Save failed: %v", err)
	}
	if err := repo.Delete(ctx, req.ID()); err != nil {
		t.Fatalf("Delete failed: %v", err)
	}
	if _, err := repo.FindByID(ctx, req.ID()); !errors.Is(err, repository.ErrJourneyRequestNotFound) {
		t.Errorf("expected ErrJourneyRequestNotFound after delete, got %v", err)
	}
}

func TestJourneyRequestRepositoryMemory_Delete_NotFound(t *testing.T) {
	repo := NewJourneyRequestRepository()
	ctx := context.Background()

	err := repo.Delete(ctx, value_object.NewID())
	if !errors.Is(err, repository.ErrJourneyRequestNotFound) {
		t.Errorf("expected ErrJourneyRequestNotFound, got %v", err)
	}
}
