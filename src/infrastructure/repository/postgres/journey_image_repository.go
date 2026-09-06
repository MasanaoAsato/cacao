package postgres

import (
	"context"
	"errors"
	"fmt"
	"time"

	"cacao/src/domain/entity"
	"cacao/src/domain/repository"
	"cacao/src/domain/value_object"
	"cacao/src/observability"

	"github.com/jackc/pgx/v5/pgconn"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const journeyImageSlotUniqueConstraint = "journey_images_request_purpose_ordinal_key"

// JourneyImageRepositoryPostgres は JourneyImage 集約の PostgreSQL 実装である。
type JourneyImageRepositoryPostgres struct {
	db  *gorm.DB
	now func() time.Time
}

var _ repository.JourneyImageRepository = (*JourneyImageRepositoryPostgres)(nil)

// NewJourneyImageRepository は新しい PostgreSQL リポジトリを生成する。
func NewJourneyImageRepository(db *gorm.DB) *JourneyImageRepositoryPostgres {
	return &JourneyImageRepositoryPostgres{
		db:  db,
		now: time.Now,
	}
}

// Save は JourneyImage を新規作成または更新する。
func (r *JourneyImageRepositoryPostgres) Save(
	ctx context.Context,
	image entity.JourneyImage,
) error {
	model, err := journeyImageToModel(image)
	if err != nil {
		return err
	}

	err = r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var existing JourneyImageModel
		err := tx.Select("id", "lease_until", "completed_at").
			Where("id = ?", model.ID).
			First(&existing).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			if err := r.prepareJourneyImageModelForSave(&model, nil); err != nil {
				return err
			}
			return tx.Create(&model).Error
		}
		if err != nil {
			return fmt.Errorf("find existing journey image: %w", err)
		}

		if err := r.prepareJourneyImageModelForSave(&model, &existing); err != nil {
			return err
		}
		result := tx.Model(&JourneyImageModel{}).
			Where("id = ?", model.ID).
			Updates(journeyImageUpdateValues(model, r.now().UTC()))
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return repository.ErrJourneyImageNotFound
		}
		return nil
	})
	if err != nil {
		return mapJourneyImageRepositoryError("save_journey_image", err)
	}
	return nil
}

// FindByID はIDに該当する JourneyImage を取得する。
func (r *JourneyImageRepositoryPostgres) FindByID(
	ctx context.Context,
	id value_object.ID,
) (entity.JourneyImage, error) {
	var model JourneyImageModel
	err := r.db.WithContext(ctx).Where("id = ?", id.String()).First(&model).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return entity.JourneyImage{}, repository.ErrJourneyImageNotFound
	}
	if err != nil {
		return entity.JourneyImage{}, mapJourneyImageRepositoryError("find_journey_image", err)
	}
	return modelToJourneyImage(model)
}

// FindByRequestID は旅程リクエストに属する画像を slot 順で取得する。
func (r *JourneyImageRepositoryPostgres) FindByRequestID(
	ctx context.Context,
	requestID value_object.ID,
) ([]entity.JourneyImage, error) {
	var models []JourneyImageModel
	err := r.db.WithContext(ctx).
		Where("journey_request_id = ?", requestID.String()).
		Order("CASE purpose WHEN 'cover' THEN 0 ELSE 1 END").
		Order("ordinal ASC").
		Find(&models).Error
	if err != nil {
		return nil, mapJourneyImageRepositoryError("list_journey_images", err)
	}
	return journeyImageModelsToEntities(models)
}

// FindBySlot は旅程リクエストと画像slotの組で画像を取得する。
func (r *JourneyImageRepositoryPostgres) FindBySlot(
	ctx context.Context,
	requestID value_object.ID,
	slot value_object.ImageSlot,
) (entity.JourneyImage, error) {
	var model JourneyImageModel
	err := r.db.WithContext(ctx).
		Where(
			"journey_request_id = ? AND purpose = ? AND ordinal = ?",
			requestID.String(),
			slot.Purpose().String(),
			slot.Ordinal(),
		).
		First(&model).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return entity.JourneyImage{}, repository.ErrJourneyImageNotFound
	}
	if err != nil {
		return entity.JourneyImage{}, mapJourneyImageRepositoryError("find_journey_image_slot", err)
	}
	return modelToJourneyImage(model)
}

// FindPending は作成日時順に pending 状態の画像を取得する。
func (r *JourneyImageRepositoryPostgres) FindPending(
	ctx context.Context,
	limit int,
) ([]entity.JourneyImage, error) {
	if limit < 1 {
		return nil, fmt.Errorf("pending image limit must be positive")
	}

	var models []JourneyImageModel
	err := r.db.WithContext(ctx).
		Where("status = ?", value_object.ImageStatusPending.String()).
		Order("created_at ASC").
		Order("id ASC").
		Limit(limit).
		Find(&models).Error
	if err != nil {
		return nil, mapJourneyImageRepositoryError("find_pending_journey_images", err)
	}
	return journeyImageModelsToEntities(models)
}

