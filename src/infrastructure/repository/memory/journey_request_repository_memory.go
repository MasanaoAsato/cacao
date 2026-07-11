package memory

import (
	"context"
	"sync"

	"cacao/src/domain/entity"
	"cacao/src/domain/repository"
	"cacao/src/domain/value_object"
)

// JourneyRequestRepositoryMemory は JourneyRequestRepository のインメモリ実装。
// 開発・結合テスト・main.go 起動検証で使用する。
type JourneyRequestRepositoryMemory struct {
	mu   sync.RWMutex
	data map[value_object.ID]entity.JourneyRequest
}

// NewJourneyRequestRepository は空の JourneyRequestRepositoryMemory を生成する。
func NewJourneyRequestRepository() *JourneyRequestRepositoryMemory {
	return &JourneyRequestRepositoryMemory{
		data: make(map[value_object.ID]entity.JourneyRequest),
	}
}

// Save は JourneyRequest 集約を保存する。新規作成と更新の両方を担当する。
func (r *JourneyRequestRepositoryMemory) Save(_ context.Context, req entity.JourneyRequest) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.data[req.ID()] = req
	return nil
}

// FindByID はIDに該当する JourneyRequest を取得する。
// 該当しない場合は repository.ErrJourneyRequestNotFound を返す。
func (r *JourneyRequestRepositoryMemory) FindByID(_ context.Context, id value_object.ID) (entity.JourneyRequest, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	req, ok := r.data[id]
	if !ok {
		return entity.JourneyRequest{}, repository.ErrJourneyRequestNotFound
	}
	return req, nil
}

// FindAll は保存されている JourneyRequest 集約をすべて取得する。
func (r *JourneyRequestRepositoryMemory) FindAll(_ context.Context) ([]entity.JourneyRequest, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	result := make([]entity.JourneyRequest, 0, len(r.data))
	for _, req := range r.data {
		result = append(result, req)
	}
	return result, nil
}

// Delete はIDに該当する JourneyRequest 集約を削除する。
// 該当しない場合は repository.ErrJourneyRequestNotFound を返す。
func (r *JourneyRequestRepositoryMemory) Delete(_ context.Context, id value_object.ID) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, ok := r.data[id]; !ok {
		return repository.ErrJourneyRequestNotFound
	}
	delete(r.data, id)
	return nil
}
