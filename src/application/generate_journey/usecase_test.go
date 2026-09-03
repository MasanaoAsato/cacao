package generatejourney

import (
	"context"
	"errors"
	"testing"
	"time"

	"cacao/src/application"
	"cacao/src/domain/entity"
	"cacao/src/domain/service"
	"cacao/src/domain/value_object"
	"cacao/src/internal/testkit"
	"cacao/src/internal/testkit/fakes"
)

// stubGenerator は service.JourneyGenerator のスタブ。固定の route か err を返す。
type stubGenerator struct {
	route service.GeneratedRoute
	err   error
}

func (s *stubGenerator) Generate(_ context.Context, _ entity.JourneyRequest) (service.GeneratedRoute, error) {
	if s.err != nil {
		return service.GeneratedRoute{}, s.err
	}
	return s.route, nil
}

// mustNewGeneratedLegsFor は n 個の GeneratedLeg を生成するテストヘルパー。
func mustNewGeneratedLegsFor(t *testing.T, n int, code string) []service.GeneratedLeg {
	t.Helper()
	mode, err := value_object.NewTransportMode("walk")
	if err != nil {
		t.Fatalf("failed to create transport mode: %v", err)
	}
	cost := testkit.MustNewMoney(t, 0, code)
	legs := make([]service.GeneratedLeg, n)
	for i := range legs {
		legs[i] = service.GeneratedLeg{
			FromLabel: func() string {
				if i == 0 {
					return "出発地"
				}
				return ""
			}(),
			Mode:     mode,
			Duration: time.Minute,
			Cost:     cost,
		}
	}
	return legs
}

