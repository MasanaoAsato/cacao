package postgres

import (
	"errors"
	"fmt"

	"cacao/src/application"
	"cacao/src/infrastructure/observability"

	"github.com/jackc/pgx/v5/pgconn"
)

// mapPostgresError は Postgres のドライバ固有エラーをアプリケーション層の
// ポータブルなエラーに変換し、SQLSTATE を原因追跡のために保持する。
//
// ユースケース:
//   - 23505 unique_violation: application.ErrDuplicateID に変換する
//   - その他: 元のエラーを保持する
func mapPostgresError(operation string, err error) error {
	if err == nil {
		return nil
	}

	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" {
		return observability.WithOperation(
			operation,
			fmt.Errorf("%w: %w", application.ErrDuplicateID, err),
		)
	}

	return observability.WithOperation(operation, err)
}
