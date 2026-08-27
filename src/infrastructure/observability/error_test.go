package observability

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"testing"

	"github.com/OpenRouterTeam/go-sdk/models/sdkerrors"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"

	"cacao/src/application"
)

func TestLogFailure(t *testing.T) {
	const secret = "api_key=secret-value prompt=private-itinerary"

	tests := []struct {
		name             string
		err              error
		failureContext   FailureContext
		wantLogFragments []string
		forbidden        []string
	}{
		{
			name: "正常系: 既知の生成タイムアウトを分類する",
			err: fmt.Errorf(
				"generate journey: %w: %w",
				application.ErrGenerationFailed,
				context.DeadlineExceeded,
			),
			failureContext: FailureContext{
				Operation: "http_request",
				Route:     "/api/v1/journey-requests/:id/generate",
				Status:    502,
			},
			wantLogFragments: []string{
				`"operation":"http_request"`,
				`"error_kind":"generation_failed"`,
				`"cause_kind":"deadline_exceeded"`,
				`"status":502`,
			},
		},
		{
			name: "異常系: 未知エラーの本文を出力しない",
			err:  errors.New(secret),
			failureContext: FailureContext{
				Operation:      "generate_journey_image",
				JourneyImageID: uuid.NewString(),
			},
			wantLogFragments: []string{
				`"error_kind":"internal_error"`,
				`"cause_kind":"internal_error"`,
				`"journey_image_id":"`,
			},
			forbidden: []string{secret, "secret-value", "private-itinerary"},
		},
		{
			name: "境界値系: nil と未検証の追加値を安全に扱う",
			failureContext: FailureContext{
				Route:          "/api/v1/journeys?token=secret-value",
				Status:         99,
				JourneyImageID: secret,
			},
			wantLogFragments: []string{
				`"operation":"unknown"`,
				`"error_kind":"unknown"`,
				`"cause_type":"<nil>"`,
			},
			forbidden: []string{"token=secret-value", "secret-value", `"status":99`, "journey_image_id"},
		},
	}

	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			var logs bytes.Buffer
			logger := slog.New(slog.NewJSONHandler(&logs, nil))

			LogFailure(
				context.Background(),
				logger,
				slog.LevelError,
				testCase.failureContext,
				testCase.err,
			)

			logText := logs.String()
			for _, want := range testCase.wantLogFragments {
				if !strings.Contains(logText, want) {
					t.Errorf("logs = %q, want fragment %q", logText, want)
				}
			}
			for _, forbidden := range testCase.forbidden {
				if strings.Contains(logText, forbidden) {
					t.Errorf("logs expose %q: %q", forbidden, logText)
				}
			}
		})
	}
}

func TestLogFailureRejectsUntrustedContextValues(t *testing.T) {
	const secretOperation = "api_key_private_itinerary"
	const secretRoute = "/api/v1/journeys/private-itinerary"

	var logs bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&logs, nil))
	LogFailure(
		context.Background(),
		logger,
		slog.LevelError,
		FailureContext{
			Operation: secretOperation,
			Route:     secretRoute,
			Status:    http.StatusInternalServerError,
		},
		WithOperation(secretOperation, errors.New("internal failure")),
	)

	logText := logs.String()
	if !strings.Contains(logText, `"operation":"unknown"`) {
		t.Errorf("logs = %q, want unknown operation", logText)
	}
	for _, forbidden := range []string{secretOperation, secretRoute, "private-itinerary", `"route":`, `"source_operation":`} {
		if strings.Contains(logText, forbidden) {
			t.Errorf("logs expose %q: %q", forbidden, logText)
		}
	}
}

func TestWithOperationPreservesOnlyApprovedOperations(t *testing.T) {
	original := errors.New("database failure")
	tests := []struct {
		name      string
		operation string
		want      string
	}{
		{
			name:      "正常系: リポジトリ操作を保持する",
			operation: "find_journey",
			want:      "find_journey",
		},
		{
			name:      "異常系: 空の操作名を捨てる",
			operation: "",
			want:      "",
		},
		{
			name:      "境界値系: 許可リスト外の操作名を捨てる",
			operation: "private_itinerary",
			want:      "",
		},
	}

	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			err := WithOperation(testCase.operation, original)
			if !errors.Is(err, original) {
				t.Errorf("WithOperation() must preserve original error: %v", err)
			}
			if got := SourceOperation(err); got != testCase.want {
				t.Errorf("SourceOperation() = %q, want %q", got, testCase.want)
			}
		})
	}
}

