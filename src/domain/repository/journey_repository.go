package repository

import (
	"context"
	"errors"

	"cacao/src/domain/entity"
	"cacao/src/domain/value_object"
)

// ErrJourneyNotFound は指定されたIDに該当する Journey が存在しないことを表す。
var ErrJourneyNotFound = errors.New("journey not found")

// JourneyRepository は Journey 集約の永続化を抽象化するリポジトリインターフェース。
// 実装はインフラ層に置き、ドメイン層は永続化の詳細を知らない。
type JourneyRepository interface {
	// Save は Journey 集約を保存する。新規作成と更新の両方を担当する。
	// 集約内エンティティ（ItineraryDay / Spot）も一貫して保存する責務を持つ。
	Save(ctx context.Context, journey entity.Journey) error

	// FindByID はIDに該当する Journey 集約を取得する。
	// 該当しない場合は ErrJourneyNotFound を返す。
	FindByID(ctx context.Context, id value_object.ID) (entity.Journey, error)

	// FindByRequestID は Journey 集約が内部に保持する requestID を使って
	// 該当する Journey 集約を取得する。別集約をまたぐ検索ではなく、
	// 自分の集約ルートが持つ外部参照を用いた検索であることに注意。
	FindByRequestID(ctx context.Context, requestID value_object.ID) (entity.Journey, error)

	// FindAll は保存されている Journey 集約をすべて取得する。
	// 将来的に件数が増えた場合はページネーションを導入することを検討する。
	FindAll(ctx context.Context) ([]entity.Journey, error)

	// Delete はIDに該当する Journey 集約を削除する。
	// 該当しない場合は ErrJourneyNotFound を返す。
	Delete(ctx context.Context, id value_object.ID) error
}
