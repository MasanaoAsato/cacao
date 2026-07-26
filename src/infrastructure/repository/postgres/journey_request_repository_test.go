package postgres

import (
	"cacao/src/domain/entity"
	"cacao/src/domain/repository"
	"cacao/src/domain/value_object"
	"cacao/src/infrastructure/database"
	"context"
	"errors"
	"testing"
	"time"

	"gorm.io/gorm"
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

func skipIfNoDB(t *testing.T) *gorm.DB {
	t.Helper()

	cfg, err := database.ConfigFromEnv()
	if err != nil {
		t.Fatalf("failed to load database config: %v", err)
	}

	db, err := database.CreateGORMClient(context.Background(), cfg)
	if err != nil {
		t.Skipf("postgres is not available: %v", err)
	}
	return db
}

func cleanJourneyRequests(t *testing.T, db *gorm.DB) {
	t.Helper()
	if err := db.Exec("TRUNCATE TABLE journey.journey_requests CASCADE").Error; err != nil {
		t.Fatalf("failed to truncate journey_requests: %v", err)
	}
}

func TestJourneyRequestRepositoryPostgres_SaveAndFindByID(t *testing.T) {
	db := skipIfNoDB(t)
	t.Cleanup(func() { cleanJourneyRequests(t, db) })

	repo := NewJourneyRequestRepository(db)
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
	if !got.Departure().Equals(req.Departure()) {
		t.Errorf("Departure mismatch: got %v, want %v", got.Departure(), req.Departure())
	}
	if !got.Period().Equals(req.Period()) {
		t.Errorf("Period mismatch: got %v, want %v", got.Period(), req.Period())
	}
	if !got.Budget().Equals(req.Budget()) {
		t.Errorf("Budget mismatch: got %v, want %v", got.Budget(), req.Budget())
	}
}

func TestJourneyRequestRepositoryPostgres_Save_Updates(t *testing.T) {
	db := skipIfNoDB(t)
	t.Cleanup(func() { cleanJourneyRequests(t, db) })

	repo := NewJourneyRequestRepository(db)
	req := newTestJourneyRequest(t)
	ctx := context.Background()

	if err := repo.Save(ctx, req); err != nil {
		t.Fatalf("Save failed: %v", err)
	}

	newDeparture, err := value_object.NewDeparture("大阪", "日本")
	if err != nil {
		t.Fatalf("failed to create departure: %v", err)
	}
	updated, err := entity.NewJourneyRequest(req.ID(), newDeparture, req.Period(), req.Budget())
	if err != nil {
		t.Fatalf("failed to create updated request: %v", err)
	}
	if err := repo.Save(ctx, updated); err != nil {
		t.Fatalf("Save failed: %v", err)
	}

	got, err := repo.FindByID(ctx, req.ID())
	if err != nil {
		t.Fatalf("FindByID failed: %v", err)
	}
	if !got.Departure().Equals(newDeparture) {
		t.Errorf("Departure not updated: got %v, want %v", got.Departure(), newDeparture)
	}
	if !got.Period().Equals(req.Period()) {
		t.Errorf("Period mismatch: got %v, want %v", got.Period(), req.Period())
	}
	if !got.Budget().Equals(req.Budget()) {
		t.Errorf("Budget mismatch: got %v, want %v", got.Budget(), req.Budget())
	}
}

func TestJourneyRequestRepositoryPostgres_FindByID_NotFound(t *testing.T) {
	db := skipIfNoDB(t)
	t.Cleanup(func() { cleanJourneyRequests(t, db) })

	repo := NewJourneyRequestRepository(db)
	ctx := context.Background()

	_, err := repo.FindByID(ctx, value_object.NewID())
	if !errors.Is(err, repository.ErrJourneyRequestNotFound) {
		t.Errorf("expected ErrJourneyRequestNotFound, got %v", err)
	}
}

func TestJourneyRequestRepositoryPostgres_FindAll(t *testing.T) {
	db := skipIfNoDB(t)
	t.Cleanup(func() { cleanJourneyRequests(t, db) })

	repo := NewJourneyRequestRepository(db)
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

func TestJourneyRequestRepositoryPostgres_Delete(t *testing.T) {
	db := skipIfNoDB(t)
	t.Cleanup(func() { cleanJourneyRequests(t, db) })

	repo := NewJourneyRequestRepository(db)
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

func TestJourneyRequestRepositoryPostgres_Delete_NotFound(t *testing.T) {
	db := skipIfNoDB(t)
	t.Cleanup(func() { cleanJourneyRequests(t, db) })

	repo := NewJourneyRequestRepository(db)
	ctx := context.Background()

	err := repo.Delete(ctx, value_object.NewID())
	if !errors.Is(err, repository.ErrJourneyRequestNotFound) {
		t.Errorf("expected ErrJourneyRequestNotFound, got %v", err)
	}
}
