package postgres

import (
	"errors"

	"cacao/src/application"

	"github.com/jackc/pgconn"
)

// mapPostgresError は Postgres のドライバ固有エラーをアプリケーション層の
// ポータブルなエラーに変換する。
//
// ユースケース:
//   - 23505 unique_violation: 重複した主キー・一意制約違反を application.ErrDuplicateID に変換
//   - その他: 元のエラーをそのまま返す（生の Postgres エラーが露出するのを防ぐため、
//     将来ここでラップを増やす余地を残す）
func mapPostgresError(err error) error {
	if err == nil {
		return nil
	}

	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		if pgErr.Code == "23505" {
			return application.ErrDuplicateID
		}
	}

	return err
}
