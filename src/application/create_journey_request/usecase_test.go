package createjourneyrequest

import (
	"context"
	"errors"
	"testing"
	"time"

	"cacao/src/application"
	"cacao/src/domain/entity"
	"cacao/src/domain/value_object"
	"cacao/src/internal/testkit"
	"cacao/src/internal/testkit/fakes"
)

// validInput は正常系の入力値を返す。opt で一部のフィールドだけ上書きできる。
func validInput(opt ...func(*Input)) Input {
	in := Input{
		DepartureCity:      "東京",
		DepartureCountry:   "日本",
		DestinationCity:    "大阪",
		DestinationCountry: "日本",
		StartDate:          testkit.DefaultPeriodStart,
		EndDate:            testkit.DefaultPeriodEnd,
		Amount:             50000,
		Currency:           "JPY",
	}
	for _, o := range opt {
		o(&in)
	}
	return in
}

func withDepartureCity(v string) func(*Input) { return func(i *Input) { i.DepartureCity = v } }
func withStartDate(v time.Time) func(*Input)  { return func(i *Input) { i.StartDate = v } }
func withEndDate(v time.Time) func(*Input)    { return func(i *Input) { i.EndDate = v } }
func withCurrency(v string) func(*Input)      { return func(i *Input) { i.Currency = v } }
func withAmount(v int) func(*Input)           { return func(i *Input) { i.Amount = v } }

// newUseCase はフェイクを生成し、(usecase, repo, publisher) を返す。
func newUseCase() (UseCase, *fakes.FakeJourneyRequestRepository, *fakes.FakePublisher) {
	repo := fakes.NewJourneyRequestRepository()
	publisher := &fakes.FakePublisher{}
	return NewUseCase(repo, publisher), repo, publisher
}

// assertInvalidInput は Execute が ErrInvalidInput で失敗することを確認する。
func assertInvalidInput(t *testing.T, uc UseCase, in Input) {
	t.Helper()
	_, err := uc.Execute(context.Background(), in)
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if !errors.Is(err, application.ErrInvalidInput) {
		t.Fatalf("expected ErrInvalidInput, got %v", err)
	}
}

func TestUseCase_Execute(t *testing.T) {
	t.Run("正常系: 有効な入力から JourneyRequest が生成・保存される", func(t *testing.T) {
		uc, repo, publisher := newUseCase()

		output, err := uc.Execute(context.Background(), validInput())
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if output.RequestID == "" {
			t.Fatal("expected non-empty request id")
		}
		// 保存済みの内容はインメモリリポジトリから取り出して検証する
		requestID, err := value_object.NewIDFromString(output.RequestID)
		if err != nil {
			t.Fatalf("output request id is not a valid id: %v", err)
		}
		saved, err := repo.FindByID(context.Background(), requestID)
		if err != nil {
			t.Fatalf("saved request not found: %v", err)
		}
		if saved.ID().String() != output.RequestID {
			t.Fatalf("saved id mismatch: got %q, want %q", saved.ID().String(), output.RequestID)
		}
		if saved.Departure().City() != "東京" {
			t.Fatalf("departure city mismatch: got %q", saved.Departure().City())
		}
		if saved.Destination().City() != "大阪" {
			t.Fatalf("destination city mismatch: got %q", saved.Destination().City())
		}
		if len(publisher.Events) != 1 {
			t.Fatalf("expected 1 published event, got %d", len(publisher.Events))
		}
	})

	t.Run("異常系: 出発地点の都市が空", func(t *testing.T) {
		uc, _, _ := newUseCase()
		assertInvalidInput(t, uc, validInput(withDepartureCity("   ")))
	})

	t.Run("異常系: 終了日が開始日より前", func(t *testing.T) {
		uc, _, _ := newUseCase()
		start := testkit.DefaultPeriodEnd
		end := testkit.DefaultPeriodStart
		assertInvalidInput(t, uc, validInput(withStartDate(start), withEndDate(end)))
	})

	t.Run("異常系: 不正な通貨コード", func(t *testing.T) {
		uc, _, _ := newUseCase()
		assertInvalidInput(t, uc, validInput(withCurrency("YEN1")))
	})

	t.Run("異常系: 予算が負数", func(t *testing.T) {
		uc, _, _ := newUseCase()
		assertInvalidInput(t, uc, validInput(withAmount(-1000)))
	})

	t.Run("異常系: リポジトリ保存失敗", func(t *testing.T) {
		repo := fakes.NewJourneyRequestRepository()
		repo.SaveFn = func(context.Context, entity.JourneyRequest) error {
			return errors.New("save failed")
		}
		uc := NewUseCase(repo, &fakes.FakePublisher{})

		_, err := uc.Execute(context.Background(), validInput())
		if err == nil {
			t.Fatal("expected error, got nil")
		}
	})

	t.Run("異常系: イベント発行失敗", func(t *testing.T) {
		uc := NewUseCase(fakes.NewJourneyRequestRepository(), &fakes.FakePublisher{Err: errors.New("publish failed")})

		_, err := uc.Execute(context.Background(), validInput())
		if err == nil {
			t.Fatal("expected error, got nil")
		}
	})

	t.Run("境界値: 開始日と終了日が同日", func(t *testing.T) {
		uc, _, _ := newUseCase()
		day := testkit.DefaultPeriodStart
		in := validInput(withStartDate(day), withEndDate(day), withAmount(0))

		output, err := uc.Execute(context.Background(), in)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if output.RequestID == "" {
			t.Fatal("expected non-empty request id")
		}
	})
}