// FindExpiredProcessing はリース期限切れの processing 状態の画像を取得する。
func (r *JourneyImageRepositoryPostgres) FindExpiredProcessing(
	ctx context.Context,
	now time.Time,
	limit int,
) ([]entity.JourneyImage, error) {
	if limit < 1 {
		return nil, fmt.Errorf("expired processing image limit must be positive")
	}

	var models []JourneyImageModel
	err := r.db.WithContext(ctx).
		Where(
			"status = ? AND lease_until < ?",
			value_object.ImageStatusProcessing.String(),
			now.UTC(),
		).
		Order("lease_until ASC").
		Order("id ASC").
		Limit(limit).
		Find(&models).Error
	if err != nil {
		return nil, mapJourneyImageRepositoryError("find_expired_journey_images", err)
	}
	return journeyImageModelsToEntities(models)
}

// Claim は pending 状態の画像だけを、リース付きの processing 状態へ原子的に変更する。
func (r *JourneyImageRepositoryPostgres) Claim(
	ctx context.Context,
	id value_object.ID,
	leaseUntil time.Time,
) (entity.JourneyImage, bool, error) {
	if leaseUntil.IsZero() {
		return entity.JourneyImage{}, false, fmt.Errorf("journey image lease until must not be zero")
	}

	var claimedImage entity.JourneyImage
	claimed := false
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var model JourneyImageModel
		err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("id = ?", id.String()).
			First(&model).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return repository.ErrJourneyImageNotFound
		}
		if err != nil {
			return fmt.Errorf("lock journey image: %w", err)
		}

		image, err := modelToJourneyImage(model)
		if err != nil {
			return err
		}
		claimedImage = image
		if err := image.Start(); err != nil {
			return nil
		}

		updatedModel, err := journeyImageToModel(image)
		if err != nil {
			return err
		}
		updatedModel.LeaseUntil = pointer(leaseUntil.UTC())
		result := tx.Model(&JourneyImageModel{}).
			Where("id = ?", updatedModel.ID).
			Updates(journeyImageUpdateValues(updatedModel, r.now().UTC()))
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return repository.ErrJourneyImageNotFound
		}

		claimedImage = image
		claimed = true
		return nil
	})
	if err != nil {
		return entity.JourneyImage{}, false, mapJourneyImageRepositoryError("claim_journey_image", err)
	}
	return claimedImage, claimed, nil
}

// Delete は画像メタデータだけを削除する。画像バイナリの削除は storage の責務である。
func (r *JourneyImageRepositoryPostgres) Delete(
	ctx context.Context,
	id value_object.ID,
) error {
	result := r.db.WithContext(ctx).Where("id = ?", id.String()).Delete(&JourneyImageModel{})
	if result.Error != nil {
		return mapJourneyImageRepositoryError("delete_journey_image", result.Error)
	}
	return nil
}

func (r *JourneyImageRepositoryPostgres) prepareJourneyImageModelForSave(
	model *JourneyImageModel,
	existing *JourneyImageModel,
) error {
	if model.Status == value_object.ImageStatusProcessing.String() {
		if existing == nil || existing.LeaseUntil == nil {
			return fmt.Errorf("processing journey image must be claimed before save")
		}
		leaseUntil := existing.LeaseUntil.UTC()
		model.LeaseUntil = &leaseUntil
	} else {
		model.LeaseUntil = nil
	}

	if model.Status == value_object.ImageStatusReady.String() {
		if existing != nil && existing.CompletedAt != nil {
			completedAt := existing.CompletedAt.UTC()
			model.CompletedAt = &completedAt
			return nil
		}
		completedAt := r.now().UTC()
		model.CompletedAt = &completedAt
		return nil
	}

	model.CompletedAt = nil
	return nil
}

func journeyImageUpdateValues(
	model JourneyImageModel,
	updatedAt time.Time,
) map[string]any {
	return map[string]any{
		"journey_request_id": model.JourneyRequestID,
		"purpose":            model.Purpose,
		"ordinal":            model.Ordinal,
		"status":             model.Status,
		"storage_key":        model.StorageKey,
		"media_type":         model.MediaType,
		"width":              model.Width,
		"height":             model.Height,
		"visual_style":       model.VisualStyle,
		"failure_code":       model.FailureCode,
		"attempt_count":      model.AttemptCount,
		"lease_until":        model.LeaseUntil,
		"completed_at":       model.CompletedAt,
		"updated_at":         updatedAt,
	}
}

func journeyImageModelsToEntities(
	models []JourneyImageModel,
) ([]entity.JourneyImage, error) {
	images := make([]entity.JourneyImage, 0, len(models))
	for _, model := range models {
		image, err := modelToJourneyImage(model)
		if err != nil {
			return nil, err
		}
		images = append(images, image)
	}
	return images, nil
}

func mapJourneyImageRepositoryError(operation string, err error) error {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" &&
		pgErr.ConstraintName == journeyImageSlotUniqueConstraint {
		return observability.WithOperation(
			operation,
			fmt.Errorf("%w: %w", repository.ErrJourneyImageSlotAlreadyExists, err),
		)
	}
	return observability.WithOperation(operation, err)
}
