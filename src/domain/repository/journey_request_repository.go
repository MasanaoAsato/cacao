package repository

import (
	"context"
	"errors"

	"cacao/src/domain/entity"
	"cacao/src/domain/value_object"
)

// ErrJourneyRequestNotFound は指定されたIDに該当する JourneyRequest が存在しないことを表す。
var ErrJourneyRequestNotFound = errors.New("journey request not found")

// JourneyRequestRepository は JourneyRequest 集約の永続化を抽象化するリポジトリインターフェース。
// 実装はインフラ層に置き、ドメイン層は永続化の詳細を知らない。
type JourneyRequestRepository interface {
	// Save は JourneyRequest 集約を保存する。新規作成と更新の両方を担当する。
	Save(ctx context.Context, journeyRequest entity.JourneyRequest) error

	// FindByID はIDに該当する JourneyRequest を取得する。
	// 該当しない場合は ErrJourneyRequestNotFound を返す。
	FindByID(ctx context.Context, id value_object.ID) (entity.JourneyRequest, error)

	// FindAll は保存されている JourneyRequest 集約をすべて取得する。
	// 将来的に件数が増えた場合はページネーションを導入することを検討する。
	FindAll(ctx context.Context) ([]entity.JourneyRequest, error)

	// Delete はIDに該当する JourneyRequest 集約を削除する。
	// 該当しない場合は ErrJourneyRequestNotFound を返す。
	Delete(ctx context.Context, id value_object.ID) error
}
