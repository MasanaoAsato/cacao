package createjourneyrequest

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

type mockJourneyRequestRepository struct {
	saved entity.JourneyRequest
	err   error
}

func (m *mockJourneyRequestRepository) Save(_ context.Context, request entity.JourneyRequest) error {
	if m.err != nil {
		return m.err
	}
	m.saved = request
	return nil
}

func (m *mockJourneyRequestRepository) FindByID(_ context.Context, _ value_object.ID) (entity.JourneyRequest, error) {
	return entity.JourneyRequest{}, repository.ErrJourneyRequestNotFound
}

func (m *mockJourneyRequestRepository) FindAll(_ context.Context) ([]entity.JourneyRequest, error) {
	return nil, nil
}

func (m *mockJourneyRequestRepository) Delete(_ context.Context, _ value_object.ID) error {
	return nil
}

func TestUseCase_Execute(t *testing.T) {
	t.Run("正常系: 有効な入力から JourneyRequest が生成・保存される", func(t *testing.T) {
		repo := &mockJourneyRequestRepository{}
		uc := NewUseCase(repo)
		input := Input{
			DepartureCity:    "東京",
			DepartureCountry: "日本",
			StartDate:        time.Date(2026, 7, 7, 0, 0, 0, 0, time.UTC),
			EndDate:          time.Date(2026, 7, 9, 0, 0, 0, 0, time.UTC),
			Amount:           50000,
			Currency:         "JPY",
		}

		output, err := uc.Execute(context.Background(), input)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if output.RequestID == "" {
			t.Fatal("expected non-empty request id")
		}
		if repo.saved.ID().String() != output.RequestID {
			t.Fatalf("saved id mismatch: got %q, want %q", repo.saved.ID().String(), output.RequestID)
		}
		if repo.saved.Departure().City() != "東京" {
			t.Fatalf("departure city mismatch: got %q", repo.saved.Departure().City())
		}
	})

	t.Run("異常系: 出発地点の都市が空", func(t *testing.T) {
		uc := NewUseCase(&mockJourneyRequestRepository{})
		input := Input{
			DepartureCity:    "   ",
			DepartureCountry: "日本",
			StartDate:        time.Date(2026, 7, 7, 0, 0, 0, 0, time.UTC),
			EndDate:          time.Date(2026, 7, 9, 0, 0, 0, 0, time.UTC),
			Amount:           50000,
			Currency:         "JPY",
		}

		_, err := uc.Execute(context.Background(), input)
		if err == nil {
			t.Fatal("expected error, got nil")
		}
		if !errors.Is(err, application.ErrInvalidInput) {
			t.Fatalf("expected ErrInvalidInput, got %v", err)
		}
	})

	t.Run("異常系: 終了日が開始日より前", func(t *testing.T) {
		uc := NewUseCase(&mockJourneyRequestRepository{})
		input := Input{
			DepartureCity:    "東京",
			DepartureCountry: "日本",
			StartDate:        time.Date(2026, 7, 9, 0, 0, 0, 0, time.UTC),
			EndDate:          time.Date(2026, 7, 7, 0, 0, 0, 0, time.UTC),
			Amount:           50000,
			Currency:         "JPY",
		}

		_, err := uc.Execute(context.Background(), input)
		if err == nil {
			t.Fatal("expected error, got nil")
		}
		if !errors.Is(err, application.ErrInvalidInput) {
			t.Fatalf("expected ErrInvalidInput, got %v", err)
		}
	})

	t.Run("異常系: 不正な通貨コード", func(t *testing.T) {
		uc := NewUseCase(&mockJourneyRequestRepository{})
		input := Input{
			DepartureCity:    "東京",
			DepartureCountry: "日本",
			StartDate:        time.Date(2026, 7, 7, 0, 0, 0, 0, time.UTC),
			EndDate:          time.Date(2026, 7, 9, 0, 0, 0, 0, time.UTC),
			Amount:           50000,
			Currency:         "YEN1",
		}

		_, err := uc.Execute(context.Background(), input)
		if err == nil {
			t.Fatal("expected error, got nil")
		}
		if !errors.Is(err, application.ErrInvalidInput) {
			t.Fatalf("expected ErrInvalidInput, got %v", err)
		}
	})

	t.Run("異常系: 予算が負数", func(t *testing.T) {
		uc := NewUseCase(&mockJourneyRequestRepository{})
		input := Input{
			DepartureCity:    "東京",
			DepartureCountry: "日本",
			StartDate:        time.Date(2026, 7, 7, 0, 0, 0, 0, time.UTC),
			EndDate:          time.Date(2026, 7, 9, 0, 0, 0, 0, time.UTC),
			Amount:           -1000,
			Currency:         "JPY",
		}

		_, err := uc.Execute(context.Background(), input)
		if err == nil {
			t.Fatal("expected error, got nil")
		}
		if !errors.Is(err, application.ErrInvalidInput) {
			t.Fatalf("expected ErrInvalidInput, got %v", err)
		}
	})

	t.Run("異常系: リポジトリ保存失敗", func(t *testing.T) {
		repo := &mockJourneyRequestRepository{err: errors.New("save failed")}
		uc := NewUseCase(repo)
		input := Input{
			DepartureCity:    "東京",
			DepartureCountry: "日本",
			StartDate:        time.Date(2026, 7, 7, 0, 0, 0, 0, time.UTC),
			EndDate:          time.Date(2026, 7, 9, 0, 0, 0, 0, time.UTC),
			Amount:           50000,
			Currency:         "JPY",
		}

		_, err := uc.Execute(context.Background(), input)
		if err == nil {
			t.Fatal("expected error, got nil")
		}
	})

	t.Run("境界値: 開始日と終了日が同日", func(t *testing.T) {
		repo := &mockJourneyRequestRepository{}
		uc := NewUseCase(repo)
		input := Input{
			DepartureCity:    "東京",
			DepartureCountry: "日本",
			StartDate:        time.Date(2026, 7, 7, 0, 0, 0, 0, time.UTC),
			EndDate:          time.Date(2026, 7, 7, 0, 0, 0, 0, time.UTC),
			Amount:           0,
			Currency:         "JPY",
		}

		output, err := uc.Execute(context.Background(), input)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if output.RequestID == "" {
			t.Fatal("expected non-empty request id")
		}
	})
}
