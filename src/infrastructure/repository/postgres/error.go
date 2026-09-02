package postgres

import (
	"errors"
	"fmt"

	"cacao/src/domain/repository"
	"cacao/src/observability"

	"github.com/jackc/pgx/v5/pgconn"
)

// mapPostgresError は Postgres のドライバ固有エラーをドメインのリポジトリエラーに変換し、SQLSTATE を原因追跡のために保持する。
//
// ユースケース:
//   - 23505 unique_violation: repository.ErrDuplicateID に変換する
//   - その他: 元のエラーを保持する
func mapPostgresError(operation string, err error) error {
	if err == nil {
		return nil
	}

	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" {
		return observability.WithOperation(
			operation,
			fmt.Errorf("%w: %w", repository.ErrDuplicateID, err),
		)
	}

	return observability.WithOperation(operation, err)
}
