package postgres

import (
	"cacao/src/domain/entity"
	"cacao/src/domain/repository"
	"cacao/src/domain/value_object"
	"context"
	"errors"

	"gorm.io/gorm"
)

// JourneyRequestRepositoryPostgres は JourneyRequest 集約の Postgres 実装。
type JourneyRequestRepositoryPostgres struct {
	db *gorm.DB
}

// NewJourneyRequestRepository は新しい Postgres リポジトリを生成する。
func NewJourneyRequestRepository(db *gorm.DB) *JourneyRequestRepositoryPostgres {
	return &JourneyRequestRepositoryPostgres{db: db}
}

// Save は JourneyRequest 集約を保存する。新規作成と更新の両方を担当する。
func (r *JourneyRequestRepositoryPostgres) Save(ctx context.Context, jr entity.JourneyRequest) error {
	model, err := journeyRequestToModel(jr)
	if err != nil {
		return err
	}
	if err := r.db.WithContext(ctx).Save(&model).Error; err != nil {
		return mapPostgresError(err)
	}
	return nil
}

// FindByID はIDに該当する JourneyRequest を取得する。
// 該当しない場合は ErrJourneyRequestNotFound を返す。
func (r *JourneyRequestRepositoryPostgres) FindByID(ctx context.Context, id value_object.ID) (entity.JourneyRequest, error) {
	var m JourneyRequestModel
	err := r.db.WithContext(ctx).
		Where("id = ?", id.String()).
		First(&m).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return entity.JourneyRequest{}, repository.ErrJourneyRequestNotFound
	}
	if err != nil {
		return entity.JourneyRequest{}, err
	}
	return modelToJourneyRequest(m)
}

// FindAll は保存されている JourneyRequest 集約をすべて取得する。
// 件数が増えた場合は将来的にページネーションを導入することを検討する。
func (r *JourneyRequestRepositoryPostgres) FindAll(ctx context.Context) ([]entity.JourneyRequest, error) {
	var models []JourneyRequestModel
	if err := r.db.WithContext(ctx).Find(&models).Error; err != nil {
		return nil, err
	}

	result := make([]entity.JourneyRequest, 0, len(models))
	for _, m := range models {
		jr, err := modelToJourneyRequest(m)
		if err != nil {
			return nil, err
		}
		result = append(result, jr)
	}
	return result, nil
}

// Delete はIDに該当する JourneyRequest 集約を削除する。
// 該当しない場合は ErrJourneyRequestNotFound を返す。
func (r *JourneyRequestRepositoryPostgres) Delete(ctx context.Context, id value_object.ID) error {
	result := r.db.WithContext(ctx).
		Where("id = ?", id.String()).
		Delete(&JourneyRequestModel{})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return repository.ErrJourneyRequestNotFound
	}
	return nil
}
