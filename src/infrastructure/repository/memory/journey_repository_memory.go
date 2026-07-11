package memory

import (
	"context"
	"sync"

	"cacao/src/domain/entity"
	"cacao/src/domain/repository"
	"cacao/src/domain/value_object"
)

// JourneyRepositoryMemory は JourneyRepository のインメモリ実装。
// 開発・結合テスト・main.go 起動検証で使用する。
type JourneyRepositoryMemory struct {
	mu   sync.RWMutex
	data map[value_object.ID]entity.Journey
}

// NewJourneyRepository は空の JourneyRepositoryMemory を生成する。
func NewJourneyRepository() *JourneyRepositoryMemory {
	return &JourneyRepositoryMemory{
		data: make(map[value_object.ID]entity.Journey),
	}
}

// Save は Journey 集約を保存する。新規作成と更新の両方を担当する。
func (r *JourneyRepositoryMemory) Save(_ context.Context, journey entity.Journey) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.data[journey.ID()] = journey
	return nil
}

// FindByID はIDに該当する Journey を取得する。
// 該当しない場合は repository.ErrJourneyNotFound を返す。
func (r *JourneyRepositoryMemory) FindByID(_ context.Context, id value_object.ID) (entity.Journey, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	journey, ok := r.data[id]
	if !ok {
		return entity.Journey{}, repository.ErrJourneyNotFound
	}
	return journey, nil
}

// FindByRequestID は Journey 集約が内部に保持する requestID を使って該当する Journey を取得する。
// 該当しない場合は repository.ErrJourneyNotFound を返す。
func (r *JourneyRepositoryMemory) FindByRequestID(_ context.Context, requestID value_object.ID) (entity.Journey, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	for _, journey := range r.data {
		if journey.RequestID().Equals(requestID) {
			return journey, nil
		}
	}
	return entity.Journey{}, repository.ErrJourneyNotFound
}

// FindAll は保存されている Journey 集約をすべて取得する。
func (r *JourneyRepositoryMemory) FindAll(_ context.Context) ([]entity.Journey, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	result := make([]entity.Journey, 0, len(r.data))
	for _, journey := range r.data {
		result = append(result, journey)
	}
	return result, nil
}

// Delete はIDに該当する Journey 集約を削除する。
// 該当しない場合は repository.ErrJourneyNotFound を返す。
func (r *JourneyRepositoryMemory) Delete(_ context.Context, id value_object.ID) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, ok := r.data[id]; !ok {
		return repository.ErrJourneyNotFound
	}
	delete(r.data, id)
	return nil
}
