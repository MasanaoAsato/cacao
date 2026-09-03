package memory

import (
	"context"
	"fmt"
	"sort"
	"sync"
	"time"

	"cacao/src/domain/entity"
	"cacao/src/domain/repository"
	"cacao/src/domain/value_object"
)

// JourneyImageRepositoryMemory は JourneyImageRepository のインメモリ実装。
// Postgres 実装と同じ契約（slot の一意性、claim による lease、pending の作成順取得）を
// 満たすことを目的とし、ユースケースとワーカーの単体テストで使用する。
type JourneyImageRepositoryMemory struct {
	mu      sync.RWMutex
	records map[value_object.ID]*journeyImageRecord
	nextSeq uint64
}

type journeyImageRecord struct {
	image      entity.JourneyImage
	seq        uint64     // 作成順（FindPending の並び順）
	leaseUntil *time.Time // processing 中のみ非 nil
}

var _ repository.JourneyImageRepository = (*JourneyImageRepositoryMemory)(nil)

// NewJourneyImageRepository は空の JourneyImageRepositoryMemory を生成する。
func NewJourneyImageRepository() *JourneyImageRepositoryMemory {
	return &JourneyImageRepositoryMemory{
		records: make(map[value_object.ID]*journeyImageRecord),
	}
}

// Save は画像集約を保存する。新規作成時は同一 request 内の slot 重複を拒否する。
// processing 以外の状態で保存された場合は lease を解除する。
func (r *JourneyImageRepositoryMemory) Save(_ context.Context, image entity.JourneyImage) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	record, exists := r.records[image.ID()]
	if !exists {
		for _, other := range r.records {
			if other.image.RequestID().Equals(image.RequestID()) && other.image.Slot() == image.Slot() {
				return fmt.Errorf(
					"%w: request %s slot %s/%d",
					repository.ErrJourneyImageSlotAlreadyExists,
					image.RequestID(),
					image.Slot().Purpose(),
					image.Slot().Ordinal(),
				)
			}
		}
		r.nextSeq++
		record = &journeyImageRecord{seq: r.nextSeq}
		r.records[image.ID()] = record
	}

	record.image = image
	if image.Status() != value_object.ImageStatusProcessing {
		record.leaseUntil = nil
	}
	return nil
}

// FindByID は画像IDで1件取得する。該当しない場合は ErrJourneyImageNotFound を返す。
func (r *JourneyImageRepositoryMemory) FindByID(_ context.Context, id value_object.ID) (entity.JourneyImage, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	record, ok := r.records[id]
	if !ok {
		return entity.JourneyImage{}, repository.ErrJourneyImageNotFound
	}
	return record.image, nil
}

// FindByRequestID は requestID に属する画像を slot 順で返す。
func (r *JourneyImageRepositoryMemory) FindByRequestID(
	_ context.Context,
	requestID value_object.ID,
) ([]entity.JourneyImage, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	images := make([]entity.JourneyImage, 0)
	for _, record := range r.records {
		if record.image.RequestID().Equals(requestID) {
			images = append(images, record.image)
		}
	}
	sort.Slice(images, func(i, j int) bool {
		return images[i].Slot().Less(images[j].Slot())
	})
	return images, nil
}

// FindBySlot は requestID と slot の組で1件取得する。
func (r *JourneyImageRepositoryMemory) FindBySlot(
	_ context.Context,
	requestID value_object.ID,
	slot value_object.ImageSlot,
) (entity.JourneyImage, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	for _, record := range r.records {
		if record.image.RequestID().Equals(requestID) && record.image.Slot() == slot {
			return record.image, nil
		}
	}
	return entity.JourneyImage{}, repository.ErrJourneyImageNotFound
}

// FindPending は pending 状態の画像を作成順に最大 limit 件返す。
func (r *JourneyImageRepositoryMemory) FindPending(_ context.Context, limit int) ([]entity.JourneyImage, error) {
	if limit < 1 {
		return nil, fmt.Errorf("pending image limit must be positive")
	}

	r.mu.RLock()
	defer r.mu.RUnlock()

	records := r.recordsWithStatus(value_object.ImageStatusPending)
	sort.Slice(records, func(i, j int) bool { return records[i].seq < records[j].seq })
	return imagesOf(records, limit), nil
}

// FindExpiredProcessing は lease が now より前に切れた processing 画像を lease 順に返す。
func (r *JourneyImageRepositoryMemory) FindExpiredProcessing(
	_ context.Context,
	now time.Time,
	limit int,
) ([]entity.JourneyImage, error) {
	if limit < 1 {
		return nil, fmt.Errorf("expired processing image limit must be positive")
	}

	r.mu.RLock()
	defer r.mu.RUnlock()

	expired := make([]*journeyImageRecord, 0)
	for _, record := range r.recordsWithStatus(value_object.ImageStatusProcessing) {
		if record.leaseUntil != nil && record.leaseUntil.Before(now) {
			expired = append(expired, record)
		}
	}
	sort.Slice(expired, func(i, j int) bool {
		if expired[i].leaseUntil.Equal(*expired[j].leaseUntil) {
			return expired[i].seq < expired[j].seq
		}
		return expired[i].leaseUntil.Before(*expired[j].leaseUntil)
	})
	return imagesOf(expired, limit), nil
}

// Claim は pending 画像だけを lease 付きで processing へ遷移させる。
// pending でない場合は現在の画像と claimed=false を返す。
func (r *JourneyImageRepositoryMemory) Claim(
	_ context.Context,
	id value_object.ID,
	leaseUntil time.Time,
) (entity.JourneyImage, bool, error) {
	if leaseUntil.IsZero() {
		return entity.JourneyImage{}, false, fmt.Errorf("journey image lease until must not be zero")
	}

	r.mu.Lock()
	defer r.mu.Unlock()

	record, ok := r.records[id]
	if !ok {
		return entity.JourneyImage{}, false, repository.ErrJourneyImageNotFound
	}

	image := record.image
	if err := image.Start(); err != nil {
		return record.image, false, nil
	}

	lease := leaseUntil.UTC()
	record.image = image
	record.leaseUntil = &lease
	return image, true, nil
}

// Delete は画像メタデータを削除する。該当しない場合は ErrJourneyImageNotFound を返す。
func (r *JourneyImageRepositoryMemory) Delete(_ context.Context, id value_object.ID) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if _, ok := r.records[id]; !ok {
		return repository.ErrJourneyImageNotFound
	}
	delete(r.records, id)
	return nil
}

// LeaseUntil は processing 中の画像の lease 期限を返す。テストでの検証用。
func (r *JourneyImageRepositoryMemory) LeaseUntil(id value_object.ID) (time.Time, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	record, ok := r.records[id]
	if !ok || record.leaseUntil == nil {
		return time.Time{}, false
	}
	return *record.leaseUntil, true
}

func (r *JourneyImageRepositoryMemory) recordsWithStatus(status value_object.ImageStatus) []*journeyImageRecord {
	records := make([]*journeyImageRecord, 0)
	for _, record := range r.records {
		if record.image.Status() == status {
			records = append(records, record)
		}
	}
	return records
}

func imagesOf(records []*journeyImageRecord, limit int) []entity.JourneyImage {
	if len(records) > limit {
		records = records[:limit]
	}
	images := make([]entity.JourneyImage, 0, len(records))
	for _, record := range records {
		images = append(images, record.image)
	}
	return images
}
