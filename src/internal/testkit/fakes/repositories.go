// Package fakes はリポジトリと Publisher のテスト用フェイクをまとめる。
// インメモリ実装を埋め込み、必要なメソッドだけ差し替えられる。
package fakes

import (
	"context"
	"time"

	"cacao/src/domain/entity"
	"cacao/src/domain/event"
	"cacao/src/domain/repository"
	"cacao/src/domain/value_object"
	"cacao/src/infrastructure/repository/memory"
)

// フェイクはインメモリ実装を埋め込み、必要なメソッドだけ *Fn で差し替える。
// 差し替えない限り本物のインメモリ実装として動くので、正常系はデータを Save するだけで書け、
// 異常系はエラーを返す関数を挿すだけで書ける。

// FakeJourneyRequestRepository は JourneyRequestRepository のフェイク。
type FakeJourneyRequestRepository struct {
	*memory.JourneyRequestRepositoryMemory

	SaveFn     func(ctx context.Context, request entity.JourneyRequest) error
	FindByIDFn func(ctx context.Context, id value_object.ID) (entity.JourneyRequest, error)
	FindAllFn  func(ctx context.Context) ([]entity.JourneyRequest, error)
	DeleteFn   func(ctx context.Context, id value_object.ID) error
}

var _ repository.JourneyRequestRepository = (*FakeJourneyRequestRepository)(nil)

// NewJourneyRequestRepository は空のフェイクを作る。
func NewJourneyRequestRepository() *FakeJourneyRequestRepository {
	return &FakeJourneyRequestRepository{JourneyRequestRepositoryMemory: memory.NewJourneyRequestRepository()}
}

// NewJourneyRequestRepositoryWith は requests を保存済みのフェイクを作る。
func NewJourneyRequestRepositoryWith(tb testingTB, requests ...entity.JourneyRequest) *FakeJourneyRequestRepository {
	tb.Helper()
	repo := NewJourneyRequestRepository()
	for _, request := range requests {
		if err := repo.JourneyRequestRepositoryMemory.Save(context.Background(), request); err != nil {
			tb.Fatalf("seed journey request: %v", err)
		}
	}
	return repo
}

func (f *FakeJourneyRequestRepository) Save(ctx context.Context, request entity.JourneyRequest) error {
	if f.SaveFn != nil {
		return f.SaveFn(ctx, request)
	}
	return f.JourneyRequestRepositoryMemory.Save(ctx, request)
}

func (f *FakeJourneyRequestRepository) FindByID(ctx context.Context, id value_object.ID) (entity.JourneyRequest, error) {
	if f.FindByIDFn != nil {
		return f.FindByIDFn(ctx, id)
	}
	return f.JourneyRequestRepositoryMemory.FindByID(ctx, id)
}

func (f *FakeJourneyRequestRepository) FindAll(ctx context.Context) ([]entity.JourneyRequest, error) {
	if f.FindAllFn != nil {
		return f.FindAllFn(ctx)
	}
	return f.JourneyRequestRepositoryMemory.FindAll(ctx)
}

func (f *FakeJourneyRequestRepository) Delete(ctx context.Context, id value_object.ID) error {
	if f.DeleteFn != nil {
		return f.DeleteFn(ctx, id)
	}
	return f.JourneyRequestRepositoryMemory.Delete(ctx, id)
}

// FakeJourneyRepository は JourneyRepository のフェイク。
type FakeJourneyRepository struct {
	*memory.JourneyRepositoryMemory

	SaveFn            func(ctx context.Context, journey entity.Journey) error
	FindByIDFn        func(ctx context.Context, id value_object.ID) (entity.Journey, error)
	FindByRequestIDFn func(ctx context.Context, requestID value_object.ID) (entity.Journey, error)
	FindAllFn         func(ctx context.Context) ([]entity.Journey, error)
	DeleteFn          func(ctx context.Context, id value_object.ID) error
}

var _ repository.JourneyRepository = (*FakeJourneyRepository)(nil)

// NewJourneyRepository は空のフェイクを作る。
func NewJourneyRepository() *FakeJourneyRepository {
	return &FakeJourneyRepository{JourneyRepositoryMemory: memory.NewJourneyRepository()}
}

// NewJourneyRepositoryWith は journeys を保存済みのフェイクを作る。
func NewJourneyRepositoryWith(tb testingTB, journeys ...entity.Journey) *FakeJourneyRepository {
	tb.Helper()
	repo := NewJourneyRepository()
	for _, journey := range journeys {
		if err := repo.JourneyRepositoryMemory.Save(context.Background(), journey); err != nil {
			tb.Fatalf("seed journey: %v", err)
		}
	}
	return repo
}

func (f *FakeJourneyRepository) Save(ctx context.Context, journey entity.Journey) error {
	if f.SaveFn != nil {
		return f.SaveFn(ctx, journey)
	}
	return f.JourneyRepositoryMemory.Save(ctx, journey)
}

func (f *FakeJourneyRepository) FindByID(ctx context.Context, id value_object.ID) (entity.Journey, error) {
	if f.FindByIDFn != nil {
		return f.FindByIDFn(ctx, id)
	}
	return f.JourneyRepositoryMemory.FindByID(ctx, id)
}

func (f *FakeJourneyRepository) FindByRequestID(ctx context.Context, requestID value_object.ID) (entity.Journey, error) {
	if f.FindByRequestIDFn != nil {
		return f.FindByRequestIDFn(ctx, requestID)
	}
	return f.JourneyRepositoryMemory.FindByRequestID(ctx, requestID)
}

