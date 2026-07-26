package postgres

import (
	"cacao/src/domain/entity"
	"cacao/src/domain/repository"
	"cacao/src/domain/value_object"
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"gorm.io/gorm"
)

func newTestJourney(t *testing.T, requestID value_object.ID) entity.Journey {
	t.Helper()

	journeyID := value_object.NewID()

	currency, err := value_object.NewCurrency("JPY")
	if err != nil {
		t.Fatalf("failed to create currency: %v", err)
	}
	cost, err := value_object.NewMoney(5000, currency)
	if err != nil {
		t.Fatalf("failed to create money: %v", err)
	}

	date := time.Date(2026, 7, 1, 0, 0, 0, 0, time.UTC)
	spot, err := entity.NewSpot(
		value_object.NewID(),
		"浅草寺",
		"雷門をくぐるパワースポット",
		time.Date(2026, 7, 1, 9, 0, 0, 0, time.UTC),
		cost,
	)
	if err != nil {
		t.Fatalf("failed to create spot: %v", err)
	}

	day, err := entity.NewItineraryDay(value_object.NewID(), date, []entity.Spot{spot})
	if err != nil {
		t.Fatalf("failed to create itinerary day: %v", err)
	}

	period, err := value_object.NewPeriod(date, date)
	if err != nil {
		t.Fatalf("failed to create period: %v", err)
	}

	journey, err := entity.NewJourney(journeyID, requestID, period, []entity.ItineraryDay{day})
	if err != nil {
		t.Fatalf("failed to create journey: %v", err)
	}
	return journey
}

func cleanJourneys(t *testing.T, db *gorm.DB) {
	t.Helper()
	// journeys 行を TRUNCATE すれば、外部キー制約 OnDelete:CASCADE により
	// itinerary_days / spots も連鎖的に削除される。親1行で集約全体を消せる。
	if err := db.Exec("TRUNCATE TABLE journey.journeys CASCADE").Error; err != nil {
		t.Fatalf("failed to truncate journeys: %v", err)
	}
}

func TestJourneyRepositoryPostgres_SaveAndFindByID(t *testing.T) {
	db := skipIfNoDB(t)
	t.Cleanup(func() { cleanJourneys(t, db) })

	requestRepo := NewJourneyRequestRepository(db)
	req := newTestJourneyRequest(t)
	ctx := context.Background()
	if err := requestRepo.Save(ctx, req); err != nil {
		t.Fatalf("failed to save journey request: %v", err)
	}

	repo := NewJourneyRepository(db)
	journey := newTestJourney(t, req.ID())

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
	if !got.RequestID().Equals(journey.RequestID()) {
		t.Errorf("RequestID mismatch: got %v, want %v", got.RequestID(), journey.RequestID())
	}
	if got.DayCount() != journey.DayCount() {
		t.Errorf("DayCount mismatch: got %d, want %d", got.DayCount(), journey.DayCount())
	}
}

// newTestJourneyWithDays は指定した日程数の Journey を作るヘルパ。
// 日付は start から1日ずつインクリメントされる。各日程に1つのスポットを持つ。
// Save_Updates のように「件数が増減する」境界値を検証するために用いる。
func newTestJourneyWithDays(t *testing.T, requestID value_object.ID, dayCount int, start time.Time) entity.Journey {
	t.Helper()

	currency, err := value_object.NewCurrency("JPY")
	if err != nil {
		t.Fatalf("failed to create currency: %v", err)
	}
	cost, err := value_object.NewMoney(1000, currency)
	if err != nil {
		t.Fatalf("failed to create money: %v", err)
	}

	days := make([]entity.ItineraryDay, 0, dayCount)
	for i := 0; i < dayCount; i++ {
		date := start.AddDate(0, 0, i)
		spot, err := entity.NewSpot(
			value_object.NewID(),
			fmt.Sprintf("スポット%d", i+1),
			"テスト用スポット",
			date.Add(9*time.Hour),
			cost,
		)
		if err != nil {
			t.Fatalf("failed to create spot %d: %v", i+1, err)
		}
		day, err := entity.NewItineraryDay(value_object.NewID(), date, []entity.Spot{spot})
		if err != nil {
			t.Fatalf("failed to create itinerary day %d: %v", i+1, err)
		}
		days = append(days, day)
	}

	end := start.AddDate(0, 0, dayCount-1)
	period, err := value_object.NewPeriod(start, end)
	if err != nil {
		t.Fatalf("failed to create period: %v", err)
	}

	journeyID := value_object.NewID()
	journey, err := entity.NewJourney(journeyID, requestID, period, days)
	if err != nil {
		t.Fatalf("failed to create journey: %v", err)
	}
	return journey
}

