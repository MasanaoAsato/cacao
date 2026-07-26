package postgres

import (
	"cacao/src/domain/entity"
	"cacao/src/domain/repository"
	"cacao/src/domain/value_object"
	"context"
	"errors"

	"gorm.io/gorm"
)

type JourneyRepositoryPostgres struct {
	db *gorm.DB
}

func NewJourneyRepository(db *gorm.DB) *JourneyRepositoryPostgres {
	return &JourneyRepositoryPostgres{db: db}
}

func (r *JourneyRepositoryPostgres) Save(ctx context.Context, j entity.Journey) error {
	model, err := journeyToModel(j)
	if err != nil {
		return err
	}

	if err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// 1. 親の journeys 行を先に upsert する。
		// GORM の Save は子要素を先に INSERT しようとするため、
		// 外部キー制約 (fk_itinerary_days_journey) 違反になる。
		// 親行を先に確実に保存してから子要素を扱う。
		if err := tx.Save(&JourneyModel{
			ID:               model.ID,
			JourneyRequestID: model.JourneyRequestID,
		}).Error; err != nil {
			return err
		}

		// 2. 集約内の子要素は「削除→再挿入」で差分を扱う（ハイブリッド方針）。
		//   - モデルが gorm.DeletedAt を持つと soft delete に暗黙切替される。
		//     本モデルは持たないため物理削除されるが、将来導入時に要注意。
		//   - テーブル名は ItineraryDayModel.TableName() が返す "journey.itinerary_days"
		//     が使われる。スキーマ修飾は型側に任せる。
		if err := tx.Where(
			"journey_id = ?", model.ID,
		).Delete(&ItineraryDayModel{}).Error; err != nil {
			return err
		}

		// 3. 子要素（itinerary_days）を保存する。
		for _, dm := range model.Days {
			dayModel := ItineraryDayModel{
				ID:        dm.ID,
				JourneyID: dm.JourneyID,
				Date:      dm.Date,
			}
			if err := tx.Save(&dayModel).Error; err != nil {
				return err
			}

			// 4. さらに孫要素（spots）を保存する。
			for _, sm := range dm.Spots {
				if err := tx.Save(&sm).Error; err != nil {
					return err
				}
			}
		}
		return nil
	}); err != nil {
		return mapPostgresError(err)
	}
	return nil
}

func (r *JourneyRepositoryPostgres) FindByID(ctx context.Context, id value_object.ID) (entity.Journey, error) {
	var m JourneyModel
	err := r.db.WithContext(ctx).
		Preload("Days").Preload("Days.Spots").
		Where("id = ?", id.String()).
		First(&m).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return entity.Journey{}, repository.ErrJourneyNotFound
	}
	if err != nil {
		return entity.Journey{}, err
	}
	return modelToJourney(m)
}

func (r *JourneyRepositoryPostgres) FindByRequestID(ctx context.Context, requestID value_object.ID) (entity.Journey, error) {
	var m JourneyModel
	err := r.db.WithContext(ctx).
		Preload("Days").Preload("Days.Spots").
		Where("journey_request_id = ?", requestID.String()).
		First(&m).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return entity.Journey{}, repository.ErrJourneyNotFound
	}
	if err != nil {
		return entity.Journey{}, err
	}
	return modelToJourney(m)
}

// FindAll は保存されている Journey 集約をすべて取得する。
// 件数が増えた場合は将来的にページネーションを導入することを検討する。
func (r *JourneyRepositoryPostgres) FindAll(ctx context.Context) ([]entity.Journey, error) {
	var models []JourneyModel
	err := r.db.WithContext(ctx).
		Preload("Days").Preload("Days.Spots").
		Find(&models).Error
	if err != nil {
		return nil, err
	}

	result := make([]entity.Journey, 0, len(models))
	for _, m := range models {
		j, err := modelToJourney(m)
		if err != nil {
			return nil, err
		}
		result = append(result, j)
	}
	return result, nil
}

// Delete はIDに該当する Journey 集約を削除する。
// 集約内の子要素（ItineraryDay / Spot）は DB の外部キー制約
// (OnDelete:CASCADE) により自動的に削除されるため、
// 親の journeys 行を削除するだけで集約全体が消える。
// 該当しない場合は ErrJourneyNotFound を返す。
func (r *JourneyRepositoryPostgres) Delete(ctx context.Context, id value_object.ID) error {
	result := r.db.WithContext(ctx).
		Where("id = ?", id.String()).
		Delete(&JourneyModel{})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return repository.ErrJourneyNotFound
	}
	return nil
}