func (f *FakeJourneyRepository) FindAll(ctx context.Context) ([]entity.Journey, error) {
	if f.FindAllFn != nil {
		return f.FindAllFn(ctx)
	}
	return f.JourneyRepositoryMemory.FindAll(ctx)
}

func (f *FakeJourneyRepository) Delete(ctx context.Context, id value_object.ID) error {
	if f.DeleteFn != nil {
		return f.DeleteFn(ctx, id)
	}
	return f.JourneyRepositoryMemory.Delete(ctx, id)
}

// FakeJourneyImageRepository は JourneyImageRepository のフェイク。
type FakeJourneyImageRepository struct {
	*memory.JourneyImageRepositoryMemory

	SaveFn                  func(ctx context.Context, image entity.JourneyImage) error
	FindByIDFn              func(ctx context.Context, id value_object.ID) (entity.JourneyImage, error)
	FindByRequestIDFn       func(ctx context.Context, requestID value_object.ID) ([]entity.JourneyImage, error)
	FindBySlotFn            func(ctx context.Context, requestID value_object.ID, slot value_object.ImageSlot) (entity.JourneyImage, error)
	FindPendingFn           func(ctx context.Context, limit int) ([]entity.JourneyImage, error)
	FindExpiredProcessingFn func(ctx context.Context, now time.Time, limit int) ([]entity.JourneyImage, error)
	ClaimFn                 func(ctx context.Context, id value_object.ID, leaseUntil time.Time) (entity.JourneyImage, bool, error)
	DeleteFn                func(ctx context.Context, id value_object.ID) error
}

var _ repository.JourneyImageRepository = (*FakeJourneyImageRepository)(nil)

// NewJourneyImageRepository は空のフェイクを作る。
func NewJourneyImageRepository() *FakeJourneyImageRepository {
	return &FakeJourneyImageRepository{JourneyImageRepositoryMemory: memory.NewJourneyImageRepository()}
}

// NewJourneyImageRepositoryWith は images を保存済みのフェイクを作る。
func NewJourneyImageRepositoryWith(tb testingTB, images ...entity.JourneyImage) *FakeJourneyImageRepository {
	tb.Helper()
	repo := NewJourneyImageRepository()
	for _, image := range images {
		if err := repo.JourneyImageRepositoryMemory.Save(context.Background(), image); err != nil {
			tb.Fatalf("seed journey image: %v", err)
		}
	}
	return repo
}

func (f *FakeJourneyImageRepository) Save(ctx context.Context, image entity.JourneyImage) error {
	if f.SaveFn != nil {
		return f.SaveFn(ctx, image)
	}
	return f.JourneyImageRepositoryMemory.Save(ctx, image)
}

func (f *FakeJourneyImageRepository) FindByID(ctx context.Context, id value_object.ID) (entity.JourneyImage, error) {
	if f.FindByIDFn != nil {
		return f.FindByIDFn(ctx, id)
	}
	return f.JourneyImageRepositoryMemory.FindByID(ctx, id)
}

func (f *FakeJourneyImageRepository) FindByRequestID(ctx context.Context, requestID value_object.ID) ([]entity.JourneyImage, error) {
	if f.FindByRequestIDFn != nil {
		return f.FindByRequestIDFn(ctx, requestID)
	}
	return f.JourneyImageRepositoryMemory.FindByRequestID(ctx, requestID)
}

func (f *FakeJourneyImageRepository) FindBySlot(ctx context.Context, requestID value_object.ID, slot value_object.ImageSlot) (entity.JourneyImage, error) {
	if f.FindBySlotFn != nil {
		return f.FindBySlotFn(ctx, requestID, slot)
	}
	return f.JourneyImageRepositoryMemory.FindBySlot(ctx, requestID, slot)
}

func (f *FakeJourneyImageRepository) FindPending(ctx context.Context, limit int) ([]entity.JourneyImage, error) {
	if f.FindPendingFn != nil {
		return f.FindPendingFn(ctx, limit)
	}
	return f.JourneyImageRepositoryMemory.FindPending(ctx, limit)
}

func (f *FakeJourneyImageRepository) FindExpiredProcessing(ctx context.Context, now time.Time, limit int) ([]entity.JourneyImage, error) {
	if f.FindExpiredProcessingFn != nil {
		return f.FindExpiredProcessingFn(ctx, now, limit)
	}
	return f.JourneyImageRepositoryMemory.FindExpiredProcessing(ctx, now, limit)
}

func (f *FakeJourneyImageRepository) Claim(ctx context.Context, id value_object.ID, leaseUntil time.Time) (entity.JourneyImage, bool, error) {
	if f.ClaimFn != nil {
		return f.ClaimFn(ctx, id, leaseUntil)
	}
	return f.JourneyImageRepositoryMemory.Claim(ctx, id, leaseUntil)
}

func (f *FakeJourneyImageRepository) Delete(ctx context.Context, id value_object.ID) error {
	if f.DeleteFn != nil {
		return f.DeleteFn(ctx, id)
	}
	return f.JourneyImageRepositoryMemory.Delete(ctx, id)
}

// FakePublisher は発行されたイベントを記録する event.Publisher のフェイク。
type FakePublisher struct {
	Events []event.DomainEvent
	Err    error // 非 nil のとき Publish はこのエラーを返す
}

var _ event.Publisher = (*FakePublisher)(nil)

func (p *FakePublisher) Publish(_ context.Context, e event.DomainEvent) error {
	if p.Err != nil {
		return p.Err
	}
	p.Events = append(p.Events, e)
	return nil
}

// testingTB は testing.TB のうちフェイクの初期化に必要な部分。
type testingTB interface {
	Helper()
	Fatalf(format string, args ...any)
}