func TestJourneyRepositoryPostgres_Save_Updates(t *testing.T) {
	db := skipIfNoDB(t)
	t.Cleanup(func() { cleanJourneys(t, db) })

	requestRepo := NewJourneyRequestRepository(db)
	req := newTestJourneyRequest(t)
	ctx := context.Background()
	if err := requestRepo.Save(ctx, req); err != nil {
		t.Fatalf("failed to save journey request: %v", err)
	}

	repo := NewJourneyRepository(db)

	// 初期状態: 2日分の journey を保存する。
	// 1日→1日では「Delete→Insert」「上書きUpdate」「差分Upsert」のどれでも通ってしまうため、
	// 「件数が減る」境界値を用いて、旧レコードが確実に排除されることを検証する。
	start := time.Date(2026, 7, 1, 0, 0, 0, 0, time.UTC)
	journey := newTestJourneyWithDays(t, req.ID(), 2, start)
	if err := repo.Save(ctx, journey); err != nil {
		t.Fatalf("Save (initial) failed: %v", err)
	}

	// 更新後: 同一IDで1日分に減らす。日付も変更する。
	// 旧2日分が残っていれば DayCount が 2 になり、戦略が不正なことを検出できる。
	newStart := time.Date(2026, 7, 5, 0, 0, 0, 0, time.UTC)
	updated := newTestJourneyWithDays(t, req.ID(), 1, newStart)
	updatedDays := updated.Days()
	newPeriod, err := value_object.NewPeriod(newStart, newStart)
	if err != nil {
		t.Fatalf("failed to create new period: %v", err)
	}
	updated, err = entity.NewJourney(journey.ID(), req.ID(), newPeriod, updatedDays)
	if err != nil {
		t.Fatalf("failed to create updated journey: %v", err)
	}

	if err := repo.Save(ctx, updated); err != nil {
		t.Fatalf("Save (update) failed: %v", err)
	}

	got, err := repo.FindByID(ctx, journey.ID())
	if err != nil {
		t.Fatalf("FindByID failed: %v", err)
	}

	// 日程数が 1 → 1 ではなく 2 → 1 に減ったことを検証。
	if got.DayCount() != 1 {
		t.Errorf("expected 1 day after update (from 2), got %d", got.DayCount())
	}

	// 日付が新規のものに置き換わっていることを検証。
	gotDays := got.Days()
	if !gotDays[0].Date().Equal(newStart) {
		t.Errorf("Date mismatch: got %v, want %v", gotDays[0].Date(), newStart)
	}
	// 古い日付が残っていないことを検証。
	for _, d := range gotDays {
		if d.Date().Equal(start) || d.Date().Equal(start.AddDate(0, 0, 1)) {
			t.Errorf("stale day remained: %v", d.Date())
		}
	}

	// スポット名が新規のものに置き換わっていることを検証。
	gotSpots := gotDays[0].Spots()
	if len(gotSpots) != 1 {
		t.Fatalf("expected 1 spot, got %d", len(gotSpots))
	}
	if gotSpots[0].Name() != "スポット1" {
		t.Errorf("Spot name mismatch: got %v, want %v", gotSpots[0].Name(), "スポット1")
	}
}

func TestJourneyRepositoryPostgres_FindByID_NotFound(t *testing.T) {
	db := skipIfNoDB(t)
	t.Cleanup(func() { cleanJourneys(t, db) })

	repo := NewJourneyRepository(db)
	ctx := context.Background()

	_, err := repo.FindByID(ctx, value_object.NewID())
	if !errors.Is(err, repository.ErrJourneyNotFound) {
		t.Errorf("expected ErrJourneyNotFound, got %v", err)
	}
}

