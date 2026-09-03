package postgres

import (
	"errors"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"

	"cacao/src/domain/repository"
	"cacao/src/observability"
)

func TestMapPostgresError(t *testing.T) {
	tests := []struct {
		name          string
		operation     string
		err           error
		wantDuplicate bool
		wantSQLState  string
	}{
		{
			name:      "正常系: 一意制約違反の分類と原因を保持する",
			operation: "save_journey",
			err: &pgconn.PgError{
				Code:   "23505",
				Detail: "Key (journey_id)=(private-itinerary) already exists",
			},
			wantDuplicate: true,
			wantSQLState:  "23505",
		},
		{
			name:      "異常系: 別の SQLSTATE は元エラーを保持する",
			operation: "save_journey",
			err: &pgconn.PgError{
				Code: "23514",
			},
			wantSQLState: "23514",
		},
		{
			name:      "境界値系: nil は nil のまま返す",
			operation: "save_journey",
		},
	}

	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			got := mapPostgresError(testCase.operation, testCase.err)

			if testCase.err == nil {
				if got != nil {
					t.Errorf("mapPostgresError() = %v, want nil", got)
				}
				return
			}
			if errors.Is(got, repository.ErrDuplicateID) != testCase.wantDuplicate {
				t.Errorf("duplicate classification = %t, want %t", errors.Is(got, repository.ErrDuplicateID), testCase.wantDuplicate)
			}
			if gotSQLState := observability.PostgresSQLState(got); gotSQLState != testCase.wantSQLState {
				t.Errorf("PostgresSQLState() = %q, want %q", gotSQLState, testCase.wantSQLState)
			}
			if gotOperation := observability.SourceOperation(got); gotOperation != testCase.operation {
				t.Errorf("SourceOperation() = %q, want %q", gotOperation, testCase.operation)
			}
		})
	}
}
