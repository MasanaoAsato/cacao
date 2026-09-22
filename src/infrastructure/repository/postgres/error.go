package postgres

import (
	"errors"

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

	cause := error(err)
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" {
		cause = errors.Join(repository.ErrDuplicateID, err)
	}

	return observability.WithOperation(operation, &safePostgresError{cause: cause})
}

// safePostgresError は PostgreSQL の詳細をログ文字列から隠しつつ、
// errors.Is と errors.As のために元の原因を保持する。
type safePostgresError struct {
	cause error
}

func (e *safePostgresError) Error() string {
	return "postgres operation failed"
}

func (e *safePostgresError) Unwrap() error {
	return e.cause
}

func (e *safePostgresError) SafeLogMessage() string {
	return e.Error()
}