func TestUseCase_Execute(t *testing.T) {
	t.Run("正常系: JourneyRequest から Journey が生成・保存される", func(t *testing.T) {
		request := testkit.MustNewJourneyRequest(t)
		journeyRepo := fakes.NewJourneyRepository()
		publisher := &fakes.FakePublisher{}
		uc := NewUseCase(
			fakes.NewJourneyRequestRepositoryWith(t, request),
			journeyRepo,
			&stubGenerator{route: service.GeneratedRoute{
				Days: []service.GeneratedDay{
					{
						Date: time.Date(2026, 7, 7, 0, 0, 0, 0, time.UTC),
						Spots: []service.GeneratedSpot{
							{
								Name:          "東京タワー",
								Description:   "展望台",
								StartAt:       time.Date(2026, 7, 7, 10, 0, 0, 0, time.UTC),
								EstimatedCost: testkit.MustNewMoney(t, 1000, "JPY"),
							},
						},
						Legs: mustNewGeneratedLegsFor(t, 1, "JPY"),
					},
					{
						Date: time.Date(2026, 7, 8, 0, 0, 0, 0, time.UTC),
						Spots: []service.GeneratedSpot{
							{
								Name:          "博物館",
								Description:   "美術鑑賞",
								StartAt:       time.Date(2026, 7, 8, 14, 0, 0, 0, time.UTC),
								EstimatedCost: testkit.MustNewMoney(t, 1500, "JPY"),
							},
						},
						Legs: mustNewGeneratedLegsFor(t, 1, "JPY"),
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
		// 保存済みの内容はインメモリリポジトリから取り出して検証する
		journeyID, err := value_object.NewIDFromString(output.JourneyID)
		if err != nil {
			t.Fatalf("output journey id is not a valid id: %v", err)
		}
		saved, err := journeyRepo.FindByID(context.Background(), journeyID)
		if err != nil {
			t.Fatalf("saved journey not found: %v", err)
		}
		if saved.ID().String() != output.JourneyID {
			t.Fatalf("saved id mismatch")
		}
		if saved.DayCount() != 2 {
			t.Fatalf("day count = %d, want 2", saved.DayCount())
		}
		if len(publisher.Events) != 1 {
			t.Fatalf("expected 1 published event, got %d", len(publisher.Events))
		}
	})

	t.Run("異常系: 不正な RequestID", func(t *testing.T) {
		uc := NewUseCase(
			fakes.NewJourneyRequestRepository(),
			fakes.NewJourneyRepository(),
			&stubGenerator{},
			&fakes.FakePublisher{},
		)
		_, err := uc.Execute(context.Background(), Input{RequestID: "not-a-uuid"})
		if err == nil {
			t.Fatal("expected error, got nil")
		}
		if !errors.Is(err, application.ErrInvalidInput) {
			t.Fatalf("expected ErrInvalidInput, got %v", err)
		}
	})

	t.Run("異常系: JourneyRequest が存在しない", func(t *testing.T) {
		// 空のインメモリリポジトリは repository.ErrJourneyRequestNotFound を返す
		uc := NewUseCase(
			fakes.NewJourneyRequestRepository(),
			fakes.NewJourneyRepository(),
			&stubGenerator{},
			&fakes.FakePublisher{},
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
		request := testkit.MustNewJourneyRequest(t)
		uc := NewUseCase(
			fakes.NewJourneyRequestRepositoryWith(t, request),
			fakes.NewJourneyRepository(),
			&stubGenerator{err: errors.New("generation failed")},
			&fakes.FakePublisher{},
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
		request := testkit.MustNewJourneyRequest(t)
		journeyRepo := fakes.NewJourneyRepository()
		journeyRepo.SaveFn = func(context.Context, entity.Journey) error {
			return errors.New("save failed")
		}
		uc := NewUseCase(
			fakes.NewJourneyRequestRepositoryWith(t, request),
			journeyRepo,
			&stubGenerator{route: service.GeneratedRoute{
				Days: []service.GeneratedDay{
					{
						Date: time.Date(2026, 7, 7, 0, 0, 0, 0, time.UTC),
						Spots: []service.GeneratedSpot{
							{
								Name:          "東京タワー",
								Description:   "展望台",
								StartAt:       time.Date(2026, 7, 7, 10, 0, 0, 0, time.UTC),
								EstimatedCost: testkit.MustNewMoney(t, 1000, "JPY"),
							},
						},
						Legs: mustNewGeneratedLegsFor(t, 1, "JPY"),
					},
				},
			}},
			&fakes.FakePublisher{},
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
		request := testkit.MustNewJourneyRequest(t)
		uc := NewUseCase(
			fakes.NewJourneyRequestRepositoryWith(t, request),
			fakes.NewJourneyRepository(),
			&stubGenerator{route: service.GeneratedRoute{
				Days: []service.GeneratedDay{
					{
						Date: time.Date(2026, 7, 10, 0, 0, 0, 0, time.UTC),
						Spots: []service.GeneratedSpot{
							{
								Name:          "範囲外",
								Description:   "エラーになる",
								StartAt:       time.Date(2026, 7, 10, 10, 0, 0, 0, time.UTC),
								EstimatedCost: testkit.MustNewMoney(t, 1000, "JPY"),
							},
						},
						Legs: mustNewGeneratedLegsFor(t, 1, "JPY"),
					},
				},
			}},
			&fakes.FakePublisher{},
		)

		_, err := uc.Execute(context.Background(), Input{RequestID: request.ID().String()})
		if err == nil {
			t.Fatal("expected error, got nil")
		}
	})

	t.Run("境界値: 期間最初の日と最後の日が含まれる", func(t *testing.T) {
		request := testkit.MustNewJourneyRequest(t)
		uc := NewUseCase(
			fakes.NewJourneyRequestRepositoryWith(t, request),
			fakes.NewJourneyRepository(),
			&stubGenerator{route: service.GeneratedRoute{
				Days: []service.GeneratedDay{
					{
						Date: time.Date(2026, 7, 7, 0, 0, 0, 0, time.UTC),
						Spots: []service.GeneratedSpot{
							{
								Name:          "開始日",
								Description:   "最初",
								StartAt:       time.Date(2026, 7, 7, 10, 0, 0, 0, time.UTC),
								EstimatedCost: testkit.MustNewMoney(t, 0, "JPY"),
							},
						},
						Legs: mustNewGeneratedLegsFor(t, 1, "JPY"),
					},
					{
						Date: time.Date(2026, 7, 9, 0, 0, 0, 0, time.UTC),
						Spots: []service.GeneratedSpot{
							{
								Name:          "最終日",
								Description:   "最後",
								StartAt:       time.Date(2026, 7, 9, 10, 0, 0, 0, time.UTC),
								EstimatedCost: testkit.MustNewMoney(t, 0, "JPY"),
							},
						},
						Legs: mustNewGeneratedLegsFor(t, 1, "JPY"),
					},
				},
			}},
			&fakes.FakePublisher{},
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
		request := testkit.MustNewJourneyRequest(t)
		publisher := &fakes.FakePublisher{Err: errors.New("publish failed")}
		uc := NewUseCase(
			fakes.NewJourneyRequestRepositoryWith(t, request),
			fakes.NewJourneyRepository(),
			&stubGenerator{route: service.GeneratedRoute{
				Days: []service.GeneratedDay{
					{
						Date: time.Date(2026, 7, 7, 0, 0, 0, 0, time.UTC),
						Spots: []service.GeneratedSpot{
							{
								Name:          "東京タワー",
								Description:   "展望台",
								StartAt:       time.Date(2026, 7, 7, 10, 0, 0, 0, time.UTC),
								EstimatedCost: testkit.MustNewMoney(t, 1000, "JPY"),
							},
						},
						Legs: mustNewGeneratedLegsFor(t, 1, "JPY"),
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