func TestLogRecoveredPanicDoesNotLogValue(t *testing.T) {
	const secret = "authorization=Bearer secret-value"

	var logs bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&logs, nil))
	LogRecoveredPanic(
		context.Background(),
		logger,
		"http_panic",
		"/api/v1/journeys/:id",
		errors.New(secret),
	)

	logText := logs.String()
	if !strings.Contains(logText, `"panic_type":"*errors.errorString"`) {
		t.Errorf("logs = %q, want panic type", logText)
	}
	if strings.Contains(logText, secret) || strings.Contains(logText, "secret-value") {
		t.Errorf("logs expose panic value: %q", logText)
	}
}

func TestCauseTypePrefersNonSentinelCause(t *testing.T) {
	providerError := &testProviderError{message: "provider response contains private data"}
	err := fmt.Errorf("generate journey: %w: %w", application.ErrGenerationFailed, providerError)

	if got, want := CauseType(err), fmt.Sprintf("%T", providerError); got != want {
		t.Errorf("CauseType() = %q, want %q", got, want)
	}
}

func TestLogFailureIncludesApprovedProviderDetails(t *testing.T) {
	const secret = "api_key=secret-value provider_body=private-itinerary"

	var logs bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&logs, nil))
	err := WithOperation(
		"openrouter_send_chat_completion",
		fmt.Errorf(
			"generate journey: %w: %w",
			application.ErrGenerationFailed,
			sdkerrors.NewAPIError("request rejected", http.StatusTooManyRequests, secret, nil),
		),
	)

	LogFailure(
		context.Background(),
		logger,
		slog.LevelError,
		FailureContext{Operation: "http_request", Status: http.StatusBadGateway},
		err,
	)

	logText := logs.String()
	for _, want := range []string{
		`"source_operation":"openrouter_send_chat_completion"`,
		`"provider_status":429`,
		`"provider_error_class":"rate_limited"`,
	} {
		if !strings.Contains(logText, want) {
			t.Errorf("logs = %q, want fragment %q", logText, want)
		}
	}
	for _, forbidden := range []string{secret, "secret-value", "private-itinerary"} {
		if strings.Contains(logText, forbidden) {
			t.Errorf("logs expose %q: %q", forbidden, logText)
		}
	}
}

func TestLogFailureIncludesPostgresSQLStateWithoutDetails(t *testing.T) {
	const secret = "Key (journey_id)=(private-itinerary) already exists"

	var logs bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&logs, nil))
	err := WithOperation(
		"save_journey",
		fmt.Errorf(
			"save journey: %w: %w",
			application.ErrDuplicateID,
			&pgconn.PgError{Code: "23505", Detail: secret},
		),
	)

	LogFailure(
		context.Background(),
		logger,
		slog.LevelError,
		FailureContext{Operation: "http_request", Status: http.StatusConflict},
		err,
	)

	logText := logs.String()
	for _, want := range []string{
		`"source_operation":"save_journey"`,
		`"postgres_sqlstate":"23505"`,
		`"error_kind":"duplicate_id"`,
	} {
		if !strings.Contains(logText, want) {
			t.Errorf("logs = %q, want fragment %q", logText, want)
		}
	}
	for _, forbidden := range []string{secret, "private-itinerary", "journey_id"} {
		if strings.Contains(logText, forbidden) {
			t.Errorf("logs expose %q: %q", forbidden, logText)
		}
	}
}

func TestProviderErrorDetails(t *testing.T) {
	tests := []struct {
		name      string
		status    int
		wantClass string
	}{
		{
			name:      "認証失敗: 401",
			status:    http.StatusUnauthorized,
			wantClass: "authentication_failed",
		},
		{
			name:      "レート制限: 429",
			status:    http.StatusTooManyRequests,
			wantClass: "rate_limited",
		},
		{
			name:      "プロバイダー障害: 503",
			status:    http.StatusServiceUnavailable,
			wantClass: "provider_server_error",
		},
	}

	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			err := sdkerrors.NewAPIError("provider error", testCase.status, "api_key=secret-value", nil)

			status, errorClass, ok := ProviderErrorDetails(err)
			if !ok {
				t.Fatal("ProviderErrorDetails() ok = false, want true")
			}
			if status != testCase.status {
				t.Errorf("status = %d, want %d", status, testCase.status)
			}
			if errorClass != testCase.wantClass {
				t.Errorf("error class = %q, want %q", errorClass, testCase.wantClass)
			}
		})
	}
}

type testProviderError struct {
	message string
}

func (e *testProviderError) Error() string {
	return e.message
}
