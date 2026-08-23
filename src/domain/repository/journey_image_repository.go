package repository

import (
	"context"
	"errors"
	"time"

	"cacao/src/domain/entity"
	"cacao/src/domain/value_object"
)

var (
	// ErrJourneyImageNotFound は指定された画像が存在しないことを表す。
	ErrJourneyImageNotFound = errors.New("journey image not found")
	// ErrJourneyImageSlotAlreadyExists は同一リクエスト内に同じslotがあることを表す。
	ErrJourneyImageSlotAlreadyExists = errors.New("journey image slot already exists")
)

// JourneyImageRepository はJourneyImage集約の永続化を抽象化するportである。
type JourneyImageRepository interface {
	// Save は集約のメタデータを保存する。新規作成と更新の両方を担当する。
	Save(ctx context.Context, image entity.JourneyImage) error

	// FindByID は画像IDで1件取得する。
	FindByID(ctx context.Context, id value_object.ID) (entity.JourneyImage, error)

	// FindByRequestID はrequestIDに属する画像をslot順で取得する。
	FindByRequestID(ctx context.Context, requestID value_object.ID) ([]entity.JourneyImage, error)

	// FindBySlot はrequestIDとslotの組で1件取得する。
	FindBySlot(
		ctx context.Context,
		requestID value_object.ID,
		slot value_object.ImageSlot,
	) (entity.JourneyImage, error)

	// FindPending はworkerがclaimするpending画像を取得する。
	FindPending(ctx context.Context, limit int) ([]entity.JourneyImage, error)

	// FindExpiredProcessing はlease期限切れのprocessing画像を取得する。
	FindExpiredProcessing(
		ctx context.Context,
		now time.Time,
		limit int,
	) ([]entity.JourneyImage, error)

	// Claim はpending画像1件を原子的にprocessingへ遷移させる。
	Claim(
		ctx context.Context,
		id value_object.ID,
		leaseUntil time.Time,
	) (entity.JourneyImage, bool, error)

	// Delete は画像メタデータを削除する。画像バイナリの削除は行わない。
	Delete(ctx context.Context, id value_object.ID) error
}