func TestJourneyRepositoryPostgres_FindByRequestID(t *testing.T) {
	db := skipIfNoDB(t)
	t.Cleanup(func() { cleanJourneys(t, db) })

	requestRepo := NewJourneyRequestRepository(db)
	req := newTestJourneyRequest(t)
	ctx := context.Background()
	if err := requestRepo.Save(ctx, req); err != nil {
		t.Fatalf("failed to save journey request: %v", err)
	}

	repo := NewJourneyRepository(db)
	journey := newTestJourney(t, req.ID())
	if err := repo.Save(ctx, journey); err != nil {
		t.Fatalf("Save failed: %v", err)
	}

	got, err := repo.FindByRequestID(ctx, req.ID())
	if err != nil {
		t.Fatalf("FindByRequestID failed: %v", err)
	}
	if !got.Equals(journey) {
		t.Errorf("FindByRequestID returned different journey: got %v, want %v", got.ID(), journey.ID())
	}
}

func TestJourneyRepositoryPostgres_FindByRequestID_NotFound(t *testing.T) {
	db := skipIfNoDB(t)
	t.Cleanup(func() { cleanJourneys(t, db) })

	repo := NewJourneyRepository(db)
	ctx := context.Background()

	_, err := repo.FindByRequestID(ctx, value_object.NewID())
	if !errors.Is(err, repository.ErrJourneyNotFound) {
		t.Errorf("expected ErrJourneyNotFound, got %v", err)
	}
}

func TestJourneyRepositoryPostgres_FindAll(t *testing.T) {
	db := skipIfNoDB(t)
	t.Cleanup(func() { cleanJourneys(t, db) })

	requestRepo := NewJourneyRequestRepository(db)
	req := newTestJourneyRequest(t)
	ctx := context.Background()
	if err := requestRepo.Save(ctx, req); err != nil {
		t.Fatalf("failed to save journey request: %v", err)
	}

	repo := NewJourneyRepository(db)

	got, err := repo.FindAll(ctx)
	if err != nil {
		t.Fatalf("FindAll failed: %v", err)
	}
	if len(got) != 0 {
		t.Errorf("expected empty list, got %d items", len(got))
	}

	journey := newTestJourney(t, req.ID())
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

	// 2件目を追加し、複数件取得でも正しく戻ることを検証する。
	// Preload("Days").Preload("Days.Spots") が多重集約で破綻しない境界値。
	journey2 := newTestJourney(t, req.ID())
	if err := repo.Save(ctx, journey2); err != nil {
		t.Fatalf("Save (second) failed: %v", err)
	}

	got, err = repo.FindAll(ctx)
	if err != nil {
		t.Fatalf("FindAll (second) failed: %v", err)
	}
	if len(got) != 2 {
		t.Errorf("expected 2 items, got %d", len(got))
	}

	// 両集約のIDが含まれていることを検証（順序は未定義なので双方チェック）。
	ids := map[string]bool{got[0].ID().String(): true, got[1].ID().String(): true}
	if !ids[journey.ID().String()] || !ids[journey2.ID().String()] {
		t.Errorf("FindAll returned wrong journeys: got %v, want %v and %v",
			ids, journey.ID(), journey2.ID())
	}
}

func TestJourneyRepositoryPostgres_Delete(t *testing.T) {
	db := skipIfNoDB(t)
	t.Cleanup(func() { cleanJourneys(t, db) })

	requestRepo := NewJourneyRequestRepository(db)
	req := newTestJourneyRequest(t)
	ctx := context.Background()
	if err := requestRepo.Save(ctx, req); err != nil {
		t.Fatalf("failed to save journey request: %v", err)
	}

	repo := NewJourneyRepository(db)
	journey := newTestJourney(t, req.ID())
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

func TestJourneyRepositoryPostgres_Delete_NotFound(t *testing.T) {
	db := skipIfNoDB(t)
	t.Cleanup(func() { cleanJourneys(t, db) })

	repo := NewJourneyRepository(db)
	ctx := context.Background()

	err := repo.Delete(ctx, value_object.NewID())
	if !errors.Is(err, repository.ErrJourneyNotFound) {
		t.Errorf("expected ErrJourneyNotFound, got %v", err)
	}
}
