package generatejourney

import (
	"context"
	"errors"
	"testing"
	"time"

	"cacao/src/application"
	"cacao/src/domain/entity"
	"cacao/src/domain/event"
	"cacao/src/domain/repository"
	"cacao/src/domain/service"
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

type mockJourneyRepo struct {
	saved entity.Journey
	err   error
}

func (m *mockJourneyRepo) Save(_ context.Context, journey entity.Journey) error {
	if m.err != nil {
		return m.err
	}
	m.saved = journey
	return nil
}

func (m *mockJourneyRepo) FindByID(_ context.Context, _ value_object.ID) (entity.Journey, error) {
	return entity.Journey{}, repository.ErrJourneyNotFound
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

type mockPublisher struct {
	events []event.DomainEvent
	err    error
}

func (m *mockPublisher) Publish(_ context.Context, e event.DomainEvent) error {
	if m.err != nil {
		return m.err
	}
	m.events = append(m.events, e)
	return nil
}

type mockGenerator struct {
	route service.GeneratedRoute
	err   error
}

func (m *mockGenerator) Generate(_ context.Context, _ entity.JourneyRequest) (service.GeneratedRoute, error) {
	if m.err != nil {
		return service.GeneratedRoute{}, m.err
	}
	return m.route, nil
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

func mustNewMoney(t *testing.T, amount int, code string) value_object.Money {
	t.Helper()
	currency, _ := value_object.NewCurrency(code)
	money, _ := value_object.NewMoney(amount, currency)
	return money
}

func TestUseCase_Execute(t *testing.T) {
	t.Run("正常系: JourneyRequest から Journey が生成・保存される", func(t *testing.T) {
		request := mustNewJourneyRequest(t)
		journeyRepo := &mockJourneyRepo{}
		publisher := &mockPublisher{}
		uc := NewUseCase(
			&mockRequestRepo{request: request},
			journeyRepo,
			&mockGenerator{route: service.GeneratedRoute{
				Days: []service.GeneratedDay{
					{
						Date: time.Date(2026, 7, 7, 0, 0, 0, 0, time.UTC),
						Spots: []service.GeneratedSpot{
							{
								Name:          "東京タワー",
								Description:   "展望台",
								StartAt:       time.Date(2026, 7, 7, 10, 0, 0, 0, time.UTC),
								EstimatedCost: mustNewMoney(t, 1000, "JPY"),
							},
						},
					},
					{
						Date: time.Date(2026, 7, 8, 0, 0, 0, 0, time.UTC),
						Spots: []service.GeneratedSpot{
							{
								Name:          "博物館",
								Description:   "美術鑑賞",
								StartAt:       time.Date(2026, 7, 8, 14, 0, 0, 0, time.UTC),
								EstimatedCost: mustNewMoney(t, 1500, "JPY"),
							},
						},
					},
				},
			}},
			publisher,
		)

		output, err := uc.Execute(context.Background(), Input{RequestID: request.ID().String()})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if output.JourneyID == "" {
			t.Fatal("expected non-empty journey id")
		}
		if journeyRepo.saved.ID().String() != output.JourneyID {
			t.Fatalf("saved id mismatch")
		}
		if journeyRepo.saved.DayCount() != 2 {
			t.Fatalf("day count = %d, want 2", journeyRepo.saved.DayCount())
		}
		if len(publisher.events) != 1 {
			t.Fatalf("expected 1 published event, got %d", len(publisher.events))
		}
	})

	t.Run("異常系: 不正な RequestID", func(t *testing.T) {
		uc := NewUseCase(&mockRequestRepo{}, &mockJourneyRepo{}, &mockGenerator{}, &mockPublisher{})
		_, err := uc.Execute(context.Background(), Input{RequestID: "not-a-uuid"})
		if err == nil {
			t.Fatal("expected error, got nil")
		}
		if !errors.Is(err, application.ErrInvalidInput) {
			t.Fatalf("expected ErrInvalidInput, got %v", err)
		}
	})

	t.Run("異常系: JourneyRequest が存在しない", func(t *testing.T) {
		uc := NewUseCase(
			&mockRequestRepo{err: repository.ErrJourneyRequestNotFound},
			&mockJourneyRepo{},
			&mockGenerator{},
			&mockPublisher{},
		)
		_, err := uc.Execute(context.Background(), Input{RequestID: value_object.NewID().String()})
		if err == nil {
			t.Fatal("expected error, got nil")
		}
		if !errors.Is(err, application.ErrRequestNotFound) {
			t.Fatalf("expected ErrRequestNotFound, got %v", err)
		}
	})

	t.Run("異常系: 旅程生成失敗", func(t *testing.T) {
		request := mustNewJourneyRequest(t)
		uc := NewUseCase(
			&mockRequestRepo{request: request},
			&mockJourneyRepo{},
			&mockGenerator{err: errors.New("generation failed")},
			&mockPublisher{},
		)
		_, err := uc.Execute(context.Background(), Input{RequestID: request.ID().String()})
		if err == nil {
			t.Fatal("expected error, got nil")
		}
		if !errors.Is(err, application.ErrGenerationFailed) {
			t.Fatalf("expected ErrGenerationFailed, got %v", err)
		}
	})

	t.Run("異常系: Journey 保存失敗", func(t *testing.T) {
		request := mustNewJourneyRequest(t)
		uc := NewUseCase(
			&mockRequestRepo{request: request},
			&mockJourneyRepo{err: errors.New("save failed")},
			&mockGenerator{route: service.GeneratedRoute{
				Days: []service.GeneratedDay{
					{
						Date: time.Date(2026, 7, 7, 0, 0, 0, 0, time.UTC),
						Spots: []service.GeneratedSpot{
							{
								Name:          "東京タワー",
								Description:   "展望台",
								StartAt:       time.Date(2026, 7, 7, 10, 0, 0, 0, time.UTC),
								EstimatedCost: mustNewMoney(t, 1000, "JPY"),
							},
						},
					},
				},
			}},
			&mockPublisher{},
		)

		_, err := uc.Execute(context.Background(), Input{RequestID: request.ID().String()})
		if err == nil {
			t.Fatal("expected error, got nil")
		}
		if !errors.Is(err, application.ErrGenerationFailed) {
			t.Fatalf("expected ErrGenerationFailed, got %v", err)
		}
	})

	t.Run("異常系: Period 外の日付が生成された", func(t *testing.T) {
		request := mustNewJourneyRequest(t)
		uc := NewUseCase(
			&mockRequestRepo{request: request},
			&mockJourneyRepo{},
			&mockGenerator{route: service.GeneratedRoute{
				Days: []service.GeneratedDay{
					{
						Date: time.Date(2026, 7, 10, 0, 0, 0, 0, time.UTC),
						Spots: []service.GeneratedSpot{
							{
								Name:          "範囲外",
								Description:   "エラーになる",
								StartAt:       time.Date(2026, 7, 10, 10, 0, 0, 0, time.UTC),
								EstimatedCost: mustNewMoney(t, 1000, "JPY"),
							},
						},
					},
				},
			}},
			&mockPublisher{},
		)

		_, err := uc.Execute(context.Background(), Input{RequestID: request.ID().String()})
		if err == nil {
			t.Fatal("expected error, got nil")
		}
	})

	t.Run("境界値: 期間最初の日と最後の日が含まれる", func(t *testing.T) {
		request := mustNewJourneyRequest(t)
		journeyRepo := &mockJourneyRepo{}
		uc := NewUseCase(
			&mockRequestRepo{request: request},
			journeyRepo,
			&mockGenerator{route: service.GeneratedRoute{
				Days: []service.GeneratedDay{
					{
						Date: time.Date(2026, 7, 7, 0, 0, 0, 0, time.UTC),
						Spots: []service.GeneratedSpot{
							{
								Name:          "開始日",
								Description:   "最初",
								StartAt:       time.Date(2026, 7, 7, 10, 0, 0, 0, time.UTC),
								EstimatedCost: mustNewMoney(t, 0, "JPY"),
							},
						},
					},
					{
						Date: time.Date(2026, 7, 9, 0, 0, 0, 0, time.UTC),
						Spots: []service.GeneratedSpot{
							{
								Name:          "最終日",
								Description:   "最後",
								StartAt:       time.Date(2026, 7, 9, 10, 0, 0, 0, time.UTC),
								EstimatedCost: mustNewMoney(t, 0, "JPY"),
							},
						},
					},
				},
			}},
			&mockPublisher{},
		)

		output, err := uc.Execute(context.Background(), Input{RequestID: request.ID().String()})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if output.JourneyID == "" {
			t.Fatal("expected non-empty journey id")
		}
	})

	t.Run("異常系: イベント発行失敗", func(t *testing.T) {
		request := mustNewJourneyRequest(t)
		publisher := &mockPublisher{err: errors.New("publish failed")}
		uc := NewUseCase(
			&mockRequestRepo{request: request},
			&mockJourneyRepo{},
			&mockGenerator{route: service.GeneratedRoute{
				Days: []service.GeneratedDay{
					{
						Date: time.Date(2026, 7, 7, 0, 0, 0, 0, time.UTC),
						Spots: []service.GeneratedSpot{
							{
								Name:          "東京タワー",
								Description:   "展望台",
								StartAt:       time.Date(2026, 7, 7, 10, 0, 0, 0, time.UTC),
								EstimatedCost: mustNewMoney(t, 1000, "JPY"),
							},
						},
					},
				},
			}},
			publisher,
		)

		_, err := uc.Execute(context.Background(), Input{RequestID: request.ID().String()})
		if err == nil {
			t.Fatal("expected error, got nil")
		}
	})
}
