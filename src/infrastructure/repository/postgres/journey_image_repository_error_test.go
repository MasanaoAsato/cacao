package postgres

import (
	"errors"
	"testing"

	"cacao/src/domain/repository"

	"github.com/jackc/pgx/v5/pgconn"
)

func TestMapJourneyImageRepositoryError(t *testing.T) {
	t.Run("正常系: slot 一意制約違反をドメインエラーへ変換する", func(t *testing.T) {
		err := mapJourneyImageRepositoryError("save_journey_image", &pgconn.PgError{
			Code:           "23505",
			ConstraintName: journeyImageSlotUniqueConstraint,
		})
		if !errors.Is(err, repository.ErrJourneyImageSlotAlreadyExists) {
			t.Errorf(
				"mapJourneyImageRepositoryError() = %v, want ErrJourneyImageSlotAlreadyExists",
				err,
			)
		}
		var pgErr *pgconn.PgError
		if !errors.As(err, &pgErr) || pgErr.Code != "23505" {
			t.Errorf("mapJourneyImageRepositoryError() must preserve SQLSTATE 23505: %v", err)
		}
	})

	t.Run("異常系: 別の一意制約違反は変換しない", func(t *testing.T) {
		original := &pgconn.PgError{
			Code:           "23505",
			ConstraintName: "journey_images_pkey",
		}
		err := mapJourneyImageRepositoryError("save_journey_image", original)
		if !errors.Is(err, original) {
			t.Errorf("mapJourneyImageRepositoryError() = %v, want original error", err)
		}
	})
}
